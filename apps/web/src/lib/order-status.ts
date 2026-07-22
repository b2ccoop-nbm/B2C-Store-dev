import type { OrderStatus } from "@b2ccoop/store-shared";

const LABELS: Record<OrderStatus, string> = {
  PENDING_DELIVERY: "Out for delivery",
  PENDING_PICKUP: "Ready for pickup",
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  POSTED_TO_LEDGER: "Complete",
  FAILED: "Needs attention",
  CANCELLED: "Cancelled",
};

export function orderStatusLabel(status: OrderStatus | string): string {
  return LABELS[status as OrderStatus] ?? status;
}
