import type { Context } from "hono";
import { updatePlatformSettingsSchema } from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import type { StoreAdminVariables } from "../middleware/store-admin-auth";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../services/platform-settings";
import { paymongoConfigured } from "../integrations/paymongo-client";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

type AdminContext = Context<{ Bindings: WorkerEnv; Variables: StoreAdminVariables }>;

export async function getAdminPlatformSettings(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const settings = await getPlatformSettings(db);
    return c.json({ ok: true, settings });
  } finally {
    await close();
  }
}

export async function patchAdminPlatformSettings(c: AdminContext) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updatePlatformSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const settings = await updatePlatformSettings(db, parsed.data);
    return c.json({ ok: true, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return c.json({ error: message }, 400);
  } finally {
    await close();
  }
}

export async function getPublicCommerceSettings(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const settings = await getPlatformSettings(db);
    return c.json({
      ok: true,
      settings,
      checkout: {
        onlinePaymentEnabled: paymongoConfigured(c.env),
      },
    });
  } finally {
    await close();
  }
}
