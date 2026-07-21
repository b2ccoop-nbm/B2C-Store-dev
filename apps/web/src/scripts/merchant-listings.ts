import { API_BASE } from "@/lib/api";
import { merchantAuthHeaders, merchantHeaders } from "@/lib/merchant-session";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type MerchantListingRow = {
  name: string;
  sku: string;
  unitPrice: string;
  listingStatus: string;
  imageUrl: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadgeClass(status: string): string {
  if (status === "ACTIVE") return "bg-success-50 text-success-600";
  if (status === "PENDING_REVIEW") return "bg-accent-50 text-accent-600";
  return "bg-neutral-100 text-neutral-600";
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

function renderListingsTable(listings: MerchantListingRow[]): string {
  return `<div class="overflow-x-auto"><table class="w-full text-body-sm border-collapse">
    <thead><tr class="text-left border-b border-neutral-200">
      <th class="py-2 pr-4">Product</th>
      <th class="py-2 pr-4">SKU</th>
      <th class="py-2 pr-4">Price</th>
      <th class="py-2 pr-4">Photo</th>
      <th class="py-2">Status</th>
    </tr></thead><tbody>
    ${listings
      .map(
        (l) => `<tr class="border-b border-neutral-100" data-listing-row data-sku="${escapeHtml(l.sku)}">
          <td class="py-3 pr-4 font-medium">${escapeHtml(l.name)}</td>
          <td class="py-3 pr-4 font-mono text-caption">${escapeHtml(l.sku)}</td>
          <td class="py-3 pr-4 text-price text-brand-600">₱${Number(l.unitPrice).toFixed(2)}</td>
          ${photoCell(l)}
          <td class="py-3"><span class="rounded-full px-2 py-0.5 text-caption font-semibold ${statusBadgeClass(l.listingStatus)}">${escapeHtml(l.listingStatus.replace("_", " "))}</span></td>
        </tr>`,
      )
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

export function setupMerchantListings(apiBase = API_BASE): void {
  const loadBtn = document.getElementById("load-listings");
  const list = document.getElementById("listings-table");
  const errorEl = document.getElementById("listings-error");

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

  const loadListings = async () => {
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

      list.innerHTML = renderListingsTable(data.listings as MerchantListingRow[]);
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
