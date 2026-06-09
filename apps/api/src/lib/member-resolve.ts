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

async function resolveFromWebApp(
  email: string,
  env: WorkerEnv,
): Promise<MemberResolve | null> {
  const base = env.WEBAPP_API_URL?.trim();
  const secret = env.WEBAPP_INTEGRATION_SECRET?.trim();
  if (!base || !secret) {
    return null;
  }

  const url = new URL(`${base.replace(/\/$/, "")}/integrations/v1/members/resolve`);
  url.searchParams.set("email", email);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.status === 404) {
      return { participantId: null };
    }
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as {
      participantId?: string | null;
      memberIdNo?: string;
      fullName?: string;
      displayName?: string;
    };
    return {
      participantId: body.participantId ?? null,
      memberIdNo: body.memberIdNo,
      displayName: body.fullName ?? body.displayName,
    };
  } catch {
    return null;
  }
}

/** Dev fixtures first, then WebApp resolve API when configured. */
export async function resolveMemberByEmail(
  email: string,
  env: WorkerEnv,
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

  const fromWebApp = await resolveFromWebApp(normalized, env);
  if (fromWebApp) {
    return fromWebApp;
  }

  return { participantId: null };
}
