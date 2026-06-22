import type { Context } from "hono";
import { listMerchantApprovers } from "../lib/merchant-approvers";
import type { StoreAdminVariables } from "../middleware/store-admin-auth";
import type { WorkerEnv } from "../env";

export async function getAdminSession(
  c: Context<{ Bindings: WorkerEnv; Variables: StoreAdminVariables }>,
) {
  const email = c.get("storeAdminEmail");
  const mode = c.get("storeAdminMode");
  const approvers = listMerchantApprovers(c.env);

  return c.json({
    ok: true,
    email,
    mode,
    label:
      email === "dev-admin"
        ? "Dev staff secret"
        : (approvers.find((a) => a.email === email)?.label ?? "Approver"),
    approvers,
  });
}
