import { and, eq } from "drizzle-orm";
import {
  computeOrderDeliveryFees,
  effectiveDeliveryPerItem,
  sumMoney,
  type DeliveryTier,
} from "@b2ccoop/store-shared";
import type { CheckoutRequest } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { products, vendors } from "../db/schema";
import { getPlatformSettings } from "./platform-settings";

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 502 | 503 = 400,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type ResolvedCheckoutLine = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  deliveryPerItem: string;
  lineDeliveryFee: string;
  lineGross: number;
  lineSales: number;
  linePayable: number;
  lineCogs: number;
  linePatronage: number;
};

export type ResolvedCheckout = {
  vendorCode: string;
  vendorName: string;
  pickupAvailable: boolean;
  pickup: {
    address: string;
    landmark: string | null;
    hours: string | null;
    phone: string | null;
    instructions: string | null;
  } | null;
  lines: ResolvedCheckoutLine[];
  merchandiseSubtotal: string;
  deliverySubtotal: string;
  deliveryFee: string;
  deliveryCapApplied: boolean;
  totalAmount: string;
  grossAmount: string;
  salesAmount: string;
  vendorPayableAmount: string;
  cogsAmount: string;
  patronageAmount: string;
  memo: string;
};

async function loadCatalogRow(db: StoreDatabase, sku: string) {
  const normalizedSku = sku.trim().toUpperCase();
  const rows = await db
    .select({
      vendorCode: vendors.code,
      vendorName: vendors.name,
      pickupEnabled: vendors.pickupEnabled,
      pickupAddress: vendors.pickupAddress,
      pickupLandmark: vendors.pickupLandmark,
      pickupHours: vendors.pickupHours,
      pickupPhone: vendors.pickupPhone,
      pickupInstructions: vendors.pickupInstructions,
      vendorDeliveryPerItem: vendors.deliveryPerItem,
      sku: products.sku,
      name: products.name,
      unitPrice: products.unitPrice,
      salesPerUnit: products.salesPerUnit,
      vendorPayablePerUnit: products.vendorPayablePerUnit,
      cogsPerUnit: products.cogsPerUnit,
      patronagePerUnit: products.patronagePerUnit,
      productDeliveryPerItem: products.deliveryPerItem,
      deliveryTier: products.deliveryTier,
      isActive: products.isActive,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(eq(products.sku, normalizedSku), eq(products.isActive, true)))
    .limit(1);

  return rows[0];
}

export async function resolveCheckout(
  db: StoreDatabase,
  items: CheckoutRequest["items"],
): Promise<ResolvedCheckout> {
  const platform = await getPlatformSettings(db);
  const resolvedLines: ResolvedCheckoutLine[] = [];
  let vendorCode: string | null = null;
  let vendorName = "";
  let pickupAvailable = false;
  let pickup: ResolvedCheckout["pickup"] = null;

  let grossAmount = 0;
  let salesAmount = 0;
  let vendorPayableAmount = 0;
  let cogsAmount = 0;
  let patronageAmount = 0;

  const deliveryInputs: { quantity: number; deliveryPerItem: string }[] = [];

  for (const item of items) {
    const row = await loadCatalogRow(db, item.sku);
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
    vendorName = row.vendorName;
    pickupAvailable = row.pickupEnabled && Boolean(row.pickupAddress?.trim());
    if (pickupAvailable && row.pickupAddress) {
      pickup = {
        address: row.pickupAddress,
        landmark: row.pickupLandmark,
        hours: row.pickupHours,
        phone: row.pickupPhone,
        instructions: row.pickupInstructions,
      };
    }

    const unitPrice = Number(row.unitPrice);
    const salesPerUnit = Number(row.salesPerUnit);
    const vendorPayablePerUnit = Number(row.vendorPayablePerUnit);
    const cogsPerUnit = Number(row.cogsPerUnit);
    const patronagePerUnit = Number(row.patronagePerUnit);
    const qty = item.quantity;
    const deliveryPerItem = effectiveDeliveryPerItem(
      platform,
      row.deliveryTier as DeliveryTier,
      row.vendorDeliveryPerItem,
      row.productDeliveryPerItem,
    );

    deliveryInputs.push({ quantity: qty, deliveryPerItem });

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

    resolvedLines.push({
      sku: row.sku,
      name: row.name,
      quantity: qty,
      unitPrice,
      deliveryPerItem,
      lineDeliveryFee: "0.00",
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

  const delivery = computeOrderDeliveryFees(platform, deliveryInputs);
  const deliveryRatio =
    delivery.capApplied && Number(delivery.deliverySubtotal) > 0
      ? Number(delivery.deliveryFee) / Number(delivery.deliverySubtotal)
      : 1;

  resolvedLines.forEach((line, index) => {
    const uncapped = Number(delivery.lineDeliveryFees[index] ?? "0");
    line.lineDeliveryFee = (uncapped * deliveryRatio).toFixed(2);
  });

  const merchandiseSubtotal = grossAmount.toFixed(2);
  const totalAmount = sumMoney(merchandiseSubtotal, delivery.deliveryFee);
  const names = resolvedLines.map((l) => `${l.quantity}× ${l.name}`).join(", ");

  return {
    vendorCode,
    vendorName,
    pickupAvailable,
    pickup,
    lines: resolvedLines,
    merchandiseSubtotal,
    deliverySubtotal: delivery.deliverySubtotal,
    deliveryFee: delivery.deliveryFee,
    deliveryCapApplied: delivery.capApplied,
    totalAmount,
    grossAmount: merchandiseSubtotal,
    salesAmount: salesAmount.toFixed(2),
    vendorPayableAmount: vendorPayableAmount.toFixed(2),
    cogsAmount: cogsAmount.toFixed(2),
    patronageAmount: patronageAmount.toFixed(2),
    memo: `Coop store — ${names}`,
  };
}

export async function quoteCheckout(db: StoreDatabase, items: CheckoutRequest["items"]) {
  const resolved = await resolveCheckout(db, items);
  return {
    ok: true as const,
    vendorCode: resolved.vendorCode,
    lines: resolved.lines.map((line) => ({
      sku: line.sku,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toFixed(2),
      deliveryPerItem: line.deliveryPerItem,
      lineDeliveryFee: line.lineDeliveryFee,
    })),
    merchandiseSubtotal: resolved.merchandiseSubtotal,
    deliverySubtotal: resolved.deliverySubtotal,
    deliveryFee: resolved.deliveryFee,
    deliveryCapApplied: resolved.deliveryCapApplied,
    totalAmount: resolved.totalAmount,
    pickupAvailable: resolved.pickupAvailable,
    pickup: resolved.pickup,
  };
}
