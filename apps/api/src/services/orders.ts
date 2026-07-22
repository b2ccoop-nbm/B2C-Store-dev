import { and, eq, inArray } from "drizzle-orm";
import type { DeliveryAddress } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { orderLines, orders } from "../db/schema";
import { postMarketplaceSale } from "../integrations/accounting-client";
import type { WorkerEnv } from "../env";

type OrderRow = typeof orders.$inferSelect;

export class OrderError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export async function getOrderById(db: StoreDatabase, orderId: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) {
    return null;
  }

  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));

  const metadata =
    typeof order.metadata === "object" && order.metadata ? order.metadata : {};
  const accountingError =
    order.status === "FAILED" && "accountingError" in metadata
      ? String(metadata.accountingError)
      : undefined;

  const deliveryFeeAmount = order.deliveryFeeAmount ?? "0.00";
  const meta = metadata as Record<string, unknown>;
  const totalAmount =
    typeof meta.totalAmount === "string"
      ? meta.totalAmount
      : (Number(order.grossAmount) + Number(deliveryFeeAmount)).toFixed(2);

  const deliveryAddress =
    order.deliveryAddress && typeof order.deliveryAddress === "object"
      ? (order.deliveryAddress as DeliveryAddress)
      : null;

  return {
    orderId: order.id,
    externalId: order.externalId,
    status: order.status,
    fulfillmentMode: order.fulfillmentMode,
    guestEmail: order.guestEmail,
    participantId: order.participantId,
    vendorCode: order.vendorCode,
    grossAmount: order.grossAmount,
    deliveryFeeAmount,
    totalAmount,
    salesAmount: order.salesAmount,
    vendorPayableAmount: order.vendorPayableAmount,
    cogsAmount: order.cogsAmount,
    patronageAmount: order.patronageAmount,
    currency: order.currency,
    memo: order.memo,
    deliveryAddress,
    accountingError,
    createdAt: order.createdAt.toISOString(),
    lines: lines.map((line) => ({
      sku: line.sku,
      productName: line.productName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineGross: line.lineGross,
      linePatronage: line.linePatronage,
      lineDeliveryFee: line.lineDeliveryFee ?? "0.00",
    })),
  };
}

async function postOrderToAccounting(
  db: StoreDatabase,
  env: WorkerEnv,
  order: OrderRow,
  channel: string,
) {
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));

  return postMarketplaceSale(env, {
    externalId: order.externalId,
    occurredAt: new Date().toISOString(),
    currency: order.currency,
    grossAmount: Number(order.grossAmount),
    salesAmount: Number(order.salesAmount),
    vendorPayableAmount: Number(order.vendorPayableAmount),
    cogsAmount: Number(order.cogsAmount),
    patronageAmount: Number(order.patronageAmount),
    vendorCode: order.vendorCode,
    buyerParticipantId: order.participantId ?? undefined,
    memo: order.memo ?? undefined,
    metadata: {
      orderId: order.id,
      guestEmail: order.guestEmail ?? undefined,
      lineItems: lines,
      channel,
    },
  });
}

async function finalizePaidOrder(
  db: StoreDatabase,
  env: WorkerEnv,
  order: OrderRow,
  channel: string,
) {
  if (order.status === "POSTED_TO_LEDGER") {
    return {
      orderId: order.id,
      externalId: order.externalId,
      status: order.status,
      accounting: { status: "already_posted" as const },
    };
  }

  const accountingResult = await postOrderToAccounting(db, env, order, channel);
  const finalStatus = accountingResult.ok ? "POSTED_TO_LEDGER" : "FAILED";

  await db
    .update(orders)
    .set({
      status: finalStatus,
      updatedAt: new Date(),
      metadata: {
        ...(typeof order.metadata === "object" && order.metadata ? order.metadata : {}),
        accountingError: accountingResult.error,
        accountingPostedAt: accountingResult.ok ? new Date().toISOString() : undefined,
      },
    })
    .where(eq(orders.id, order.id));

  if (!accountingResult.ok) {
    throw new OrderError(
      accountingResult.error ?? "Accounting post failed — order marked FAILED for retry",
      400,
    );
  }

  return {
    orderId: order.id,
    externalId: order.externalId,
    status: finalStatus,
    accounting: {
      status: accountingResult.created ? "created" : "already_posted",
      body: accountingResult.body,
    },
  };
}

export async function confirmPickupAndPostLedger(
  db: StoreDatabase,
  env: WorkerEnv,
  orderId: string,
) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) {
    throw new OrderError("Order not found", 404);
  }

  if (order.status === "POSTED_TO_LEDGER") {
    return {
      orderId: order.id,
      externalId: order.externalId,
      status: order.status,
      accounting: { status: "already_posted" as const },
    };
  }

  if (order.status === "CANCELLED") {
    throw new OrderError("Order is cancelled", 409);
  }

  if (order.status !== "PENDING_PICKUP" && order.status !== "PENDING_DELIVERY" && order.status !== "FAILED") {
    throw new OrderError(`Cannot confirm fulfillment for status ${order.status}`, 409);
  }

  await db
    .update(orders)
    .set({ status: "PAID", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  const paid = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const channel =
    paid[0]?.fulfillmentMode === "merchant_pickup" ? "store_pickup_confirm" : "store_delivery_confirm";
  return finalizePaidOrder(db, env, paid[0]!, channel);
}

/** PayMongo webhook — idempotent by externalId / order status. */
export async function fulfillOnlinePayment(
  db: StoreDatabase,
  env: WorkerEnv,
  externalId: string,
  paymongoEventId?: string,
) {
  const rows = await db.select().from(orders).where(eq(orders.externalId, externalId)).limit(1);
  const order = rows[0];
  if (!order) {
    throw new OrderError(`Order not found for reference ${externalId}`, 404);
  }

  if (order.status === "POSTED_TO_LEDGER") {
    return { orderId: order.id, status: order.status, skipped: true as const };
  }

  if (order.status !== "PENDING_PAYMENT" && order.status !== "FAILED") {
    throw new OrderError(`Cannot fulfill online payment for status ${order.status}`, 409);
  }

  await db
    .update(orders)
    .set({
      status: "PAID",
      updatedAt: new Date(),
      metadata: {
        ...(typeof order.metadata === "object" && order.metadata ? order.metadata : {}),
        paymongoEventId,
        paidAt: new Date().toISOString(),
      },
    })
    .where(eq(orders.id, order.id));

  const paid = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
  const result = await finalizePaidOrder(db, env, paid[0]!, "store_paymongo_webhook");
  return { ...result, skipped: false as const };
}

export async function listPendingPickupOrders(db: StoreDatabase, vendorCode?: string) {
  const pendingStatuses = ["PENDING_PICKUP", "PENDING_DELIVERY"] as const;
  const rows = await db
    .select({
      orderId: orders.id,
      externalId: orders.externalId,
      guestEmail: orders.guestEmail,
      vendorCode: orders.vendorCode,
      status: orders.status,
      fulfillmentMode: orders.fulfillmentMode,
      grossAmount: orders.grossAmount,
      deliveryFeeAmount: orders.deliveryFeeAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      vendorCode
        ? and(
            inArray(orders.status, [...pendingStatuses]),
            eq(orders.vendorCode, vendorCode),
          )
        : inArray(orders.status, [...pendingStatuses]),
    );

  return rows
    .map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
