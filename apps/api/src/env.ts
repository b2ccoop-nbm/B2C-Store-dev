export type WorkerEnv = {
  ENVIRONMENT?: string;
  DATABASE_URL?: string;
  /** Cloudflare Hyperdrive binding (production) — Phase 1 */
  HYPERDRIVE?: { connectionString: string };
  FIREBASE_PROJECT_ID?: string;
  WEBAPP_API_URL?: string;
  WEBAPP_INTEGRATION_SECRET?: string;
  ACCOUNTING_API_URL?: string;
  ACCOUNTING_INTEGRATION_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  /** PayMongo secret API key (sk_test_* / sk_live_*) */
  PAYMONGO_SECRET_KEY?: string;
  /** PayMongo webhook signing secret (whsk_*) */
  PAYMONGO_WEBHOOK_SECRET?: string;
  PUBLIC_STORE_URL?: string;
  /** Local dev staff API (Phase 1c) — Bearer token for admin routes */
  DEV_ADMIN_SECRET?: string;
};

export function resolveDatabaseUrl(env: WorkerEnv): string | null {
  if (env.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString;
  }
  const direct = env.DATABASE_URL?.trim();
  return direct || null;
}

export function corsOrigins(env: WorkerEnv): string[] {
  if (env.ENVIRONMENT === "production") {
    return [
      "https://store.b2ccoop.com",
      "https://b2ccoop-store.pages.dev",
    ];
  }
  return ["http://localhost:5175", "http://127.0.0.1:5175"];
}
