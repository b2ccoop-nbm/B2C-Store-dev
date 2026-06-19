import type { Context } from "hono";
import {
  merchantBindFirebaseRequestSchema,
  sellerApplicationRequestSchema,
  sellerApplicationStatusRequestSchema,
} from "@b2ccoop/store-shared";
import { createDb } from "../db/client";
import { verifyFirebaseIdToken } from "../lib/firebase-auth";
import { verifyTurnstile } from "../lib/turnstile";
import {
  getSellerApplicationByEmail,
  getSellerApplicationByFirebaseUid,
  getSellerApplicationByStatusToken,
  SellerApplicationError,
  submitSellerApplication,
} from "../services/seller-applications";
import { bindVendorFirebaseUid, VendorError } from "../services/vendors";
import { resolveDatabaseUrl, type WorkerEnv } from "../env";

function clientIp(c: Context): string | undefined {
  return c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim();
}

async function resolveApplicationFromStatusRequest(
  db: ReturnType<typeof createDb>["db"],
  body: {
    email?: string;
    statusToken?: string;
    firebaseIdToken?: string;
  },
) {
  if (body.statusToken) {
    return getSellerApplicationByStatusToken(db, body.statusToken);
  }

  if (body.firebaseIdToken) {
    return null;
  }

  if (body.email) {
    return getSellerApplicationByEmail(db, body.email);
  }

  return null;
}

export async function postSellerApplication(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = sellerApplicationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const turnstile = await verifyTurnstile(c.env, parsed.data.turnstileToken, clientIp(c));
  if (!turnstile.ok) {
    return c.json({ error: turnstile.error }, 400);
  }

  let applicantFirebaseUid: string | undefined;
  if (parsed.data.firebaseIdToken) {
    const firebaseUser = await verifyFirebaseIdToken(c.env, parsed.data.firebaseIdToken);
    if (!firebaseUser) {
      return c.json({ error: "Invalid Firebase session" }, 401);
    }
    if (firebaseUser.email !== parsed.data.applicantEmail.trim().toLowerCase()) {
      return c.json({ error: "Application email must match signed-in member" }, 400);
    }
    applicantFirebaseUid = firebaseUser.uid;
  }

  const { db, close } = createDb(dbUrl);
  try {
    const result = await submitSellerApplication(db, {
      ...parsed.data,
      applicantFirebaseUid,
    });
    return c.json(
      {
        ok: true,
        application: result.application,
        statusAccessToken: result.statusAccessToken,
      },
      201,
    );
  } catch (err) {
    if (err instanceof SellerApplicationError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}

export async function postSellerApplicationStatus(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = sellerApplicationStatusRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { statusToken, firebaseIdToken, email, turnstileToken } = parsed.data;
  if (!statusToken && !firebaseIdToken && !email) {
    return c.json({ error: "statusToken, firebaseIdToken, or email required" }, 400);
  }

  if (!statusToken && !firebaseIdToken) {
    const turnstile = await verifyTurnstile(c.env, turnstileToken, clientIp(c));
    if (!turnstile.ok) {
      return c.json({ error: turnstile.error }, 400);
    }
  }

  const { db, close } = createDb(dbUrl);
  try {
    let application = await resolveApplicationFromStatusRequest(db, parsed.data);

    if (!application && firebaseIdToken) {
      const firebaseUser = await verifyFirebaseIdToken(c.env, firebaseIdToken);
      if (!firebaseUser) {
        return c.json({ error: "Invalid Firebase session" }, 401);
      }
      application =
        (await getSellerApplicationByFirebaseUid(db, firebaseUser.uid)) ??
        (await getSellerApplicationByEmail(db, firebaseUser.email));
    }

    if (!application) {
      return c.json({ found: false });
    }
    return c.json({ found: true, application });
  } finally {
    await close();
  }
}

/** @deprecated Prefer POST /seller/applications/status */
export async function getSellerApplicationStatus(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const statusToken = c.req.query("statusToken")?.trim();
  const email = c.req.query("email")?.trim();

  if (!statusToken && !email) {
    return c.json({ error: "statusToken or email query parameter required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const application = statusToken
      ? await getSellerApplicationByStatusToken(db, statusToken)
      : email
        ? await getSellerApplicationByEmail(db, email)
        : null;

    if (!application) {
      return c.json({ found: false });
    }
    return c.json({ found: true, application });
  } finally {
    await close();
  }
}

export async function postMerchantBindFirebase(c: Context<{ Bindings: WorkerEnv }>) {
  const dbUrl = resolveDatabaseUrl(c.env);
  if (!dbUrl) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = merchantBindFirebaseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const firebaseUser = await verifyFirebaseIdToken(c.env, parsed.data.firebaseIdToken);
  if (!firebaseUser) {
    return c.json({ error: "Invalid Firebase session" }, 401);
  }

  const vendorCode = c.req.query("vendorCode")?.trim();
  if (!vendorCode) {
    return c.json({ error: "vendorCode query parameter required" }, 400);
  }

  const { db, close } = createDb(dbUrl);
  try {
    const vendor = await bindVendorFirebaseUid(db, vendorCode, firebaseUser.uid, firebaseUser.email);
    return c.json({ ok: true, vendor });
  } catch (err) {
    if (err instanceof VendorError) {
      return c.json({ error: err.message }, err.status);
    }
    throw err;
  } finally {
    await close();
  }
}
