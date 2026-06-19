const STATUS_TOKEN_KEY = "b2c_application_status_token";

export function saveApplicationStatusToken(token: string): void {
  localStorage.setItem(STATUS_TOKEN_KEY, token.trim());
}

export function getApplicationStatusToken(): string {
  return localStorage.getItem(STATUS_TOKEN_KEY)?.trim() ?? "";
}

export function clearApplicationStatusToken(): void {
  localStorage.removeItem(STATUS_TOKEN_KEY);
}
