import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { createDb } from "../db/client";
import { products, vendors } from "../db/schema";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

export async function getCatalog(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const rows = await db
      .select({
        vendorCode: vendors.code,
        sku: products.sku,
        name: products.name,
        category: products.category,
        unitPrice: products.unitPrice,
        patronagePerUnit: products.patronagePerUnit,
        currency: products.currency,
      })
      .from(products)
      .innerJoin(vendors, eq(products.vendorId, vendors.id))
      .where(eq(products.isActive, true));

    const items = rows
      .map((row) => ({
        vendorCode: row.vendorCode,
        sku: row.sku,
        name: row.name,
        category: row.category,
        unitPrice: row.unitPrice,
        patronagePerUnit: row.patronagePerUnit,
        currency: row.currency,
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    return c.json({
      storeMode: "native_dev",
      currency: "PHP",
      itemCount: items.length,
      items,
      devAccounts: c.env.ENVIRONMENT !== "production" ? devAccountsHint() : undefined,
    });
  } finally {
    await close();
  }
}

function devAccountsHint() {
  return {
    guestCheckout: "guest.shopper@b2ccoop.test",
    members: ["member.demo@b2ccoop.test", "member.patron@b2ccoop.test"],
    staff: ["store.admin@b2ccoop.test", "pickup.clerk@b2ccoop.test"],
    docs: "docs/DEV-TESTING.md",
  };
}
