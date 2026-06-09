import type { WorkerEnv } from "../env";

export type MarketplaceSalePayload = {
  externalId: string;
  occurredAt: string;
  currency: string;
  grossAmount: number;
  salesAmount: number;
  vendorPayableAmount: number;
  cogsAmount?: number;
  patronageAmount?: number;
  vendorCode: string;
  buyerParticipantId?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
};

export type MarketplaceSaleResult = {
  ok: boolean;
  created: boolean;
  error?: string;
  body?: unknown;
};

function isConfigured(env: WorkerEnv): boolean {
  return Boolean(
    env.ACCOUNTING_API_URL?.trim() && env.ACCOUNTING_INTEGRATION_SECRET?.trim(),
  );
}

export async function postMarketplaceSale(
  env: WorkerEnv,
  payload: MarketplaceSalePayload,
): Promise<MarketplaceSaleResult> {
  if (!isConfigured(env)) {
    return {
      ok: false,
      created: false,
      error: "Accounting not configured (ACCOUNTING_API_URL + ACCOUNTING_INTEGRATION_SECRET)",
    };
  }

  const base = env.ACCOUNTING_API_URL!.replace(/\/$/, "");
  const secret = env.ACCOUNTING_INTEGRATION_SECRET!;

  try {
    const res = await fetch(`${base}/api/v1/finance/marketplace-sale`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* plain text */
    }

    if (!res.ok) {
      const msg =
        typeof body === "object" && body && "message" in body
          ? String((body as { message: unknown }).message)
          : text.slice(0, 200);
      return { ok: false, created: false, error: msg || `HTTP ${res.status}`, body };
    }

    return { ok: true, created: res.status === 201, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, created: false, error: msg };
  }
}
