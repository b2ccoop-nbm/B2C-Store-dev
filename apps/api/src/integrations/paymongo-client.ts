import type { WorkerEnv } from "../env";

export type PaymongoCheckoutLine = {
  name: string;
  amountCentavos: number;
  quantity: number;
};

export type PaymongoCheckoutResult =
  | { ok: true; sessionId: string; checkoutUrl: string }
  | { ok: false; error: string };

function isConfigured(env: WorkerEnv): boolean {
  return Boolean(env.PAYMONGO_SECRET_KEY?.trim());
}

export function paymongoConfigured(env: WorkerEnv): boolean {
  return isConfigured(env);
}

export async function createPaymongoCheckoutSession(
  env: WorkerEnv,
  input: {
    referenceNumber: string;
    lineItems: PaymongoCheckoutLine[];
    successUrl: string;
    cancelUrl: string;
    description?: string;
  },
): Promise<PaymongoCheckoutResult> {
  if (!isConfigured(env)) {
    return {
      ok: false,
      error: "PayMongo not configured (PAYMONGO_SECRET_KEY)",
    };
  }

  const secret = env.PAYMONGO_SECRET_KEY!.trim();
  const auth = btoa(`${secret}:`);

  const body = {
    data: {
      attributes: {
        line_items: input.lineItems.map((item) => ({
          name: item.name,
          amount: item.amountCentavos,
          currency: "PHP",
          quantity: item.quantity,
        })),
        payment_method_types: ["card", "gcash", "grab_pay", "paymaya", "qrph"],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference_number: input.referenceNumber,
        description: input.description,
      },
    },
  };

  try {
    const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: unknown = text;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* plain text */
    }

    if (!res.ok) {
      const msg =
        typeof json === "object" && json && "errors" in json
          ? JSON.stringify((json as { errors: unknown }).errors).slice(0, 200)
          : text.slice(0, 200);
      return { ok: false, error: msg || `PayMongo HTTP ${res.status}` };
    }

    const data = json as {
      data?: {
        id?: string;
        attributes?: { checkout_url?: string };
      };
    };
    const sessionId = data.data?.id;
    const checkoutUrl = data.data?.attributes?.checkout_url;
    if (!sessionId || !checkoutUrl) {
      return { ok: false, error: "PayMongo response missing checkout URL" };
    }

    return { ok: true, sessionId, checkoutUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify Paymongo-Signature header (t=..., te=..., li=...). */
export async function verifyPaymongoWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  webhookSecret: string,
  liveMode: boolean,
): Promise<boolean> {
  if (!signatureHeader?.trim() || !webhookSecret.trim()) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.trim().split("=");
      return [key, value ?? ""];
    }),
  ) as Record<string, string>;

  const timestamp = parts.t;
  const expectedSig = liveMode ? parts.li : parts.te;
  if (!timestamp || !expectedSig) {
    return false;
  }

  const payload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret.trim()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = bytesToHex(new Uint8Array(sig));

  if (computed.length !== expectedSig.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return mismatch === 0;
}
