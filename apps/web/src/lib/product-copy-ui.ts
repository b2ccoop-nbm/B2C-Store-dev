import {
  MAX_PRODUCT_COPY_WORDS,
  countWords,
  productCopyWordLimitError,
  totalProductCopyWords,
} from "@b2ccoop/store-shared";

export { MAX_PRODUCT_COPY_WORDS, countWords, productCopyWordLimitError, totalProductCopyWords };

export function formatProductCopyHint(current: number): string {
  return `${current} / ${MAX_PRODUCT_COPY_WORDS} words combined (description + highlights + features)`;
}

export function validateProductCopy(parts: {
  shortDescription?: string;
  highlights?: string;
  features?: string;
}): string | null {
  const total = totalProductCopyWords(parts);
  if (total > MAX_PRODUCT_COPY_WORDS) {
    return productCopyWordLimitError(total);
  }
  return null;
}
