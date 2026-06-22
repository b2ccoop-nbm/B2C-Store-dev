import type { Context, Next } from "hono";
import { verifyFirebaseIdToken } from "../lib/firebase-auth";
import { isMerchantApproverEmail } from "../lib/merchant-approvers";
import type { WorkerEnv } from "../env";

export type StoreAdminVariables = {
  storeAdminEmail: string;
  storeAdminMode: "firebase" | "dev_secret";
};

export function storeAdminAuth() {
  return async (
    c: Context<{ Bindings: WorkerEnv; Variables: StoreAdminVariables }>,
    next: Next,
  ) => {
    const header = c.req.header("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const firebaseUser = await verifyFirebaseIdToken(c.env, token);
    if (firebaseUser) {
      if (!isMerchantApproverEmail(firebaseUser.email, c.env)) {
        return c.json(
          {
            error: "Not authorized for store admin",
            email: firebaseUser.email,
          },
          403,
        );
      }
      c.set("storeAdminEmail", firebaseUser.email);
      c.set("storeAdminMode", "firebase");
      await next();
      return;
    }

    const expected = c.env.DEV_ADMIN_SECRET?.trim();
    if (expected && token === expected) {
      c.set("storeAdminEmail", "dev-admin");
      c.set("storeAdminMode", "dev_secret");
      await next();
      return;
    }

    return c.json({ error: "Unauthorized" }, 401);
  };
}
