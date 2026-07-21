const VENDOR_KEY = "b2c_merchant_vendor";
const TOKEN_KEY = "b2c_merchant_token";
/** @deprecated Legacy dev staff secret — use per-vendor token instead */
const LEGACY_SECRET_KEY = "b2c_merchant_secret";
const EMAIL_KEY = "b2c_merchant_email";

export type MerchantVendorInfo = {
  code: string;
  slug: string;
  name: string;
};

export function isVendorAccessToken(token: string): boolean {
  return token.startsWith("b2c_vt_");
}

export function getMerchantVendorCode(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(VENDOR_KEY)?.trim() ?? "";
}

export function getMerchantToken(): string {
  if (typeof localStorage === "undefined") return "";
  const token = localStorage.getItem(TOKEN_KEY)?.trim();
  if (token) return token;
  // Legacy dev fallback
  return localStorage.getItem(LEGACY_SECRET_KEY)?.trim() ?? "";
}

/** @deprecated Use getMerchantToken */
export function getMerchantSecret(): string {
  return getMerchantToken();
}

export function getMerchantEmail(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(EMAIL_KEY)?.trim() ?? "";
}

export function hasMerchantSession(): boolean {
  const token = getMerchantToken();
  if (!token) return false;
  // Per-vendor tokens encode identity — vendor code is resolved server-side
  if (isVendorAccessToken(token)) return true;
  // Legacy dev staff-secret impersonation still needs explicit vendor code
  return Boolean(getMerchantVendorCode());
}

export function saveMerchantSession(vendorCode: string, accessToken: string, email?: string): void {
  localStorage.setItem(VENDOR_KEY, vendorCode.trim());
  localStorage.setItem(TOKEN_KEY, accessToken.trim());
  localStorage.removeItem(LEGACY_SECRET_KEY);
  if (email) localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
}

export function clearMerchantSession(): void {
  localStorage.removeItem(VENDOR_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_SECRET_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function merchantHeaders(): HeadersInit {
  const token = getMerchantToken();
  const vendorCode = getMerchantVendorCode();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  // Legacy dev staff secret still requires explicit vendor code
  if (vendorCode && !isVendorAccessToken(token)) {
    headers["X-Vendor-Code"] = vendorCode;
  }
  return headers;
}

/** Bearer auth only — for multipart uploads (do not set Content-Type). */
export function merchantAuthHeaders(): HeadersInit {
  const token = getMerchantToken();
  const vendorCode = getMerchantVendorCode();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (vendorCode && !isVendorAccessToken(token)) {
    headers["X-Vendor-Code"] = vendorCode;
  }
  return headers;
}

/** Validate access token with API and return vendor identity. */
export async function validateMerchantToken(
  apiBase: string,
  accessToken: string,
): Promise<MerchantVendorInfo> {
  const res = await fetch(`${apiBase}/merchant/session`, {
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Invalid access token");
  }
  return data.vendor as MerchantVendorInfo;
}
