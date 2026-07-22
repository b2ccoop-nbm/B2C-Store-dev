import type { FulfillmentMode, FulfillmentStatus } from "@b2ccoop/store-shared";
import { API_BASE } from "@/lib/api";
import { fulfillmentStatusLabel, nextFulfillmentActionLabel } from "@/lib/order-status";
import { merchantHeaders } from "@/lib/merchant-session";

type PendingOrder = {
  orderId: string;
  externalId: string;
  guestEmail: string | null;
  vendorCode: string;
  status: string;
  fulfillmentMode: FulfillmentMode;
  fulfillmentStatus: FulfillmentStatus;
  grossAmount: string;
  deliveryFeeAmount: string;
  totalAmount: string;
  createdAt: string;
  deliveryCity?: string | null;
  deliveryPhone?: string | null;
};

function nextFulfillmentStatus(
  mode: FulfillmentMode,
  current: FulfillmentStatus,
): FulfillmentStatus | null {
  switch (current) {
    case "pending":
      return "packed";
    case "packed":
      return mode === "merchant_pickup" ? "delivered" : "out_for_delivery";
    case "out_for_delivery":
      return "delivered";
    default:
      return null;
  }
}

function canConfirmPayment(order: PendingOrder): boolean {
  if (order.fulfillmentMode === "merchant_pickup") return true;
  return order.fulfillmentStatus === "delivered";
}

export function setupMerchantQueue(apiBase = API_BASE): void {
  const loadBtn = document.getElementById("load-merchant-orders");
  const list = document.getElementById("merchant-order-list");
  const loadError = document.getElementById("merchant-load-error");
  const vendorLabel = document.getElementById("merchant-vendor-label");

  async function advanceFulfillment(orderId: string, status: FulfillmentStatus) {
    const res = await fetch(`${apiBase}/merchant/orders/${orderId}/fulfillment`, {
      method: "PATCH",
      headers: { ...merchantHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Update failed");
    return data;
  }

  async function confirmOrder(orderId: string) {
    const res = await fetch(`${apiBase}/merchant/orders/${orderId}/confirm`, {
      method: "PATCH",
      headers: merchantHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Confirm failed");
    return data;
  }

  function renderOrder(o: PendingOrder): string {
    const next = nextFulfillmentStatus(o.fulfillmentMode, o.fulfillmentStatus);
    const modeLabel = o.fulfillmentMode === "delivery" ? "Delivery" : "Pickup";
    const deliveryMeta =
      o.fulfillmentMode === "delivery" && (o.deliveryCity || o.deliveryPhone)
        ? `<p class="text-caption text-neutral-500 m-0 mt-1">${[o.deliveryCity, o.deliveryPhone].filter(Boolean).join(" · ")}</p>`
        : "";
    const advanceBtn =
      next !== null
        ? `<button type="button" class="b2c-merchant-advance touch-target min-h-10 px-4 rounded-lg border border-merchant-600 text-merchant-700 bg-white text-body-sm font-semibold cursor-pointer" data-id="${o.orderId}" data-next="${next}">
            ${nextFulfillmentActionLabel(o.fulfillmentMode, next)}
          </button>`
        : "";
    const confirmDisabled = canConfirmPayment(o) ? "" : "disabled";
    const confirmHint =
      o.fulfillmentMode === "delivery" && o.fulfillmentStatus !== "delivered"
        ? `<p class="text-caption text-neutral-500 m-0">Mark delivered before confirming payment.</p>`
        : "";

    return `
      <article class="elevation-1 p-4" data-order-id="${o.orderId}">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-caption text-neutral-500 m-0">${modeLabel} · ${fulfillmentStatusLabel(o.fulfillmentStatus)}</p>
            <p class="text-price m-0 text-brand-600 mt-1">₱${Number(o.totalAmount).toFixed(2)}</p>
            <p class="text-caption text-neutral-500 m-0 mt-1">Merchandise ₱${Number(o.grossAmount).toFixed(2)}${Number(o.deliveryFeeAmount) > 0 ? ` · Delivery ₱${Number(o.deliveryFeeAmount).toFixed(2)}` : ""}</p>
            <p class="text-body-sm m-0 mt-1">${o.guestEmail ?? "Guest"}</p>
            ${deliveryMeta}
            <p class="text-caption text-neutral-500 m-0 mt-1 font-mono">${o.externalId}</p>
          </div>
          <div class="flex flex-col gap-2 items-stretch min-w-[10rem]">
            <a href="/order/${o.orderId}" class="text-body-sm font-semibold text-brand-600 text-center">Receipt →</a>
            ${advanceBtn}
            ${confirmHint}
            <button type="button" class="b2c-merchant-confirm touch-target min-h-10 px-4 rounded-lg bg-merchant-600 text-white text-body-sm font-semibold border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" data-id="${o.orderId}" ${confirmDisabled}>
              Confirm payment
            </button>
          </div>
        </div>
        <p class="hidden text-body-sm mt-2 m-0 b2c-merchant-msg" role="status"></p>
      </article>`;
  }

  function wireOrderActions(root: ParentNode) {
    root.querySelectorAll(".b2c-merchant-advance").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const next = btn.getAttribute("data-next") as FulfillmentStatus | null;
        if (!id || !next) return;
        const card = btn.closest("[data-order-id]");
        const msg = card?.querySelector(".b2c-merchant-msg");
        if (btn instanceof HTMLButtonElement) btn.disabled = true;
        try {
          await advanceFulfillment(id, next);
          if (msg) {
            msg.textContent = `Updated — ${fulfillmentStatusLabel(next)}`;
            msg.className = "text-body-sm mt-2 m-0 text-success-600 b2c-merchant-msg";
            msg.classList.remove("hidden");
          }
          setTimeout(() => loadBtn?.click(), 800);
        } catch (err) {
          if (msg) {
            msg.textContent = err instanceof Error ? err.message : "Failed";
            msg.className = "text-body-sm mt-2 m-0 text-danger-600 b2c-merchant-msg";
            msg.classList.remove("hidden");
          }
          if (btn instanceof HTMLButtonElement) btn.disabled = false;
        }
      });
    });

    root.querySelectorAll(".b2c-merchant-confirm").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        const card = btn.closest("[data-order-id]");
        const msg = card?.querySelector(".b2c-merchant-msg");
        if (btn instanceof HTMLButtonElement) btn.disabled = true;
        try {
          const result = await confirmOrder(id);
          if (msg) {
            msg.textContent = `Posted — ${result.status}`;
            msg.className = "text-body-sm mt-2 m-0 text-success-600 b2c-merchant-msg";
            msg.classList.remove("hidden");
          }
          setTimeout(() => loadBtn?.click(), 1000);
        } catch (err) {
          if (msg) {
            msg.textContent = err instanceof Error ? err.message : "Failed";
            msg.className = "text-body-sm mt-2 m-0 text-danger-600 b2c-merchant-msg";
            msg.classList.remove("hidden");
          }
          if (btn instanceof HTMLButtonElement) btn.disabled = false;
        }
      });
    });
  }

  loadBtn?.addEventListener("click", async () => {
    loadError?.classList.add("hidden");
    if (!list) return;

    try {
      const res = await fetch(`${apiBase}/merchant/orders/pending`, { headers: merchantHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      if (vendorLabel) vendorLabel.textContent = data.vendorCode ?? "";

      if (!data.orders?.length) {
        list.innerHTML =
          "<p class='text-neutral-500 m-0'>No orders waiting for fulfillment for your store.</p>";
        return;
      }

      list.innerHTML = (data.orders as PendingOrder[]).map(renderOrder).join("");
      wireOrderActions(list);
    } catch (err) {
      if (loadError) {
        loadError.textContent = err instanceof Error ? err.message : "Load failed";
        loadError.classList.remove("hidden");
      }
    }
  });
}
