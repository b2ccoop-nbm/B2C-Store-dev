import { stripListingSkuTimestamp } from "@b2ccoop/store-shared";
import { API_BASE } from "@/lib/api";
import { merchantAuthHeaders, merchantHeaders } from "@/lib/merchant-session";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CATEGORIES = ["Groceries", "Produce", "Dairy", "Bakery", "Household", "Health", "General"];

type MerchantListingRow = {
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  patronagePerUnit: string;
  listingStatus: string;
  isActive: boolean;
  imageUrl: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function statusBadgeClass(status: string, isActive: boolean): string {
  if (status === "ACTIVE" && isActive) return "bg-success-50 text-success-600";
  if (status === "PENDING_REVIEW") return "bg-accent-50 text-accent-600";
  if (status === "REJECTED" || !isActive) return "bg-neutral-100 text-neutral-600";
  return "bg-neutral-100 text-neutral-600";
}

function statusLabel(status: string, isActive: boolean): string {
  if (status === "ACTIVE" && isActive) return "Live";
  if (status === "ACTIVE" && !isActive) return "Removed";
  return status.replace(/_/g, " ");
}

function photoCell(listing: MerchantListingRow): string {
  const sku = escapeHtml(listing.sku);
  const thumb = listing.imageUrl
    ? `<img src="${escapeHtml(listing.imageUrl)}" alt="" class="listing-photo-thumb h-12 w-12 shrink-0 rounded-lg border border-neutral-200 object-cover" width="48" height="48" />`
    : `<span class="listing-photo-thumb flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-caption text-neutral-400" aria-hidden="true">—</span>`;
  const label = listing.imageUrl ? "Change photo" : "Add photo";

  return `<td class="py-3 pr-4" data-listing-photo-cell data-sku="${sku}">
    <div class="flex flex-wrap items-center gap-3">
      ${thumb}
      <div class="min-w-0">
        <label class="inline-flex cursor-pointer items-center rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-caption font-semibold text-neutral-800 hover:bg-neutral-50">
          <input type="file" class="sr-only" data-listing-photo-input data-sku="${sku}" accept="image/jpeg,image/png,image/webp" />
          <span data-listing-photo-label>${label}</span>
        </label>
        <p class="listing-photo-status text-caption text-neutral-500 m-0 mt-1" data-listing-photo-status></p>
      </div>
    </div>
  </td>`;
}

function editFormRow(listing: MerchantListingRow): string {
  const sku = escapeAttr(listing.sku);
  const skuPrefix = escapeAttr(stripListingSkuTimestamp(listing.sku));
  const categoryOptions = CATEGORIES.map(
    (c) =>
      `<option value="${c}"${c === listing.category ? " selected" : ""}>${escapeHtml(c)}</option>`,
  ).join("");

  return `<tr class="border-b border-neutral-100 bg-neutral-50" data-listing-edit-row data-sku="${sku}">
    <td colspan="6" class="py-4 px-2">
      <form data-listing-edit-form data-sku="${sku}" class="grid gap-3 max-w-xl">
        <p class="text-body-sm font-semibold m-0">Edit listing</p>
        <label class="block text-body-sm">
          <span class="font-medium">Product name</span>
          <input name="name" type="text" required value="${escapeAttr(listing.name)}" class="mt-1 w-full min-h-touch rounded-lg border border-neutral-200 px-3" />
        </label>
        <label class="block text-body-sm">
          <span class="font-medium">SKU prefix</span>
          <span class="block text-caption text-neutral-500">Change only if you need a new code — a fresh timestamp is added on save.</span>
          <input name="skuBase" type="text" value="${skuPrefix}" class="mt-1 w-full min-h-touch rounded-lg border border-neutral-200 px-3 font-mono" />
        </label>
        <label class="block text-body-sm">
          <span class="font-medium">Category</span>
          <select name="category" class="mt-1 w-full min-h-touch rounded-lg border border-neutral-200 px-3">${categoryOptions}</select>
        </label>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-body-sm">
            <span class="font-medium">SRP (PHP)</span>
            <input name="unitPrice" type="text" inputmode="decimal" required value="${escapeAttr(listing.unitPrice)}" class="mt-1 w-full min-h-touch rounded-lg border border-neutral-200 px-3" />
          </label>
          <label class="block text-body-sm">
            <span class="font-medium">Patronage / unit</span>
            <input type="text" readonly value="${escapeAttr(listing.patronagePerUnit)}" class="mt-1 w-full min-h-touch rounded-lg border border-neutral-100 bg-neutral-50 px-3" title="Computed from coop revenue — edit SRP to recalculate" />
          </label>
        </div>
        <p class="text-caption text-neutral-500 m-0">Current SKU: <code>${sku}</code></p>
        <p data-listing-edit-error class="hidden text-body-sm text-danger-600 m-0" role="alert"></p>
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="inline-flex min-h-touch items-center rounded-lg bg-brand-600 px-4 font-semibold text-white">Save changes</button>
          <button type="button" data-listing-edit-cancel class="inline-flex min-h-touch items-center rounded-lg border border-neutral-200 bg-white px-4 font-semibold">Cancel</button>
        </div>
      </form>
    </td>
  </tr>`;
}

function renderListingsTable(listings: MerchantListingRow[]): string {
  return `<div class="overflow-x-auto"><table class="w-full text-body-sm border-collapse">
    <thead><tr class="text-left border-b border-neutral-200">
      <th class="py-2 pr-4">Product</th>
      <th class="py-2 pr-4">SKU</th>
      <th class="py-2 pr-4">Price</th>
      <th class="py-2 pr-4">Photo</th>
      <th class="py-2 pr-4">Status</th>
      <th class="py-2">Actions</th>
    </tr></thead><tbody>
    ${listings
      .map((l) => {
        const sku = escapeHtml(l.sku);
        const canDelete = l.listingStatus !== "ACTIVE" || l.isActive;
        return `<tr class="border-b border-neutral-100" data-listing-row data-sku="${sku}">
          <td class="py-3 pr-4 font-medium">${escapeHtml(l.name)}</td>
          <td class="py-3 pr-4 font-mono text-caption">${sku}</td>
          <td class="py-3 pr-4 text-price text-brand-600">₱${Number(l.unitPrice).toFixed(2)}</td>
          ${photoCell(l)}
          <td class="py-3 pr-4"><span class="rounded-full px-2 py-0.5 text-caption font-semibold ${statusBadgeClass(l.listingStatus, l.isActive)}">${escapeHtml(statusLabel(l.listingStatus, l.isActive))}</span></td>
          <td class="py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" data-listing-edit-open data-sku="${sku}" class="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-caption font-semibold hover:bg-neutral-50">Edit</button>
              ${
                canDelete
                  ? `<button type="button" data-listing-delete data-sku="${sku}" data-live="${l.listingStatus === "ACTIVE" && l.isActive ? "1" : "0"}" class="rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-1.5 text-caption font-semibold text-danger-600 hover:bg-danger-50/80">${l.listingStatus === "ACTIVE" && l.isActive ? "Remove" : "Delete"}</button>`
                  : ""
              }
            </div>
          </td>
        </tr>${editFormRow(l)}`;
      })
      .join("")}
    </tbody></table></div>`;
}

function setPhotoStatus(cell: HTMLElement, message: string, tone: "neutral" | "success" | "error"): void {
  const status = cell.querySelector("[data-listing-photo-status]");
  if (!(status instanceof HTMLElement)) return;
  status.textContent = message;
  status.classList.remove("text-neutral-500", "text-success-600", "text-danger-600");
  if (tone === "success") status.classList.add("text-success-600");
  else if (tone === "error") status.classList.add("text-danger-600");
  else status.classList.add("text-neutral-500");
}

function updatePhotoThumb(cell: HTMLElement, imageUrl: string): void {
  const existing = cell.querySelector(".listing-photo-thumb");
  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = "";
  img.width = 48;
  img.height = 48;
  img.className =
    "listing-photo-thumb h-12 w-12 shrink-0 rounded-lg border border-neutral-200 object-cover";
  existing?.replaceWith(img);

  const label = cell.querySelector("[data-listing-photo-label]");
  if (label) label.textContent = "Change photo";
}

async function uploadListingPhoto(
  apiBase: string,
  sku: string,
  file: File,
  cell: HTMLElement,
): Promise<void> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    setPhotoStatus(cell, "Use JPEG, PNG, or WebP.", "error");
    return;
  }
  if (file.size <= 0) {
    setPhotoStatus(cell, "File is empty.", "error");
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    setPhotoStatus(cell, "Image must be 2 MB or smaller.", "error");
    return;
  }

  setPhotoStatus(cell, "Uploading…", "neutral");
  const input = cell.querySelector<HTMLInputElement>("[data-listing-photo-input]");
  if (input) input.disabled = true;

  try {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`${apiBase}/merchant/listings/${encodeURIComponent(sku)}/image`, {
      method: "POST",
      headers: merchantAuthHeaders(),
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
    }
    if (typeof data.imageUrl === "string") {
      updatePhotoThumb(cell, data.imageUrl);
    }
    setPhotoStatus(cell, "Photo saved.", "success");
  } catch (err) {
    setPhotoStatus(cell, err instanceof Error ? err.message : "Upload failed", "error");
  } finally {
    if (input) {
      input.disabled = false;
      input.value = "";
    }
  }
}

function closeAllEditRows(container: HTMLElement): void {
  container.querySelectorAll("[data-listing-edit-row]").forEach((row) => row.classList.add("hidden"));
}

function openEditRow(container: HTMLElement, sku: string): void {
  closeAllEditRows(container);
  const row = container.querySelector<HTMLElement>(`[data-listing-edit-row][data-sku="${CSS.escape(sku)}"]`);
  row?.classList.remove("hidden");
}

export function setupMerchantListings(apiBase = API_BASE): void {
  const loadBtn = document.getElementById("load-listings");
  const list = document.getElementById("listings-table");
  const errorEl = document.getElementById("listings-error");

  const renderListings = (listings: MerchantListingRow[]) => {
    if (!list) return;
    if (!listings.length) {
      list.innerHTML =
        "<p class='text-neutral-500 m-0'>No listings yet. <a href='/sell/new' class='text-brand-600 font-semibold'>Create your first listing →</a></p>";
      return;
    }
    list.innerHTML = renderListingsTable(listings);
    list.querySelectorAll("[data-listing-edit-row]").forEach((row) => row.classList.add("hidden"));
  };

  list?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches("[data-listing-photo-input]")) return;
    const sku = target.dataset.sku?.trim();
    if (!sku) return;
    const file = target.files?.[0];
    if (!file) return;
    const cell = target.closest<HTMLElement>("[data-listing-photo-cell]");
    if (!cell) return;
    void uploadListingPhoto(apiBase, sku, file, cell);
  });

  list?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const editOpen = target.closest<HTMLButtonElement>("[data-listing-edit-open]");
    if (editOpen?.dataset.sku && list) {
      openEditRow(list, editOpen.dataset.sku);
      return;
    }

    const editCancel = target.closest<HTMLButtonElement>("[data-listing-edit-cancel]");
    if (editCancel && list) {
      closeAllEditRows(list);
      return;
    }

    const deleteBtn = target.closest<HTMLButtonElement>("[data-listing-delete]");
    if (deleteBtn?.dataset.sku) {
      const sku = deleteBtn.dataset.sku;
      const isLive = deleteBtn.dataset.live === "1";
      const message = isLive
        ? `Remove "${sku}" from the marketplace? It will no longer appear in the catalog.`
        : `Delete listing "${sku}"? This cannot be undone.`;
      if (!window.confirm(message)) return;

      void (async () => {
        errorEl?.classList.add("hidden");
        try {
          const res = await fetch(`${apiBase}/merchant/listings/${encodeURIComponent(sku)}`, {
            method: "DELETE",
            headers: merchantHeaders(),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Delete failed");
          await loadListings();
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err instanceof Error ? err.message : "Delete failed";
            errorEl.classList.remove("hidden");
          }
        }
      })();
    }
  });

  list?.addEventListener("submit", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;
    if (!target.matches("[data-listing-edit-form]")) return;
    event.preventDefault();

    const sku = target.dataset.sku?.trim();
    if (!sku) return;

    const errorBox = target.querySelector<HTMLElement>("[data-listing-edit-error]");
    errorBox?.classList.add("hidden");

    const formData = new FormData(target);
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const unitPrice = String(formData.get("unitPrice") ?? "").trim();
    const skuBase = String(formData.get("skuBase") ?? "").trim();

    void (async () => {
      try {
        const body: Record<string, string> = { name, category, unitPrice };
        if (skuBase && skuBase !== stripListingSkuTimestamp(sku)) {
          body.skuBase = skuBase;
        }

        const res = await fetch(`${apiBase}/merchant/listings/${encodeURIComponent(sku)}`, {
          method: "PATCH",
          headers: merchantHeaders(),
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        await loadListings();
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err instanceof Error ? err.message : "Save failed";
          errorBox.classList.remove("hidden");
        }
      }
    })();
  });

  const loadListings = async () => {
    errorEl?.classList.add("hidden");
    if (!list) return;
    list.innerHTML = "<p class='text-neutral-500 m-0'>Loading…</p>";

    try {
      const res = await fetch(`${apiBase}/merchant/listings`, { headers: merchantHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      renderListings((data.listings ?? []) as MerchantListingRow[]);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Load failed";
        errorEl.classList.remove("hidden");
      }
      list.innerHTML = "";
    }
  };

  loadBtn?.addEventListener("click", () => {
    void loadListings();
  });
}
