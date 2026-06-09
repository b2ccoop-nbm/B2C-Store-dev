import { and, eq } from "drizzle-orm";
import type { CheckoutRequest } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { orderLines, orders, patronageAccruals, products, vendors } from "../db/schema";
import { normalizeEmail, resolveMemberByEmail } from "../lib/member-resolve";
import { createPaymongoCheckoutSession, paymongoConfigured } from "../integrations/paymongo-client";
import type { WorkerEnv } from "../env";

type ResolvedLine = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineGross: number;
  lineSales: number;
  linePayable: number;
  lineCogs: number;
  linePatronage: number;
};

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 502 | 503 = 400,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

async function resolveCatalogLines(db: StoreDatabase, items: CheckoutRequest["items"]) {
  const lines: ResolvedLine[] = [];
  let vendorCode: string | null = null;
  let grossAmount = 0;
  let salesAmount = 0;
  let vendorPayableAmount = 0;
  let cogsAmount = 0;
  let patronageAmount = 0;

  for (const item of items) {
    const sku = item.sku.trim().toUpperCase();
    const rows = await db
      .select({
        vendorCode: vendors.code,
        sku: products.sku,
        name: products.name,
        unitPrice: products.unitPrice,
        salesPerUnit: products.salesPerUnit,
        vendorPayablePerUnit: products.vendorPayablePerUnit,
        cogsPerUnit: products.cogsPerUnit,
        patronagePerUnit: products.patronagePerUnit,
        isActive: products.isActive,
      })
      .from(products)
      .innerJoin(vendors, eq(products.vendorId, vendors.id))
      .where(and(eq(products.sku, sku), eq(products.isActive, true)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new CheckoutError(`Unknown product SKU: ${item.sku}`, 404);
    }

    if (vendorCode && vendorCode !== row.vendorCode) {
      throw new CheckoutError(
        "Checkout supports one vendor per order — split carts by vendor",
        400,
      );
    }
    vendorCode = row.vendorCode;

    const unitPrice = Number(row.unitPrice);
    const salesPerUnit = Number(row.salesPerUnit);
    const vendorPayablePerUnit = Number(row.vendorPayablePerUnit);
    const cogsPerUnit = Number(row.cogsPerUnit);
    const patronagePerUnit = Number(row.patronagePerUnit);
    const qty = item.quantity;

    const lineGross = unitPrice * qty;
    const lineSales = salesPerUnit * qty;
    const linePayable = vendorPayablePerUnit * qty;
    const lineCogs = cogsPerUnit * qty;
    const linePatronage = patronagePerUnit * qty;

    grossAmount += lineGross;
    salesAmount += lineSales;
    vendorPayableAmount += linePayable;
    cogsAmount += lineCogs;
    patronageAmount += linePatronage;

    lines.push({
      sku: row.sku,
      name: row.name,
      quantity: qty,
      unitPrice,
      lineGross,
      lineSales,
      linePayable,
      lineCogs,
      linePatronage,
    });
  }

  if (!vendorCode || grossAmount <= 0) {
    throw new CheckoutError("Cart is empty", 400);
  }

  const names = lines.map((l) => `${l.quantity}× ${l.name}`).join(", ");
  return {
    vendorCode,
    lines,
    grossAmount: grossAmount.toFixed(2),
    salesAmount: salesAmount.toFixed(2),
    vendorPayableAmount: vendorPayableAmount.toFixed(2),
    cogsAmount: cogsAmount.toFixed(2),
    patronageAmount: patronageAmount.toFixed(2),
    memo: `Coop store — ${names}`,
  };
}

export async function createCheckoutOrder(
  db: StoreDatabase,
  env: WorkerEnv,
  dto: CheckoutRequest,
) {
  const email = normalizeEmail(dto.email);
  const member = await resolveMemberByEmail(email, env);
  const resolved = await resolveCatalogLines(db, dto.items);
  const paymentMethod = dto.paymentMethod ?? "pickup";

  if (paymentMethod === "online" && !paymongoConfigured(env)) {
    throw new CheckoutError("Online payment is not configured (PAYMONGO_SECRET_KEY)", 503);
  }

  const orderId = crypto.randomUUID();
  const externalId = `order:${orderId}`;
  const initialStatus = paymentMethod === "online" ? "PENDING_PAYMENT" : "PENDING_PICKUP";

  const [order] = await db
    .insert(orders)
    .values({
      id: orderId,
      externalId,
      guestEmail: email,
      participantId: member.participantId,
      vendorCode: resolved.vendorCode,
      status: initialStatus,
      grossAmount: resolved.grossAmount,
      salesAmount: resolved.salesAmount,
      vendorPayableAmount: resolved.vendorPayableAmount,
      cogsAmount: resolved.cogsAmount,
      patronageAmount: resolved.patronageAmount,
      memo: resolved.memo,
      metadata: {
        channel: "store_checkout",
        paymentMethod,
        displayName: dto.displayName ?? member.displayName,
        memberIdNo: member.memberIdNo,
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

  if (paymentMethod === "online") {
    const storeBase = (env.PUBLIC_STORE_URL ?? "http://localhost:5175").replace(/\/$/, "");
    const grossCentavos = Math.round(Number(resolved.grossAmount) * 100);
    const paymongo = await createPaymongoCheckoutSession(env, {
      referenceNumber: externalId,
      description: resolved.memo,
      successUrl: `${storeBase}/order/${orderId}?paid=1`,
      cancelUrl: `${storeBase}/cart`,
      lineItems: [
        {
          name: resolved.memo.slice(0, 120),
          amountCentavos: grossCentavos,
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
          displayName: dto.displayName ?? member.displayName,
          memberIdNo: member.memberIdNo,
          paymongoSessionId: paymongo.sessionId,
        },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return {
      orderId: order.id,
      externalId: order.externalId,
      status: order.status,
      grossAmount: order.grossAmount,
      patronageAmount: order.patronageAmount,
      currency: order.currency,
      checkoutUrl: paymongo.checkoutUrl,
    };
  }

  return {
    orderId: order.id,
    externalId: order.externalId,
    status: order.status,
    grossAmount: order.grossAmount,
    patronageAmount: order.patronageAmount,
    currency: order.currency,
    pickupNote: "Pay at the coop pickup counter when you collect your order.",
  };
}
