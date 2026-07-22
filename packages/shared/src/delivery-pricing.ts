import type { PlatformCommerceSettings } from "./schemas";

export type DeliveryLineInput = {
  quantity: number;
  /** Effective per-item delivery rate in PHP. */
  deliveryPerItem: string;
};

export type OrderDeliveryResult = {
  lineDeliveryFees: string[];
  deliverySubtotal: string;
  deliveryFee: string;
  capApplied: boolean;
};

/** Sum per-line delivery (rate × qty) and apply platform order cap. */
export function computeOrderDeliveryFees(
  platform: PlatformCommerceSettings,
  lines: DeliveryLineInput[],
): OrderDeliveryResult {
  const lineDeliveryFees = lines.map((line) => {
    const rate = Number(line.deliveryPerItem);
    const qty = line.quantity;
    const fee = Number.isFinite(rate) && rate >= 0 && qty > 0 ? rate * qty : 0;
    return fee.toFixed(2);
  });

  const deliverySubtotal = lineDeliveryFees.reduce((sum, fee) => sum + Number(fee), 0);
  const cap = Number(platform.maxDeliveryPerOrder);
  const capped = Number.isFinite(cap) && cap >= 0 ? Math.min(deliverySubtotal, cap) : deliverySubtotal;

  return {
    lineDeliveryFees,
    deliverySubtotal: deliverySubtotal.toFixed(2),
    deliveryFee: capped.toFixed(2),
    capApplied: deliverySubtotal > capped + 0.001,
  };
}

export function sumMoney(a: string, b: string): string {
  return (Number(a) + Number(b)).toFixed(2);
}
