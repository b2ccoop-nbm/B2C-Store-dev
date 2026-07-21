import type { WorkerEnv } from "../env";

/** Public base for product images (Worker /media proxy — avoids r2.dev DNS issues). */
export function resolvePublicImagesBaseUrl(env: WorkerEnv): string | null {
  const base = env.PUBLIC_IMAGES_BASE_URL?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

/** Map stored URL (legacy r2.dev or current) to the public media URL. */
export function resolvePublicImageUrl(env: WorkerEnv, stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;
  const mediaBase = resolvePublicImagesBaseUrl(env);
  if (!mediaBase) return stored;

  const r2Key = stored.match(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\/(.+)$/i)?.[1];
  if (r2Key) return `${mediaBase}/${r2Key}`;

  if (stored.startsWith(`${mediaBase}/`)) return stored;

  return stored;
}
