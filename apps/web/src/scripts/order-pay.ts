import type { OrderDetail } from "@b2ccoop/store-shared";

export function setupOrderPay(
  apiBase: string,
  orderId: string,
  options: { awaitingReturn?: boolean } = {},
): void {
  const payBtn = document.getElementById("order-pay-btn");
  const payMsg = document.getElementById("order-pay-msg");
  const pendingPanel = document.getElementById("order-pending-payment");

  async function redirectToPay(): Promise<void> {
    if (payBtn instanceof HTMLButtonElement) payBtn.disabled = true;
    if (payMsg) payMsg.classList.add("hidden");
    try {
      const res = await fetch(`${apiBase}/orders/${orderId}/pay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start payment");
      if (typeof data.checkoutUrl === "string") {
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error("PayMongo checkout URL missing");
    } catch (err) {
      if (payMsg) {
        payMsg.textContent = err instanceof Error ? err.message : "Payment failed";
        payMsg.className = "text-body-sm mt-3 m-0 text-danger-600";
        payMsg.classList.remove("hidden");
      }
      if (payBtn instanceof HTMLButtonElement) payBtn.disabled = false;
    }
  }

  payBtn?.addEventListener("click", () => void redirectToPay());

  if (options.awaitingReturn && pendingPanel) {
    let attempts = 0;
    const poll = window.setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`${apiBase}/orders/${orderId}`);
        if (!res.ok) return;
        const order = (await res.json()) as OrderDetail;
        if (order.status !== "PENDING_PAYMENT") {
          window.clearInterval(poll);
          window.location.replace(`/order/${orderId}`);
          return;
        }
        if (attempts >= 20) {
          window.clearInterval(poll);
          if (payMsg) {
            payMsg.textContent =
              "Payment is still processing. If you already paid, refresh this page in a moment.";
            payMsg.className = "text-body-sm mt-3 m-0 text-neutral-600";
            payMsg.classList.remove("hidden");
          }
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
  }
}
