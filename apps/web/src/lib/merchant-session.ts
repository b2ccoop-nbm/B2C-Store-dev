const VENDOR_KEY = "b2c_merchant_vendor";
const SECRET_KEY = "b2c_merchant_secret";
const EMAIL_KEY = "b2c_merchant_email";

export function getMerchantVendorCode(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(VENDOR_KEY)?.trim() ?? "";
}

export function getMerchantSecret(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(SECRET_KEY)?.trim() ?? "";
}

export function getMerchantEmail(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(EMAIL_KEY)?.trim() ?? "";
}

export function saveMerchantSession(vendorCode: string, secret: string, email?: string): void {
  localStorage.setItem(VENDOR_KEY, vendorCode.trim());
  localStorage.setItem(SECRET_KEY, secret.trim());
  if (email) localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
}

export function clearMerchantSession(): void {
  localStorage.removeItem(VENDOR_KEY);
  localStorage.removeItem(SECRET_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function merchantHeaders(): HeadersInit {
  const secret = getMerchantSecret();
  const vendorCode = getMerchantVendorCode();
  return {
    Authorization: `Bearer ${secret}`,
    "X-Vendor-Code": vendorCode,
    "Content-Type": "application/json",
  };
}
