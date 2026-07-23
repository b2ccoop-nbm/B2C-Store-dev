import { getFirebaseIdToken, isMemberAuthConfigured, waitForMemberAuth } from "@/lib/member-auth";
import { auth } from "@/lib/firebase";

const VENDOR_KEY = "b2c_merchant_vendor";
const TOKEN_KEY = "b2c_merchant_token";
/** @deprecated Legacy dev staff secret — use member SSO or per-vendor token instead */
const LEGACY_SECRET_KEY = "b2c_merchant_secret";
const EMAIL_KEY = "b2c_merchant_email";

export type MerchantVendorInfo = {
  code: string;
  slug: string;
  name: string;
};

export type MerchantSessionInfo = MerchantVendorInfo & {
  authMode?: "firebase_sso" | "vendor_token" | "dev_admin";
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

/** True when a saved vendor token or signed-in member may access seller tools. */
export function hasMerchantSession(): boolean {
  const token = getMerchantToken();
  if (token && isVendorAccessToken(token)) return true;
  if (token && getMerchantVendorCode()) return true;
  return Boolean(auth?.currentUser);
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

async function resolveMerchantAuthorization(): Promise<string | null> {
  if (isMemberAuthConfigured()) {
    const user = await waitForMemberAuth();
    if (user) {
      try {
        return await user.getIdToken();
      } catch {
        return null;
      }
    }
  }

  const token = getMerchantToken();
  return token || null;
}

function legacyVendorCodeHeader(authorization: string): Record<string, string> {
  const vendorCode = getMerchantVendorCode();
  if (!vendorCode) return {};
  if (isVendorAccessToken(authorization)) return {};
  if (authorization.startsWith("eyJ")) return {};
  return { "X-Vendor-Code": vendorCode };
}

export async function merchantHeaders(): Promise<HeadersInit> {
  const authorization = await resolveMerchantAuthorization();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authorization) {
    headers.Authorization = `Bearer ${authorization}`;
    Object.assign(headers, legacyVendorCodeHeader(authorization));
  }
  return headers;
}

/** Bearer auth only — for multipart uploads (do not set Content-Type). */
export async function merchantAuthHeaders(): Promise<HeadersInit> {
  const authorization = await resolveMerchantAuthorization();
  if (!authorization) return {};
  return {
    Authorization: `Bearer ${authorization}`,
    ...legacyVendorCodeHeader(authorization),
  };
}

/** Whether the current member or saved token can call merchant APIs. */
export async function hasMerchantAccess(apiBase: string): Promise<boolean> {
  const authorization = await resolveMerchantAuthorization();
  if (!authorization) return false;

  try {
    const res = await fetch(`${apiBase}/merchant/session`, {
      headers: {
        Authorization: `Bearer ${authorization}`,
        ...legacyVendorCodeHeader(authorization),
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Validate bearer credentials with API and return vendor identity. */
export async function validateMerchantSession(
  apiBase: string,
  accessToken?: string,
): Promise<MerchantSessionInfo> {
  const token = accessToken?.trim() || (await resolveMerchantAuthorization());
  if (!token) {
    throw new Error("Sign in with your member account to manage your store");
  }

  const res = await fetch(`${apiBase}/merchant/session`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...legacyVendorCodeHeader(token),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Invalid merchant session");
  }
  return data.vendor as MerchantSessionInfo;
}

/** @deprecated Prefer validateMerchantSession — validates pasted vendor tokens only. */
export async function validateMerchantToken(
  apiBase: string,
  accessToken: string,
): Promise<MerchantVendorInfo> {
  return validateMerchantSession(apiBase, accessToken);
}
