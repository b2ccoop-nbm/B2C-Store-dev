import { and, eq, inArray, sql } from "drizzle-orm";
import type { DeliveryAddress, FulfillmentStatus } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { orderLines, orders, vendors } from "../db/schema";
import { postMarketplaceSale } from "../integrations/accounting-client";
import { getPaymongoCheckoutSession } from "../integrations/paymongo-client";
import type { WorkerEnv } from "../env";
import { provisionVendorInAccounting } from "./accounting-vendors";

type OrderRow = typeof orders.$inferSelect;

const FULFILLMENT_FLOW: FulfillmentStatus[] = [
  "pending",
  "packed",
  "out_for_delivery",
  "delivered",
];

export class OrderError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

function orderTotalAmount(order: OrderRow, metadata: Record<string, unknown>): string {
  if (typeof metadata.totalAmount === "string") return metadata.totalAmount;
  return (Number(order.grossAmount) + Number(order.deliveryFeeAmount ?? 0)).toFixed(2);
}

function orderMetadata(order: OrderRow): Record<string, unknown> {
  return typeof order.metadata === "object" && order.metadata
    ? (order.metadata as Record<string, unknown>)
    : {};
}

function isPaidOnlineOrder(order: OrderRow): boolean {
  return orderMetadata(order).paidOnline === true;
}

function deliverySummary(order: OrderRow): { city: string | null; phone: string | null } {
  if (!order.deliveryAddress || typeof order.deliveryAddress !== "object") {
    return { city: null, phone: null };
  }
  const address = order.deliveryAddress as DeliveryAddress;
  return { city: address.city ?? null, phone: address.phone ?? null };
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
  const totalAmount = orderTotalAmount(order, meta);

  const deliveryAddress =
    order.deliveryAddress && typeof order.deliveryAddress === "object"
      ? (order.deliveryAddress as DeliveryAddress)
      : null;

  return {
    orderId: order.id,
    externalId: order.externalId,
    status: order.status,
    fulfillmentMode: order.fulfillmentMode,
    fulfillmentStatus: order.fulfillmentStatus,
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
    paymentMethod:
      meta.paymentMethod === "online" || meta.paymentMethod === "pickup"
        ? meta.paymentMethod
        : "pickup",
    paidOnline: meta.paidOnline === true,
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
  const deliveryFee = Number(order.deliveryFeeAmount ?? 0);
  const merchandiseGross = Number(order.grossAmount);
  const vendorPayableAmount = Number(order.vendorPayableAmount);
  const grossAmount = merchandiseGross + deliveryFee;
  const salesAmount = grossAmount - vendorPayableAmount;

  const vendorRows = await db
    .select({ name: vendors.name, email: vendors.email })
    .from(vendors)
    .where(eq(vendors.code, order.vendorCode))
    .limit(1);
  const vendorRow = vendorRows[0];
  await provisionVendorInAccounting(env, {
    code: order.vendorCode,
    name: vendorRow?.name ?? order.vendorCode,
    email: vendorRow?.email ?? undefined,
  });

  const paidOnline = isPaidOnlineOrder(order);
  const cashAccountCode = paidOnline || channel.includes("paymongo") ? "11190" : undefined;

  return postMarketplaceSale(env, {
    externalId: order.externalId,
    occurredAt: new Date().toISOString(),
    currency: order.currency,
    grossAmount,
    salesAmount,
    vendorPayableAmount,
    cogsAmount: Number(order.cogsAmount),
    patronageAmount: Number(order.patronageAmount),
    vendorCode: order.vendorCode,
    buyerParticipantId: order.participantId ?? undefined,
    memo: order.memo ?? undefined,
    cashAccountCode,
    metadata: {
      orderId: order.id,
      guestEmail: order.guestEmail ?? undefined,
      fulfillmentMode: order.fulfillmentMode,
      deliveryFeeAmount: order.deliveryFeeAmount,
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
  const paidOnline = isPaidOnlineOrder(order);
  const finalStatus = accountingResult.ok
    ? "POSTED_TO_LEDGER"
    : paidOnline
      ? order.fulfillmentMode === "merchant_pickup"
        ? "PENDING_PICKUP"
        : "PENDING_DELIVERY"
      : "FAILED";

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
    if (paidOnline) {
      return {
        orderId: order.id,
        externalId: order.externalId,
        status: finalStatus,
        accounting: {
          status: "failed" as const,
          error: accountingResult.error,
        },
      };
    }
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

function assertCanConfirm(order: OrderRow) {
  if (order.status === "CANCELLED") {
    throw new OrderError("Order is cancelled", 409);
  }

  if (order.status === "POSTED_TO_LEDGER") {
    if (!isPaidOnlineOrder(order)) {
      return;
    }
    if (order.fulfillmentStatus === "delivered") {
      throw new OrderError("Order fulfillment is already complete", 409);
    }
    if (order.fulfillmentMode === "delivery") {
      throw new OrderError("Mark the order as delivered before completing fulfillment", 409);
    }
    return;
  }

  if (order.fulfillmentMode === "merchant_pickup") {
    if (order.status !== "PENDING_PICKUP" && order.status !== "FAILED") {
      throw new OrderError(`Cannot confirm pickup for status ${order.status}`, 409);
    }
    return;
  }

  if (order.status !== "PENDING_DELIVERY" && order.status !== "FAILED") {
    throw new OrderError(`Cannot confirm delivery for status ${order.status}`, 409);
  }
  if (order.fulfillmentStatus !== "delivered") {
    throw new OrderError("Mark the order as delivered before confirming payment", 409);
  }
}

export async function confirmFulfillmentAndPostLedger(
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
    if (isPaidOnlineOrder(order)) {
      assertCanConfirm(order);
      await db
        .update(orders)
        .set({ fulfillmentStatus: "delivered", updatedAt: new Date() })
        .where(eq(orders.id, orderId));
    }
    return {
      orderId: order.id,
      externalId: order.externalId,
      status: order.status,
      accounting: { status: "already_posted" as const },
    };
  }

  assertCanConfirm(order);

  await db
    .update(orders)
    .set({ status: "PAID", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  const paid = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const channel =
    paid[0]?.fulfillmentMode === "merchant_pickup"
      ? "store_pickup_confirm"
      : "store_delivery_confirm";
  return finalizePaidOrder(db, env, paid[0]!, channel);
}

/** @deprecated Use confirmFulfillmentAndPostLedger */
export const confirmPickupAndPostLedger = confirmFulfillmentAndPostLedger;

export async function updateOrderFulfillmentStatus(
  db: StoreDatabase,
  orderId: string,
  vendorCode: string | undefined,
  nextStatus: FulfillmentStatus,
) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) {
    throw new OrderError("Order not found", 404);
  }
  if (vendorCode && order.vendorCode !== vendorCode) {
    throw new OrderError("Order does not belong to your store", 409);
  }
  if (order.status !== "PENDING_DELIVERY" && order.status !== "PENDING_PICKUP") {
    if (!(order.status === "POSTED_TO_LEDGER" && isPaidOnlineOrder(order))) {
      throw new OrderError(`Cannot update fulfillment for status ${order.status}`, 409);
    }
  }

  const currentIndex = FULFILLMENT_FLOW.indexOf(order.fulfillmentStatus as FulfillmentStatus);
  const nextIndex = FULFILLMENT_FLOW.indexOf(nextStatus);
  if (currentIndex < 0 || nextIndex < 0) {
    throw new OrderError("Invalid fulfillment status", 400);
  }

  const pickupSkip =
    order.fulfillmentMode === "merchant_pickup" &&
    order.fulfillmentStatus === "packed" &&
    nextStatus === "delivered";
  const sequential = nextIndex === currentIndex + 1;

  if (!sequential && !pickupSkip) {
    if (order.fulfillmentMode === "merchant_pickup" && nextStatus === "out_for_delivery") {
      throw new OrderError("Pickup orders skip out for delivery — mark as picked up instead", 409);
    }
    throw new OrderError(
      `Fulfillment must advance one step at a time (${order.fulfillmentStatus} → ${nextStatus})`,
      409,
    );
  }

  const updated = await db
    .update(orders)
    .set({
      fulfillmentStatus: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return serializePendingOrder(updated[0]!);
}

function serializePendingOrder(order: OrderRow) {
  const metadata =
    typeof order.metadata === "object" && order.metadata
      ? (order.metadata as Record<string, unknown>)
      : {};
  const { city, phone } = deliverySummary(order);

  return {
    orderId: order.id,
    externalId: order.externalId,
    guestEmail: order.guestEmail,
    vendorCode: order.vendorCode,
    status: order.status,
    fulfillmentMode: order.fulfillmentMode,
    fulfillmentStatus: order.fulfillmentStatus,
    grossAmount: order.grossAmount,
    deliveryFeeAmount: order.deliveryFeeAmount ?? "0.00",
    totalAmount: orderTotalAmount(order, metadata),
    createdAt: order.createdAt.toISOString(),
    deliveryCity: city,
    deliveryPhone: phone,
  };
}

export async function listPendingFulfillmentOrders(db: StoreDatabase, vendorCode?: string) {
  const pendingStatuses = ["PENDING_PICKUP", "PENDING_DELIVERY", "POSTED_TO_LEDGER"] as const;
  const rows = await db
    .select()
    .from(orders)
    .where(
      vendorCode
        ? and(inArray(orders.status, [...pendingStatuses]), eq(orders.vendorCode, vendorCode))
        : inArray(orders.status, [...pendingStatuses]),
    );

  return rows
    .filter((row) => {
      if (row.fulfillmentStatus === "delivered") return false;
      if (row.status === "POSTED_TO_LEDGER") return isPaidOnlineOrder(row);
      return row.status === "PENDING_PICKUP" || row.status === "PENDING_DELIVERY";
    })
    .map((row) => serializePendingOrder(row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** @deprecated Use listPendingFulfillmentOrders */
export const listPendingPickupOrders = listPendingFulfillmentOrders;

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

  const alreadyPaidOnline = isPaidOnlineOrder(order);
  const canFulfill =
    order.status === "PENDING_PAYMENT" ||
    order.status === "FAILED" ||
    (alreadyPaidOnline &&
      (order.status === "PENDING_DELIVERY" || order.status === "PENDING_PICKUP"));

  if (!canFulfill) {
    throw new OrderError(`Cannot fulfill online payment for status ${order.status}`, 409);
  }

  let working = order;
  if (order.status === "PENDING_PAYMENT" || order.status === "FAILED") {
    await db
      .update(orders)
      .set({
        status: "PAID",
        updatedAt: new Date(),
        metadata: {
          ...orderMetadata(order),
          paymongoEventId,
          paidAt: new Date().toISOString(),
          paidOnline: true,
        },
      })
      .where(eq(orders.id, order.id));

    const paid = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    working = paid[0]!;
  }

  const result = await finalizePaidOrder(db, env, working, "store_paymongo_webhook");
  return { ...result, skipped: false as const };
}

async function findOrderByPaymongoSessionId(db: StoreDatabase, sessionId: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(sql`${orders.metadata}->>'paymongoSessionId' = ${sessionId}`)
    .limit(1);
  return rows[0] ?? null;
}

/** Poll PayMongo when customer returns from hosted checkout before webhook arrives. */
export async function syncOnlineOrderPayment(
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
    return { orderId: order.id, status: order.status, synced: true as const, skipped: true as const };
  }

  const meta = orderMetadata(order);
  if (
    meta.paidOnline === true &&
    (order.status === "FAILED" ||
      order.status === "PENDING_DELIVERY" ||
      order.status === "PENDING_PICKUP")
  ) {
    const result = await fulfillOnlinePayment(db, env, order.externalId, "sync:retry");
    return { ...result, synced: true as const };
  }

  if (order.status !== "PENDING_PAYMENT" && order.status !== "FAILED") {
    throw new OrderError(`Order is ${order.status}, not awaiting online payment`, 409);
  }

  if (meta.paymentMethod !== "online") {
    throw new OrderError("This order is not configured for online payment", 409);
  }

  const sessionId =
    typeof meta.paymongoSessionId === "string" ? meta.paymongoSessionId.trim() : "";
  if (!sessionId) {
    throw new OrderError("PayMongo checkout session not found on this order", 409);
  }

  const session = await getPaymongoCheckoutSession(env, sessionId);
  if (!session.ok) {
    throw new OrderError(`PayMongo: ${session.error}`);
  }

  if (!session.paid) {
    return {
      orderId: order.id,
      status: order.status,
      synced: false as const,
      pending: true as const,
    };
  }

  const result = await fulfillOnlinePayment(
    db,
    env,
    order.externalId,
    `sync:${sessionId}`,
  );
  return { ...result, synced: true as const };
}

export async function resolveOrderForPaymongoWebhook(
  db: StoreDatabase,
  input: { reference?: string; sessionId?: string },
) {
  const reference = input.reference?.trim();
  if (reference) {
    const rows = await db.select().from(orders).where(eq(orders.externalId, reference)).limit(1);
    if (rows[0]) return rows[0];
  }

  const sessionId = input.sessionId?.trim();
  if (sessionId) {
    return findOrderByPaymongoSessionId(db, sessionId);
  }

  return null;
}

export function nextFulfillmentStatus(current: FulfillmentStatus): FulfillmentStatus | null {
  const index = FULFILLMENT_FLOW.indexOf(current);
  if (index < 0 || index >= FULFILLMENT_FLOW.length - 1) return null;
  return FULFILLMENT_FLOW[index + 1]!;
}

export function fulfillmentStatusLabel(status: FulfillmentStatus): string {
  switch (status) {
    case "pending":
      return "New order";
    case "packed":
      return "Packed";
    case "out_for_delivery":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    default:
      return status;
  }
}
