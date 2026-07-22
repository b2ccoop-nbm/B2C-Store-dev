import { eq } from "drizzle-orm";
import type { PlatformCommerceSettings } from "@b2ccoop/store-shared";
import { DEFAULT_PLATFORM_COMMERCE } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { platformSettings } from "../db/schema";

const SETTINGS_ID = "default";

function serialize(row: typeof platformSettings.$inferSelect): PlatformCommerceSettings {
  return {
    defaultDeliveryPerItem: row.defaultDeliveryPerItem,
    maxDeliveryPerOrder: row.maxDeliveryPerOrder,
    defaultPartnerListingFeePercent: row.defaultPartnerListingFeePercent,
    patronageRatePercent: row.patronageRatePercent,
  };
}

export async function ensurePlatformSettings(db: StoreDatabase): Promise<PlatformCommerceSettings> {
  const existing = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, SETTINGS_ID))
    .limit(1);

  if (existing[0]) {
    return serialize(existing[0]);
  }

  const inserted = await db
    .insert(platformSettings)
    .values({ id: SETTINGS_ID })
    .returning();

  return inserted[0] ? serialize(inserted[0]) : DEFAULT_PLATFORM_COMMERCE;
}

export async function getPlatformSettings(db: StoreDatabase): Promise<PlatformCommerceSettings> {
  return ensurePlatformSettings(db);
}

export type UpdatePlatformSettingsInput = Partial<PlatformCommerceSettings>;

function parseMoney(value: string, field: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${field}`);
  }
  return n.toFixed(2);
}

function parsePercent(value: string, field: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`Invalid ${field}`);
  }
  return n.toFixed(2);
}

export async function updatePlatformSettings(
  db: StoreDatabase,
  input: UpdatePlatformSettingsInput,
): Promise<PlatformCommerceSettings> {
  await ensurePlatformSettings(db);

  const patch: Partial<typeof platformSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.defaultDeliveryPerItem !== undefined) {
    patch.defaultDeliveryPerItem = parseMoney(input.defaultDeliveryPerItem, "defaultDeliveryPerItem");
  }
  if (input.maxDeliveryPerOrder !== undefined) {
    patch.maxDeliveryPerOrder = parseMoney(input.maxDeliveryPerOrder, "maxDeliveryPerOrder");
  }
  if (input.defaultPartnerListingFeePercent !== undefined) {
    patch.defaultPartnerListingFeePercent = parsePercent(
      input.defaultPartnerListingFeePercent,
      "defaultPartnerListingFeePercent",
    );
  }
  if (input.patronageRatePercent !== undefined) {
    patch.patronageRatePercent = parsePercent(input.patronageRatePercent, "patronageRatePercent");
  }

  const updated = await db
    .update(platformSettings)
    .set(patch)
    .where(eq(platformSettings.id, SETTINGS_ID))
    .returning();

  return serialize(updated[0]!);
}
