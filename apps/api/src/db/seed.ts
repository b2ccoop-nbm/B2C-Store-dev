import { and, eq } from "drizzle-orm";
import { createDb } from "./client";
import { slugify } from "../lib/slug";
import { orderLines, orders, patronageAccruals, products, vendors } from "./schema";
import { DEV_SAMPLE_ORDERS, DEV_SHOPPERS, DEV_STAFF } from "./seed-dev-fixtures";
import { SEED_PRODUCTS, SEED_VENDORS } from "./seed-data";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function seedCatalog(db: ReturnType<typeof createDb>["db"]) {
  const vendorByCode = new Map<string, { id: string; code: string }>();

  for (const v of SEED_VENDORS) {
    const existing = await db.select().from(vendors).where(eq(vendors.code, v.code)).limit(1);
    let vendor = existing[0];
    if (!vendor) {
      const inserted = await db
        .insert(vendors)
        .values({
          code: v.code,
          slug: v.slug ?? slugify(v.code),
          name: v.name,
          email: v.email,
          description: v.description ?? null,
        })
        .returning();
      vendor = inserted[0];
      console.log(`Created vendor ${vendor.code}`);
    } else {
      await db
        .update(vendors)
        .set({
          slug: vendor.slug ?? v.slug ?? slugify(v.code),
          description: vendor.description ?? v.description ?? null,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendor.id));
      console.log(`Vendor ${vendor.code} already exists`);
    }
    vendorByCode.set(v.code, { id: vendor.id, code: vendor.code });
  }

  for (const item of SEED_PRODUCTS) {
    const vendor = vendorByCode.get(item.vendorCode);
    if (!vendor) {
      console.warn(`  skip ${item.sku} — unknown vendor ${item.vendorCode}`);
      continue;
    }

    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.vendorId, vendor.id), eq(products.sku, item.sku)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  skip product ${item.sku}`);
      continue;
    }

    await db.insert(products).values({
      vendorId: vendor.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unitPrice: item.unitPrice,
      salesPerUnit: item.salesPerUnit,
      vendorPayablePerUnit: item.vendorPayablePerUnit,
      cogsPerUnit: item.cogsPerUnit,
      patronagePerUnit: item.patronagePerUnit,
    });
    console.log(`  added product ${item.sku}`);
  }
}

export async function seedDevFixtures(db: ReturnType<typeof createDb>["db"]) {
  console.log("\nDev test accounts (use at checkout / Firebase):");
  for (const shopper of DEV_SHOPPERS) {
    console.log(`  shopper  ${shopper.email}  — ${shopper.displayName}`);
  }
  for (const staff of DEV_STAFF) {
    console.log(`  staff    ${staff.email}  — ${staff.displayName} (${staff.role})`);
  }

  for (const sample of DEV_SAMPLE_ORDERS) {
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.externalId, sample.externalId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  skip order ${sample.externalId}`);
      continue;
    }

    await db.insert(orders).values({
      id: sample.id,
      externalId: sample.externalId,
      guestEmail: normalizeEmail(sample.guestEmail),
      participantId: sample.participantId,
      vendorCode: sample.vendorCode,
      status: sample.status,
      grossAmount: sample.grossAmount,
      salesAmount: sample.salesAmount,
      vendorPayableAmount: sample.vendorPayableAmount,
      cogsAmount: sample.cogsAmount,
      patronageAmount: sample.patronageAmount,
      memo: sample.memo,
      metadata: { devFixture: true, seededAt: new Date().toISOString() },
    });

    for (const line of sample.lines) {
      await db.insert(orderLines).values({
        orderId: sample.id,
        sku: line.sku,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineGross: line.lineGross,
        linePatronage: line.linePatronage,
      });
    }

    if (Number(sample.patronageAmount) > 0 && sample.guestEmail) {
      await db.insert(patronageAccruals).values({
        emailNormalized: normalizeEmail(sample.guestEmail),
        participantId: sample.participantId,
        orderId: sample.id,
        amount: sample.patronageAmount,
        status: sample.participantId ? "MERGED" : "ACCRUED",
        linkedAt: sample.participantId ? new Date() : null,
      });
    }

    console.log(`  added order ${sample.externalId} (${sample.status})`);
  }
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5434/b2ccoop_store";

async function main() {
  const withFixtures = process.env.SEED_DEV_FIXTURES !== "0";
  const { db, close } = createDb(connectionString);

  try {
    console.log("Seeding catalog…");
    await seedCatalog(db);

    if (withFixtures) {
      console.log("\nSeeding dev fixtures…");
      await seedDevFixtures(db);
    } else {
      console.log("\nSkipping dev fixtures (SEED_DEV_FIXTURES=0).");
    }

    console.log("\nSeed complete.");
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
