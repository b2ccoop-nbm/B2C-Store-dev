import { eq } from "drizzle-orm";
import type { CheckoutRequest } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { orderLines, orders, patronageAccruals } from "../db/schema";
import { normalizeEmail, resolveMemberByEmail } from "../lib/member-resolve";
import { createPaymongoCheckoutSession, paymongoConfigured } from "../integrations/paymongo-client";
import type { WorkerEnv } from "../env";
import { CheckoutError, resolveCheckout } from "./checkout-resolver";

export { CheckoutError } from "./checkout-resolver";

function formatAddress(address: NonNullable<CheckoutRequest["deliveryAddress"]>): string {
  const parts = [
    address.line1,
    address.line2,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
  ].filter(Boolean);
  return parts.join(", ");
}

export async function createCheckoutOrder(
  db: StoreDatabase,
  env: WorkerEnv,
  dto: CheckoutRequest,
) {
  const email = normalizeEmail(dto.email);
  const member = await resolveMemberByEmail(email, env);
  const resolved = await resolveCheckout(db, dto.items);
  const fulfillmentMode = dto.fulfillmentMode ?? "delivery";
  const paymentMethod = dto.paymentMethod ?? "pickup";

  if (fulfillmentMode === "merchant_pickup") {
    if (!resolved.pickupAvailable || !resolved.pickup) {
      throw new CheckoutError("Merchant pickup is not available for this store", 400);
    }
  }

  if (paymentMethod === "online" && !paymongoConfigured(env)) {
    throw new CheckoutError("Online payment is not configured (PAYMONGO_SECRET_KEY)", 503);
  }

  const orderId = crypto.randomUUID();
  const externalId = `order:${orderId}`;
  let initialStatus: typeof orders.$inferInsert.status;
  if (paymentMethod === "online") {
    initialStatus = "PENDING_PAYMENT";
  } else if (fulfillmentMode === "merchant_pickup") {
    initialStatus = "PENDING_PICKUP";
  } else {
    initialStatus = "PENDING_DELIVERY";
  }

  const deliveryFeeAmount = fulfillmentMode === "delivery" ? resolved.deliveryFee : "0.00";

  const [order] = await db
    .insert(orders)
    .values({
      id: orderId,
      externalId,
      guestEmail: email,
      participantId: member.participantId,
      vendorCode: resolved.vendorCode,
      fulfillmentMode,
      status: initialStatus,
      grossAmount: resolved.grossAmount,
      deliveryFeeAmount,
      deliveryAddress:
        fulfillmentMode === "delivery" && dto.deliveryAddress ? dto.deliveryAddress : null,
      salesAmount: resolved.salesAmount,
      vendorPayableAmount: resolved.vendorPayableAmount,
      cogsAmount: resolved.cogsAmount,
      patronageAmount: resolved.patronageAmount,
      memo: resolved.memo,
      metadata: {
        channel: "store_checkout",
        paymentMethod,
        fulfillmentMode,
        displayName: dto.displayName ?? member.displayName,
        memberIdNo: member.memberIdNo,
        deliveryCapApplied: resolved.deliveryCapApplied,
        totalAmount: resolved.totalAmount,
      },
    })
    .returning();

  for (const line of resolved.lines) {
    await db.insert(orderLines).values({
      orderId: order.id,
      sku: line.sku,
      productName: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toFixed(2),
      lineGross: line.lineGross.toFixed(2),
      linePatronage: line.linePatronage.toFixed(2),
      lineDeliveryFee: fulfillmentMode === "delivery" ? line.lineDeliveryFee : "0.00",
    });
  }

  if (Number(resolved.patronageAmount) > 0) {
    await db.insert(patronageAccruals).values({
      emailNormalized: email,
      participantId: member.participantId,
      orderId: order.id,
      amount: resolved.patronageAmount,
      status: member.participantId ? "MERGED" : "ACCRUED",
      linkedAt: member.participantId ? new Date() : null,
    });
  }

  const totalAmount =
    fulfillmentMode === "delivery" ? resolved.totalAmount : resolved.merchandiseSubtotal;

  const baseResponse = {
    orderId: order.id,
    externalId: order.externalId,
    status: order.status,
    fulfillmentMode,
    grossAmount: order.grossAmount,
    deliveryFeeAmount: order.deliveryFeeAmount,
    totalAmount,
    patronageAmount: order.patronageAmount,
    currency: order.currency,
  };

  if (paymentMethod === "online") {
    const storeBase = (env.PUBLIC_STORE_URL ?? "http://localhost:5175").replace(/\/$/, "");
    const totalCentavos = Math.round(Number(resolved.totalAmount) * 100);
    const paymongo = await createPaymongoCheckoutSession(env, {
      referenceNumber: externalId,
      description: resolved.memo,
      successUrl: `${storeBase}/order/${orderId}?paid=1`,
      cancelUrl: `${storeBase}/order/${orderId}`,
      lineItems: [
        {
          name: resolved.memo.slice(0, 120),
          amountCentavos: totalCentavos,
          quantity: 1,
        },
      ],
    });

    if (!paymongo.ok) {
      await db
        .update(orders)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      throw new CheckoutError(paymongo.error, 502);
    }

    await db
      .update(orders)
      .set({
        metadata: {
          channel: "store_checkout",
          paymentMethod,
          fulfillmentMode,
          displayName: dto.displayName ?? member.displayName,
          memberIdNo: member.memberIdNo,
          deliveryCapApplied: resolved.deliveryCapApplied,
          totalAmount: resolved.totalAmount,
          paymongoSessionId: paymongo.sessionId,
        },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return {
      ...baseResponse,
      checkoutUrl: paymongo.checkoutUrl,
    };
  }

  if (fulfillmentMode === "merchant_pickup" && resolved.pickup) {
    const pickupParts = [
      resolved.pickup.address,
      resolved.pickup.landmark ? `Landmark: ${resolved.pickup.landmark}` : null,
      resolved.pickup.hours ? `Hours: ${resolved.pickup.hours}` : null,
      resolved.pickup.phone ? `Contact: ${resolved.pickup.phone}` : null,
      resolved.pickup.instructions,
    ].filter(Boolean);

    return {
      ...baseResponse,
      pickupNote: `Pay when you pick up at ${resolved.vendorName}. ${pickupParts.join(" · ")}`,
    };
  }

  const addressText = dto.deliveryAddress ? formatAddress(dto.deliveryAddress) : "your address";
  return {
    ...baseResponse,
    fulfillmentNote: `Delivery to ${addressText}. Pay ${resolved.totalAmount} PHP when your order arrives (includes ${deliveryFeeAmount} delivery).`,
  };
}

export async function createPaymongoCheckoutForOrder(
  db: StoreDatabase,
  env: WorkerEnv,
  orderId: string,
) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) {
    throw new CheckoutError("Order not found", 404);
  }
  if (order.status !== "PENDING_PAYMENT") {
    throw new CheckoutError(`Order is ${order.status}, not awaiting payment`, 409);
  }

  const meta =
    typeof order.metadata === "object" && order.metadata
      ? (order.metadata as Record<string, unknown>)
      : {};
  if (meta.paymentMethod !== "online") {
    throw new CheckoutError("This order is not configured for online payment", 409);
  }
  if (!paymongoConfigured(env)) {
    throw new CheckoutError("Online payment is not configured (PAYMONGO_SECRET_KEY)", 503);
  }

  const totalAmount =
    typeof meta.totalAmount === "string"
      ? meta.totalAmount
      : (Number(order.grossAmount) + Number(order.deliveryFeeAmount ?? 0)).toFixed(2);
  const storeBase = (env.PUBLIC_STORE_URL ?? "http://localhost:5175").replace(/\/$/, "");
  const totalCentavos = Math.round(Number(totalAmount) * 100);
  const paymongo = await createPaymongoCheckoutSession(env, {
    referenceNumber: order.externalId,
    description: order.memo ?? `Order ${order.id.slice(0, 8)}`,
    successUrl: `${storeBase}/order/${orderId}?paid=1`,
    cancelUrl: `${storeBase}/order/${orderId}`,
    lineItems: [
      {
        name: (order.memo ?? "B2CCoop order").slice(0, 120),
        amountCentavos: totalCentavos,
        quantity: 1,
      },
    ],
  });

  if (!paymongo.ok) {
    throw new CheckoutError(paymongo.error, 502);
  }

  await db
    .update(orders)
    .set({
      metadata: {
        ...meta,
        paymongoSessionId: paymongo.sessionId,
      },
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  return {
    orderId: order.id,
    checkoutUrl: paymongo.checkoutUrl,
  };
}
