import { DEV_SHOPPERS } from "../db/seed-dev-fixtures";
import type { WorkerEnv } from "../env";

export type MemberResolve = {
  participantId: string | null;
  memberIdNo?: string;
  displayName?: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Dev: map known test emails. Phase 1d: call WebApp resolve API. */
export async function resolveMemberByEmail(
  email: string,
  _env: WorkerEnv,
): Promise<MemberResolve> {
  const normalized = normalizeEmail(email);
  const dev = DEV_SHOPPERS.find((s) => normalizeEmail(s.email) === normalized);
  if (dev) {
    return {
      participantId: dev.participantId ?? null,
      memberIdNo: dev.memberIdNo,
      displayName: dev.displayName,
    };
  }
  return { participantId: null };
}
