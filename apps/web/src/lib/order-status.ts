import type { OrderStatus } from "@b2ccoop/store-shared";

const LABELS: Record<OrderStatus, string> = {
  PENDING_PICKUP: "Pay at pickup",
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  POSTED_TO_LEDGER: "Complete",
  FAILED: "Needs attention",
  CANCELLED: "Cancelled",
};

export function orderStatusLabel(status: OrderStatus | string): string {
  return LABELS[status as OrderStatus] ?? status;
}
