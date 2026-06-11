import { API_BASE } from "@/lib/api";
import { merchantHeaders } from "@/lib/merchant-session";

export function setupMerchantQueue(apiBase = API_BASE): void {
  const loadBtn = document.getElementById("load-merchant-orders");
  const list = document.getElementById("merchant-order-list");
  const loadError = document.getElementById("merchant-load-error");
  const vendorLabel = document.getElementById("merchant-vendor-label");

  async function confirmOrder(orderId: string) {
    const headers = merchantHeaders();
    const secret = (headers as Record<string, string>).Authorization?.replace("Bearer ", "") ?? "";
    const res = await fetch(`${apiBase}/admin/orders/${orderId}/confirm-pickup`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Confirm failed");
    return data;
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
        list.innerHTML = "<p class='text-neutral-500 m-0'>No orders waiting for pickup for your store.</p>";
        return;
      }

      list.innerHTML = data.orders
        .map(
          (o: { orderId: string; grossAmount: string; guestEmail: string; externalId: string }) => `
        <article class="elevation-1 p-4" data-order-id="${o.orderId}">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-price m-0 text-brand-600">₱${Number(o.grossAmount).toFixed(2)}</p>
              <p class="text-body-sm m-0 mt-1">${o.guestEmail ?? "Guest"}</p>
              <p class="text-caption text-neutral-500 m-0 mt-1 font-mono">${o.externalId}</p>
            </div>
            <div class="flex flex-col gap-2">
              <a href="/order/${o.orderId}" class="text-body-sm font-semibold text-brand-600">Receipt →</a>
              <button type="button" class="b2c-merchant-confirm touch-target min-h-10 px-4 rounded-lg bg-merchant-600 text-white text-body-sm font-semibold border-0 cursor-pointer" data-id="${o.orderId}">
                Confirm payment
              </button>
            </div>
          </div>
          <p class="hidden text-body-sm mt-2 m-0 b2c-merchant-msg" role="status"></p>
        </article>`,
        )
        .join("");

      list.querySelectorAll(".b2c-merchant-confirm").forEach((btn) => {
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
    } catch (err) {
      if (loadError) {
        loadError.textContent = err instanceof Error ? err.message : "Load failed";
        loadError.classList.remove("hidden");
      }
    }
  });
}
