/** Combined word limit for short description + highlights + features. */
export const MAX_PRODUCT_COPY_WORDS = 500;

export const MAX_PRODUCT_GALLERY_IMAGES = 4;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function totalProductCopyWords(parts: {
  shortDescription?: string | null;
  highlights?: string | null;
  features?: string | null;
}): number {
  return (
    countWords(parts.shortDescription ?? "") +
    countWords(parts.highlights ?? "") +
    countWords(parts.features ?? "")
  );
}

export function productCopyWordLimitError(total: number): string {
  return `Product description, highlights, and features combined must be ${MAX_PRODUCT_COPY_WORDS} words or fewer (currently ${total}).`;
}

/** Split stored newline/bullet text into display lines. */
export function parseProductBulletLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}
