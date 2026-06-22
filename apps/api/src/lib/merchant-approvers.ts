import type { WorkerEnv } from "../env";

/** Default merchant approvers (override with MERCHANT_APPROVER_EMAILS). */
export const DEFAULT_MERCHANT_APPROVER_EMAILS = [
  "b2ccoop@gmail.com",
  "nmatunog@gmail.com",
] as const;

export const MERCHANT_APPROVER_LABELS: Record<string, string> = {
  "b2ccoop@gmail.com": "Admin",
  "nmatunog@gmail.com": "BOD Chairperson",
};

export function parseMerchantApproverEmails(env: WorkerEnv): Set<string> {
  const raw = env.MERCHANT_APPROVER_EMAILS?.trim();
  if (raw) {
    return new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return new Set(DEFAULT_MERCHANT_APPROVER_EMAILS);
}

export function isMerchantApproverEmail(email: string, env: WorkerEnv): boolean {
  return parseMerchantApproverEmails(env).has(email.trim().toLowerCase());
}

export function listMerchantApprovers(env: WorkerEnv): Array<{ email: string; label: string }> {
  return [...parseMerchantApproverEmails(env)].sort().map((email) => ({
    email,
    label: MERCHANT_APPROVER_LABELS[email] ?? "Approver",
  }));
}
