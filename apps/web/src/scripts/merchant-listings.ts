import { API_BASE } from "@/lib/api";
import { merchantHeaders } from "@/lib/merchant-session";

export function setupMerchantListings(apiBase = API_BASE): void {
  const loadBtn = document.getElementById("load-listings");
  const list = document.getElementById("listings-table");
  const errorEl = document.getElementById("listings-error");

  loadBtn?.addEventListener("click", async () => {
    errorEl?.classList.add("hidden");
    if (!list) return;
    list.innerHTML = "<p class='text-neutral-500 m-0'>Loading…</p>";

    try {
      const res = await fetch(`${apiBase}/merchant/listings`, { headers: merchantHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      if (!data.listings?.length) {
        list.innerHTML =
          "<p class='text-neutral-500 m-0'>No listings yet. <a href='/sell/new' class='text-brand-600 font-semibold'>Create your first listing →</a></p>";
        return;
      }

      list.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-body-sm border-collapse">
        <thead><tr class="text-left border-b border-neutral-200">
          <th class="py-2 pr-4">Product</th><th class="py-2 pr-4">SKU</th><th class="py-2 pr-4">Price</th><th class="py-2">Status</th>
        </tr></thead><tbody>
        ${data.listings
          .map(
            (l: {
              name: string;
              sku: string;
              unitPrice: string;
              listingStatus: string;
              isActive: boolean;
            }) => `<tr class="border-b border-neutral-100">
            <td class="py-3 pr-4 font-medium">${l.name}</td>
            <td class="py-3 pr-4 font-mono text-caption">${l.sku}</td>
            <td class="py-3 pr-4 text-price text-brand-600">₱${Number(l.unitPrice).toFixed(2)}</td>
            <td class="py-3"><span class="rounded-full px-2 py-0.5 text-caption font-semibold ${
              l.listingStatus === "ACTIVE"
                ? "bg-success-50 text-success-600"
                : l.listingStatus === "PENDING_REVIEW"
                  ? "bg-accent-50 text-accent-600"
                  : "bg-neutral-100 text-neutral-600"
            }">${l.listingStatus.replace("_", " ")}</span></td>
          </tr>`,
          )
          .join("")}
        </tbody></table></div>`;
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Load failed";
        errorEl.classList.remove("hidden");
      }
      list.innerHTML = "";
    }
  });
}
