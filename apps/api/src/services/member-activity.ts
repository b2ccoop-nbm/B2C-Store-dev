import { desc, eq } from "drizzle-orm";
import type { StoreDatabase } from "../db/client";
import { orders, patronageAccruals } from "../db/schema";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const ACTIVE_STATUSES = new Set(["PENDING_PICKUP", "PENDING_PAYMENT", "PAID", "FAILED"]);
const COMPLETED_STATUSES = new Set(["POSTED_TO_LEDGER", "CANCELLED"]);

export async function listOrdersByEmail(db: StoreDatabase, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return [];
  }

  const rows = await db
    .select({
      orderId: orders.id,
      externalId: orders.externalId,
      status: orders.status,
      guestEmail: orders.guestEmail,
      vendorCode: orders.vendorCode,
      grossAmount: orders.grossAmount,
      patronageAmount: orders.patronageAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.guestEmail, normalized))
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => ({
    orderId: row.orderId,
    externalId: row.externalId,
    status: row.status,
    vendorCode: row.vendorCode,
    grossAmount: row.grossAmount,
    patronageAmount: row.patronageAmount,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    bucket: ACTIVE_STATUSES.has(row.status)
      ? ("active" as const)
      : COMPLETED_STATUSES.has(row.status)
        ? ("completed" as const)
        : ("active" as const),
  }));
}

export async function getStorePatronageSummary(db: StoreDatabase, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return {
      email: normalized,
      currency: "PHP",
      accruedTotal: "0.00",
      accrualCount: 0,
      recentAccruals: [] as Array<{
        orderId: string;
        amount: string;
        status: string;
        createdAt: string;
      }>,
    };
  }

  const rows = await db
    .select({
      orderId: patronageAccruals.orderId,
      amount: patronageAccruals.amount,
      status: patronageAccruals.status,
      createdAt: patronageAccruals.createdAt,
    })
    .from(patronageAccruals)
    .where(eq(patronageAccruals.emailNormalized, normalized))
    .orderBy(desc(patronageAccruals.createdAt))
    .limit(20);

  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    email: normalized,
    currency: "PHP",
    accruedTotal: total.toFixed(2),
    accrualCount: rows.length,
    recentAccruals: rows.map((row) => ({
      orderId: row.orderId,
      amount: row.amount,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
