/** One-time status lookup tokens — plaintext returned on application submit; only hash stored. */

const STATUS_PREFIX = "b2c_st_";

export function generateStatusAccessToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${STATUS_PREFIX}${hex}`;
}

export function isStatusAccessToken(token: string): boolean {
  return token.startsWith(STATUS_PREFIX) && token.length > STATUS_PREFIX.length + 16;
}

export async function hashStatusAccessToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
