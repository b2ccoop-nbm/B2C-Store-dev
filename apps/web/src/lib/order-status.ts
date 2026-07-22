import type { FulfillmentMode, FulfillmentStatus, OrderStatus } from "@b2ccoop/store-shared";

const ORDER_LABELS: Record<OrderStatus, string> = {
  PENDING_DELIVERY: "Awaiting delivery",
  PENDING_PICKUP: "Awaiting pickup",
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  POSTED_TO_LEDGER: "Complete",
  FAILED: "Needs attention",
  CANCELLED: "Cancelled",
};

const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  pending: "New order",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

export function orderStatusLabel(status: OrderStatus | string): string {
  return ORDER_LABELS[status as OrderStatus] ?? status;
}

export function fulfillmentStatusLabel(status: FulfillmentStatus | string): string {
  return FULFILLMENT_LABELS[status as FulfillmentStatus] ?? status;
}

export function nextFulfillmentActionLabel(
  mode: FulfillmentMode,
  nextStatus: FulfillmentStatus,
): string {
  if (mode === "merchant_pickup") {
    switch (nextStatus) {
      case "packed":
        return "Mark ready for pickup";
      case "delivered":
        return "Mark picked up";
      default:
        return fulfillmentStatusLabel(nextStatus);
    }
  }

  switch (nextStatus) {
    case "packed":
      return "Mark packed";
    case "out_for_delivery":
      return "Mark out for delivery";
    case "delivered":
      return "Mark delivered";
    default:
      return fulfillmentStatusLabel(nextStatus);
  }
}
