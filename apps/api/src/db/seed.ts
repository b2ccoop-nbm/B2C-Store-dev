import { and, eq } from "drizzle-orm";
import { createDb } from "./client";
import { products, vendors } from "./schema";
import { SEED_PRODUCTS, SEED_VENDOR } from "./seed-data";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5434/b2ccoop_store";

async function main() {
  const { db, close } = createDb(connectionString);

  try {
    const existingVendor = await db
      .select()
      .from(vendors)
      .where(eq(vendors.code, SEED_VENDOR.code))
      .limit(1);

    let vendor = existingVendor[0];

    if (!vendor) {
      const inserted = await db
        .insert(vendors)
        .values({
          code: SEED_VENDOR.code,
          name: SEED_VENDOR.name,
          email: SEED_VENDOR.email,
        })
        .returning();
      vendor = inserted[0];
      console.log(`Created vendor ${vendor.code}`);
    } else {
      console.log(`Vendor ${vendor.code} already exists`);
    }

    for (const item of SEED_PRODUCTS) {
      const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.vendorId, vendor.id), eq(products.sku, item.sku)))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  skip ${item.sku}`);
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
      console.log(`  added ${item.sku}`);
    }

    console.log("Seed complete.");
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
