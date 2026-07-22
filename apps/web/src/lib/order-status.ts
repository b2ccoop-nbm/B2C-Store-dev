import type { FulfillmentMode, FulfillmentStatus, OrderDetail, OrderStatus } from "@b2ccoop/store-shared";

const ORDER_LABELS: Record<OrderStatus, string> = {
  PENDING_DELIVERY: "Awaiting delivery",
  PENDING_PICKUP: "Awaiting pickup",
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  POSTED_TO_LEDGER: "Complete",
  FAILED: "Needs attention",
  CANCELLED: "Cancelled",
};

const PAYMENT_METHOD_LABELS = {
  pickup: "Pay on delivery / pickup",
  online: "Pay online (PayMongo)",
} as const;

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

export function paymentMethodLabel(method: "pickup" | "online" | string | undefined): string {
  if (method === "online") return PAYMENT_METHOD_LABELS.online;
  return PAYMENT_METHOD_LABELS.pickup;
}

export function orderStatusBadgeLabel(order: OrderDetail): string {
  if (order.status === "PENDING_PAYMENT") return "Pay online";
  return orderStatusLabel(order.status);
}

export function orderReceiptMessage(order: OrderDetail): string {
  if (order.status === "PENDING_PAYMENT") {
    return "Complete payment on PayMongo to confirm your order. GCash, Maya, QR Ph, and cards are accepted.";
  }
  if (order.status === "PENDING_DELIVERY") {
    return order.paidOnline
      ? "Payment received — your order will be delivered to the address below."
      : "Your order will be delivered to the address below. Pay when it arrives.";
  }
  if (order.status === "PENDING_PICKUP") {
    return order.paidOnline
      ? "Payment received — pick up from the seller when your order is ready."
      : "Pick up from the seller and pay when you collect your order.";
  }
  if (order.status === "POSTED_TO_LEDGER") {
    return order.paidOnline
      ? "Payment received and recorded. Thank you for shopping with your coop."
      : "Payment recorded. Thank you for shopping with your coop.";
  }
  if (order.status === "FAILED") {
    return "Payment was received but confirmation could not be completed — staff can retry below.";
  }
  return "Order status updates will appear here.";
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
