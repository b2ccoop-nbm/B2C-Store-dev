import type { FulfillmentMode, FulfillmentStatus } from "@b2ccoop/store-shared";
import { API_BASE } from "@/lib/api";
import { fulfillmentStatusLabel, nextFulfillmentActionLabel } from "@/lib/order-status";
import { setupStoreAdminSignIn } from "@/scripts/store-admin-auth";

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

export function setupAdminQueue(apiBase = API_BASE): void {
  const loadBtn = document.getElementById("load-pending");
  const list = document.getElementById("order-list");
  const loadError = document.getElementById("admin-load-error");

  let authHeaders: HeadersInit | null = null;

  function requireAuth(): HeadersInit | null {
    if (!authHeaders) {
      if (loadError) {
        loadError.textContent = "Sign in as a designated merchant approver first.";
        loadError.classList.remove("hidden");
      }
      return null;
    }
    return authHeaders;
  }

  async function advanceFulfillment(orderId: string, status: FulfillmentStatus) {
    const headers = requireAuth();
    if (!headers) throw new Error("Sign in first");
    const res = await fetch(`${apiBase}/admin/orders/${orderId}/fulfillment`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Update failed");
    return data;
  }

  async function confirmOrder(orderId: string) {
    const headers = requireAuth();
    if (!headers) throw new Error("Sign in first");
    const res = await fetch(`${apiBase}/admin/orders/${orderId}/confirm`, {
      method: "PATCH",
      headers,
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
        ? `<button type="button" class="b2c-admin-advance touch-target min-h-10 mt-2 px-4 rounded-lg border border-accent-600 text-accent-700 bg-white text-body-sm font-semibold cursor-pointer" data-id="${o.orderId}" data-next="${next}">
            ${nextFulfillmentActionLabel(o.fulfillmentMode, next)}
          </button>`
        : "";
    const confirmDisabled = canConfirmPayment(o) ? "" : "disabled";

    return `
      <article class="elevation-1 p-4" data-order-id="${o.orderId}">
        <p class="text-body font-semibold m-0">${o.orderId}</p>
        <p class="text-caption text-neutral-500 m-0 mt-1">${modeLabel} · ${fulfillmentStatusLabel(o.fulfillmentStatus)}</p>
        <p class="text-body-sm text-neutral-500 m-0 mt-1">${o.vendorCode} · ₱${Number(o.totalAmount).toFixed(2)}</p>
        ${o.guestEmail ? `<p class="text-caption text-neutral-500 m-0 mt-1">${o.guestEmail}</p>` : ""}
        ${deliveryMeta}
        ${advanceBtn}
        <button type="button" class="b2c-confirm-order touch-target min-h-10 mt-3 px-4 rounded-lg bg-accent-600 text-white text-body-sm font-semibold border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" data-id="${o.orderId}" ${confirmDisabled}>
          Confirm & post to ledger
        </button>
        <p class="hidden text-body-sm mt-2 m-0 b2c-order-msg" role="status"></p>
      </article>`;
  }

  function wireOrderActions(root: ParentNode) {
    root.querySelectorAll(".b2c-admin-advance").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const next = btn.getAttribute("data-next") as FulfillmentStatus | null;
        if (!id || !next) return;
        const card = btn.closest("[data-order-id]");
        const msg = card?.querySelector(".b2c-order-msg");
        if (btn instanceof HTMLButtonElement) btn.disabled = true;
        try {
          await advanceFulfillment(id, next);
          if (msg) {
            msg.textContent = `Updated — ${fulfillmentStatusLabel(next)}`;
            msg.className = "text-body-sm mt-2 m-0 text-success-600 b2c-order-msg";
            msg.classList.remove("hidden");
          }
          setTimeout(() => void loadPending(), 800);
        } catch (err) {
          if (msg) {
            msg.textContent = err instanceof Error ? err.message : "Failed";
            msg.className = "text-body-sm mt-2 m-0 text-danger-600 b2c-order-msg";
            msg.classList.remove("hidden");
          }
          if (btn instanceof HTMLButtonElement) btn.disabled = false;
        }
      });
    });

    root.querySelectorAll(".b2c-confirm-order").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        const card = btn.closest("[data-order-id]");
        const msg = card?.querySelector(".b2c-order-msg");
        if (btn instanceof HTMLButtonElement) btn.disabled = true;
        try {
          await confirmOrder(id);
          if (msg) {
            msg.textContent = "Posted to ledger.";
            msg.className = "text-body-sm mt-2 m-0 text-success-600 b2c-order-msg";
            msg.classList.remove("hidden");
          }
          setTimeout(() => void loadPending(), 1500);
        } catch (err) {
          if (msg) {
            msg.textContent = err instanceof Error ? err.message : "Failed";
            msg.className = "text-body-sm mt-2 m-0 text-danger-600 b2c-order-msg";
            msg.classList.remove("hidden");
          }
          if (btn instanceof HTMLButtonElement) btn.disabled = false;
        }
      });
    });
  }

  async function loadPending() {
    loadError?.classList.add("hidden");
    const headers = requireAuth();
    if (!headers || !list) return;
    list.innerHTML = "<p class='text-neutral-500 m-0'>Loading…</p>";

    try {
      const res = await fetch(`${apiBase}/admin/orders/pending`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      if (!data.orders?.length) {
        list.innerHTML = "<p class='text-neutral-500 m-0'>No orders waiting for fulfillment.</p>";
        return;
      }

      list.innerHTML = (data.orders as PendingOrder[]).map(renderOrder).join("");
      wireOrderActions(list);
    } catch (err) {
      if (loadError) {
        loadError.textContent = err instanceof Error ? err.message : "Load failed";
        loadError.classList.remove("hidden");
      }
      if (list) list.innerHTML = "";
    }
  }

  loadBtn?.addEventListener("click", () => void loadPending());

  setupStoreAdminSignIn(apiBase, (state) => {
    authHeaders = state.headers;
    if (state.headers) void loadPending();
  });
}
