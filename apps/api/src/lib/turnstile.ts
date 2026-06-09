import type { WorkerEnv } from "../env";

type TurnstileResult = { ok: true } | { ok: false; error: string };

export function turnstileRequired(env: WorkerEnv): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

export async function verifyTurnstile(
  env: WorkerEnv,
  token: string | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  if (!turnstileRequired(env)) {
    return { ok: true };
  }

  if (!token?.trim()) {
    return { ok: false, error: "Turnstile verification required" };
  }

  const secret = env.TURNSTILE_SECRET_KEY!.trim();
  const body = new URLSearchParams({ secret, response: token.trim() });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) {
      return { ok: true };
    }
    const codes = data["error-codes"]?.join(", ") ?? "verification failed";
    return { ok: false, error: `Turnstile failed: ${codes}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Turnstile unreachable: ${msg}` };
  }
}
