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

export type ProvisionVendorPayload = {
  code: string;
  name: string;
  email?: string;
};

export type ProvisionVendorResult = {
  ok: boolean;
  created?: boolean;
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
    const hint =
      /fetch failed|network|connection|ECONNREFUSED/i.test(msg)
        ? ` — is Accounting running at ${base}?`
        : "";
    return { ok: false, created: false, error: `${msg}${hint}` };
  }
}

export async function provisionAccountingVendor(
  env: WorkerEnv,
  payload: ProvisionVendorPayload,
): Promise<ProvisionVendorResult> {
  if (!isConfigured(env)) {
    return {
      ok: false,
      error: "Accounting not configured (ACCOUNTING_API_URL + ACCOUNTING_INTEGRATION_SECRET)",
    };
  }

  const base = env.ACCOUNTING_API_URL!.replace(/\/$/, "");
  const secret = env.ACCOUNTING_INTEGRATION_SECRET!;

  try {
    const res = await fetch(`${base}/api/v1/finance/vendors`, {
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
      return { ok: false, error: msg || `HTTP ${res.status}`, body };
    }

    const created =
      typeof body === "object" && body && "status" in body
        ? (body as { status?: string }).status === "created"
        : res.status === 201;

    return { ok: true, created, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
