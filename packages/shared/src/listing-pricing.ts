import type { DeliveryTier, PlatformCommerceSettings, SellerKind } from "./schemas";

export type { DeliveryTier, SellerKind } from "./schemas";

export const DEFAULT_PLATFORM_COMMERCE: PlatformCommerceSettings = {
  defaultDeliveryPerItem: "50.00",
  maxDeliveryPerOrder: "500.00",
  defaultPartnerListingFeePercent: "10.00",
  patronageRatePercent: "8.00",
};

export type ListingPricingInput = {
  srp: number;
  sellerKind: SellerKind;
  listingFeePercent?: number | null;
  platform: PlatformCommerceSettings;
  patronageEligible?: boolean;
};

export type ListingPricingResult = {
  unitPrice: string;
  salesPerUnit: string;
  vendorPayablePerUnit: string;
  patronagePerUnit: string;
  listingFeePercent: string;
  patronageEligible: boolean;
  coopRevenuePerUnit: string;
};

function clampPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Compute coop revenue splits from SRP and seller kind. Patronage is based on coop revenue capture. */
export function computeListingPricing(input: ListingPricingInput): ListingPricingResult {
  const srp = input.srp;
  if (!Number.isFinite(srp) || srp <= 0) {
    throw new Error("SRP must be a positive number");
  }

  let coopRevenue: number;
  let vendorPayable: number;
  let listingFeePercent: number;

  if (input.sellerKind === "PARTNER") {
    listingFeePercent = clampPercent(
      input.listingFeePercent ?? Number(input.platform.defaultPartnerListingFeePercent),
      0,
      100,
    );
    coopRevenue = (srp * listingFeePercent) / 100;
    vendorPayable = srp - coopRevenue;
  } else if (input.sellerKind === "COOP") {
    listingFeePercent = 0;
    coopRevenue = srp * 0.85;
    vendorPayable = srp - coopRevenue;
  } else {
    listingFeePercent = 0;
    coopRevenue = srp * 0.25;
    vendorPayable = srp - coopRevenue;
  }

  const patronageEligible = input.patronageEligible ?? true;
  const patronageRate = Number(input.platform.patronageRatePercent) / 100;
  const patronagePerUnit = patronageEligible && Number.isFinite(patronageRate)
    ? coopRevenue * patronageRate
    : 0;

  return {
    unitPrice: srp.toFixed(2),
    salesPerUnit: coopRevenue.toFixed(2),
    vendorPayablePerUnit: vendorPayable.toFixed(2),
    patronagePerUnit: patronagePerUnit.toFixed(2),
    listingFeePercent: listingFeePercent.toFixed(2),
    patronageEligible,
    coopRevenuePerUnit: coopRevenue.toFixed(2),
  };
}

const DELIVERY_TIER_MULTIPLIER: Record<DeliveryTier, number> = {
  standard: 1,
  bulky: 2,
  remote: 3,
};

/** Resolve per-item delivery rate using product → vendor → tier → platform default. */
export function effectiveDeliveryPerItem(
  platform: PlatformCommerceSettings,
  tier: DeliveryTier,
  vendorDeliveryPerItem?: string | null,
  productDeliveryPerItem?: string | null,
): string {
  if (productDeliveryPerItem != null && productDeliveryPerItem !== "") {
    return Number(productDeliveryPerItem).toFixed(2);
  }
  if (vendorDeliveryPerItem != null && vendorDeliveryPerItem !== "") {
    return Number(vendorDeliveryPerItem).toFixed(2);
  }
  const base = Number(platform.defaultDeliveryPerItem);
  const rate = base * DELIVERY_TIER_MULTIPLIER[tier];
  return rate.toFixed(2);
}

export function inferSellerKindFromVendorCode(vendorCode: string): SellerKind {
  return vendorCode.trim().toUpperCase().startsWith("B2C-") ? "COOP" : "MEMBER";
}
