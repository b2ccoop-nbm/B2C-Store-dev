import type { MerchantListing, StorefrontResponse } from "@b2ccoop/store-shared";
import { API_BASE } from "@/lib/api";

export type SellerApplicationRecord = {
  applicationId: string;
  applicantEmail: string;
  businessName: string;
  businessType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  proposedVendorCode: string | null;
  reviewNotes: string | null;
  vendor?: { code: string; slug: string; name: string } | null;
};

export async function fetchSellerApplication(
  email: string,
  apiBase = API_BASE,
): Promise<SellerApplicationRecord | null> {
  const res = await fetch(`${apiBase}/seller/applications?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error(`Application lookup failed (${res.status})`);
  const data = await res.json();
  if (!data.found) return null;
  return data.application as SellerApplicationRecord;
}

export async function fetchStorefront(slug: string, apiBase = API_BASE): Promise<StorefrontResponse> {
  const res = await fetch(`${apiBase}/storefront/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Store not found" : `Storefront unavailable (${res.status})`);
  }
  return res.json() as Promise<StorefrontResponse>;
}

export type PendingOrder = {
  orderId: string;
  externalId: string;
  guestEmail: string | null;
  vendorCode: string;
  grossAmount: string;
  createdAt: string;
};

export type MerchantListingsResponse = {
  count: number;
  listings: MerchantListing[];
};
