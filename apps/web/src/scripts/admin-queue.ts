import { API_BASE } from "@/lib/api";
import { setupStoreAdminSignIn } from "@/scripts/store-admin-auth";

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

  async function confirmPickup(orderId: string) {
    const headers = requireAuth();
    if (!headers) throw new Error("Sign in first");
    const res = await fetch(`${apiBase}/admin/orders/${orderId}/confirm-pickup`, {
      method: "PATCH",
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Confirm failed");
    return data;
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
        list.innerHTML = "<p class='text-neutral-500 m-0'>No orders waiting for pickup confirmation.</p>";
        return;
      }

      list.innerHTML = data.orders
        .map(
          (o: {
            orderId: string;
            vendorCode: string;
            grossAmount: string;
            buyerEmail: string | null;
          }) => `
        <article class="elevation-1 p-4" data-order-id="${o.orderId}">
          <p class="text-body font-semibold m-0">${o.orderId}</p>
          <p class="text-body-sm text-neutral-500 m-0 mt-1">${o.vendorCode} · ₱${Number(o.grossAmount).toFixed(2)}</p>
          ${o.buyerEmail ? `<p class="text-caption text-neutral-500 m-0 mt-1">${o.buyerEmail}</p>` : ""}
          <button type="button" class="b2c-confirm-pickup touch-target min-h-10 mt-3 px-4 rounded-lg bg-accent-600 text-white text-body-sm font-semibold border-0 cursor-pointer" data-id="${o.orderId}">
            Confirm pickup & post
          </button>
          <p class="hidden text-body-sm mt-2 m-0 b2c-order-msg" role="status"></p>
        </article>`,
        )
        .join("");

      list.querySelectorAll(".b2c-confirm-pickup").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (!id) return;
          const card = btn.closest("[data-order-id]");
          const msg = card?.querySelector(".b2c-order-msg");
          if (btn instanceof HTMLButtonElement) btn.disabled = true;
          try {
            await confirmPickup(id);
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
