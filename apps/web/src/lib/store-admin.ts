import { getFirebaseIdToken, isMemberAuthConfigured } from "@/lib/member-auth";

/** Designated merchant approvers (must match API MERCHANT_APPROVER_EMAILS default). */
export const MERCHANT_APPROVER_LABELS: Record<string, string> = {
  "b2ccoop@gmail.com": "Admin",
  "nmatunog@gmail.com": "BOD Chairperson",
};

export const MERCHANT_APPROVER_EMAILS = Object.keys(MERCHANT_APPROVER_LABELS);

const ADMIN_SECRET_KEY = "b2c_admin_secret";

export type StoreAdminSession = {
  ok: boolean;
  email: string;
  label: string;
  mode: "firebase" | "dev_secret";
};

export function isDevBuild(): boolean {
  return import.meta.env.DEV;
}

export function persistDevAdminSecret(secret: string): void {
  if (secret) sessionStorage.setItem(ADMIN_SECRET_KEY, secret);
}

export function restoreDevAdminSecret(input: HTMLInputElement | null): void {
  if (!input) return;
  const stored = sessionStorage.getItem(ADMIN_SECRET_KEY);
  if (stored && !input.value) input.value = stored;
}

export function getDevAdminSecretFromStorage(): string {
  return sessionStorage.getItem(ADMIN_SECRET_KEY)?.trim() ?? "";
}

export async function resolveAdminAuthHeaders(
  devSecretInput?: string,
): Promise<HeadersInit | null> {
  const firebaseToken = await getFirebaseIdToken();
  if (firebaseToken) {
    return { Authorization: `Bearer ${firebaseToken}` };
  }

  const secret = (devSecretInput ?? getDevAdminSecretFromStorage()).trim();
  if (secret && isDevBuild()) {
    return { Authorization: `Bearer ${secret}` };
  }

  return null;
}

export async function fetchStoreAdminSession(
  apiBase: string,
  devSecretInput?: string,
): Promise<StoreAdminSession | null> {
  const headers = await resolveAdminAuthHeaders(devSecretInput);
  if (!headers) return null;

  const res = await fetch(`${apiBase}/admin/session`, { headers });
  if (!res.ok) return null;
  return res.json() as Promise<StoreAdminSession>;
}

export function isMemberSignInAvailable(): boolean {
  return isMemberAuthConfigured();
}
