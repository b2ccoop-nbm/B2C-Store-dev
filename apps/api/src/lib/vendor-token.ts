/** Per-vendor API access tokens — plaintext shown once on issuance; only hash stored. */

const TOKEN_PREFIX = "b2c_vt_";

export function generateVendorToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${TOKEN_PREFIX}${hex}`;
}

export async function hashVendorToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isVendorTokenFormat(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX) && token.length > TOKEN_PREFIX.length + 16;
}
