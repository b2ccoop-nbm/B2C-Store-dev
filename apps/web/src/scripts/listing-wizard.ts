import {
  buildListingSku,
  listingSkuBaseFromName,
  normalizeListingSkuBase,
} from "@b2ccoop/store-shared";
import { API_BASE } from "@/lib/api";
import { getMerchantVendorCode, merchantAuthHeaders, merchantHeaders } from "@/lib/merchant-session";

const DRAFT_KEY = "b2c_listing_wizard_draft";

type Draft = {
  skuPrefix: string;
  name: string;
  category: string;
  unitPrice: string;
  patronagePerUnit: string;
};

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Draft & { sku?: string }>;
      return {
        skuPrefix: parsed.skuPrefix ?? parsed.sku ?? "",
        name: parsed.name ?? "",
        category: parsed.category ?? "Groceries",
        unitPrice: parsed.unitPrice ?? "",
        patronagePerUnit: parsed.patronagePerUnit ?? "0",
      };
    }
  } catch {
    /* ignore */
  }
  return { skuPrefix: "", name: "", category: "Groceries", unitPrice: "", patronagePerUnit: "0" };
}

function saveDraft(draft: Draft): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function previewSku(name: string, skuPrefix: string): string {
  const base = skuPrefix.trim()
    ? normalizeListingSkuBase(skuPrefix)
    : listingSkuBaseFromName(name);
  return buildListingSku(base || "ITEM");
}

export function setupListingWizard(apiBase = API_BASE): void {
  let step = 1;
  const totalSteps = 2;
  const draft = loadDraft();
  let imageFile: File | null = null;
  let imagePreviewUrl: string | null = null;

  const stepLabel = document.getElementById("wizard-step-label");
  const step1 = document.getElementById("wizard-step-1");
  const step2 = document.getElementById("wizard-step-2");
  const backBtn = document.getElementById("wizard-back");
  const nextBtn = document.getElementById("wizard-next");
  const submitBtn = document.getElementById("wizard-submit");
  const errorEl = document.getElementById("wizard-error");
  const successEl = document.getElementById("wizard-success");
  const reviewEl = document.getElementById("wizard-review");
  const skuPreviewEl = document.getElementById("listing-sku-preview");
  const imageInput = document.getElementById("listing-image") as HTMLInputElement | null;
  const imagePreview = document.getElementById("listing-image-preview") as HTMLImageElement | null;

  const fields = {
    skuPrefix: document.getElementById("listing-sku-prefix") as HTMLInputElement | null,
    name: document.getElementById("listing-name") as HTMLInputElement | null,
    category: document.getElementById("listing-category") as HTMLSelectElement | null,
    unitPrice: document.getElementById("listing-price") as HTMLInputElement | null,
    patronage: document.getElementById("listing-patronage") as HTMLInputElement | null,
  };

  if (fields.skuPrefix) fields.skuPrefix.value = draft.skuPrefix;
  if (fields.name) fields.name.value = draft.name;
  if (fields.category) fields.category.value = draft.category;
  if (fields.unitPrice) fields.unitPrice.value = draft.unitPrice;
  if (fields.patronage) fields.patronage.value = draft.patronagePerUnit;

  function updateSkuPreview(): void {
    const d = readDraft();
    if (!skuPreviewEl) return;
    if (!d.name.trim() && !d.skuPrefix.trim()) {
      skuPreviewEl.textContent = "";
      return;
    }
    skuPreviewEl.textContent = `SKU preview: ${previewSku(d.name, d.skuPrefix)} (final suffix assigned on save)`;
  }

  function clearImagePreview(): void {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      imagePreviewUrl = null;
    }
    imageFile = null;
    if (imagePreview) {
      imagePreview.src = "";
      imagePreview.classList.add("hidden");
    }
  }

  for (const field of [fields.name, fields.skuPrefix]) {
    field?.addEventListener("input", updateSkuPreview);
  }

  imageInput?.addEventListener("change", () => {
    clearImagePreview();
    const file = imageInput.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      if (errorEl) {
        errorEl.textContent = "Image must be 2 MB or smaller.";
        errorEl.classList.remove("hidden");
      }
      imageInput.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      if (errorEl) {
        errorEl.textContent = "Use a JPEG, PNG, or WebP image.";
        errorEl.classList.remove("hidden");
      }
      imageInput.value = "";
      return;
    }
    errorEl?.classList.add("hidden");
    imageFile = file;
    imagePreviewUrl = URL.createObjectURL(file);
    if (imagePreview) {
      imagePreview.src = imagePreviewUrl;
      imagePreview.classList.remove("hidden");
    }
  });

  function readDraft(): Draft {
    return {
      skuPrefix: fields.skuPrefix?.value.trim().toUpperCase().replace(/\s+/g, "-") ?? "",
      name: fields.name?.value.trim() ?? "",
      category: fields.category?.value ?? "General",
      unitPrice: fields.unitPrice?.value.trim() ?? "",
      patronagePerUnit: fields.patronage?.value.trim() || "0",
    };
  }

  function parsePrice(value: string): number | null {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function validateDetails(): string | null {
    const d = readDraft();
    saveDraft(d);
    if (!d.name) return "Product name is required";
    if (!parsePrice(d.unitPrice)) return "Enter a valid price in PHP";
    const patronage = Number(d.patronagePerUnit.replace(/,/g, ""));
    if (!Number.isFinite(patronage) || patronage < 0) return "Patronage must be zero or greater";
    return null;
  }

  function updateUi() {
    stepLabel && (stepLabel.textContent = `Step ${step} of ${totalSteps}`);
    step1?.classList.toggle("hidden", step !== 1);
    step2?.classList.toggle("hidden", step !== 2);
    backBtn?.classList.toggle("hidden", step === 1);
    nextBtn?.classList.toggle("hidden", step === totalSteps);
    submitBtn?.classList.toggle("hidden", step !== totalSteps);

    if (backBtn instanceof HTMLButtonElement) backBtn.disabled = step === 1;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = step === totalSteps;
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = step !== totalSteps;

    updateSkuPreview();

    if (step === totalSteps && reviewEl) {
      const d = readDraft();
      const price = parsePrice(d.unitPrice) ?? 0;
      const skuExample = previewSku(d.name, d.skuPrefix);
      const photoNote = imageFile
        ? `<div><dt class="text-neutral-500 inline">Photo:</dt> <dd class="inline">${imageFile.name}</dd></div>`
        : `<div><dt class="text-neutral-500 inline">Photo:</dt> <dd class="inline text-neutral-500">None (category icon will show)</dd></div>`;
      reviewEl.innerHTML = `
        <dl class="grid gap-2 text-body-sm m-0">
          <div><dt class="text-neutral-500 inline">SKU:</dt> <dd class="inline font-mono">${skuExample}</dd></div>
          <div><dt class="text-neutral-500 inline">Name:</dt> <dd class="inline">${d.name}</dd></div>
          <div><dt class="text-neutral-500 inline">Category:</dt> <dd class="inline">${d.category}</dd></div>
          <div><dt class="text-neutral-500 inline">Price:</dt> <dd class="inline text-price text-brand-600">₱${price.toFixed(2)}</dd></div>
          <div><dt class="text-neutral-500 inline">Patronage / unit:</dt> <dd class="inline">₱${Number(d.patronagePerUnit).toFixed(2)}</dd></div>
          ${photoNote}
        </dl>
        <p class="text-caption text-neutral-500 mt-4 m-0">Submitted listings are reviewed by coop officers before appearing in the marketplace.</p>`;
    }
  }

  nextBtn?.addEventListener("click", () => {
    errorEl?.classList.add("hidden");
    const err = validateDetails();
    if (err) {
      if (errorEl) {
        errorEl.textContent = err;
        errorEl.classList.remove("hidden");
      }
      return;
    }
    step = Math.min(totalSteps, step + 1);
    updateUi();
  });

  backBtn?.addEventListener("click", () => {
    errorEl?.classList.add("hidden");
    step = Math.max(1, step - 1);
    updateUi();
  });

  submitBtn?.addEventListener("click", async () => {
    errorEl?.classList.add("hidden");
    successEl?.classList.add("hidden");

    if (step !== totalSteps) {
      if (errorEl) {
        errorEl.textContent = "Continue to review before submitting.";
        errorEl.classList.remove("hidden");
      }
      return;
    }

    const err = validateDetails();
    if (err) {
      step = 1;
      updateUi();
      if (errorEl) {
        errorEl.textContent = err;
        errorEl.classList.remove("hidden");
      }
      return;
    }

    const vendorCode = getMerchantVendorCode();
    if (!vendorCode) {
      if (errorEl) {
        errorEl.textContent = "Set your vendor code on the Apply page or dashboard first.";
        errorEl.classList.remove("hidden");
      }
      return;
    }

    const d = readDraft();
    const price = parsePrice(d.unitPrice)!;
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;

    try {
      const payload: Record<string, unknown> = {
        name: d.name,
        category: d.category,
        unitPrice: price.toFixed(2),
        patronagePerUnit: Number(d.patronagePerUnit).toFixed(2),
        submitForReview: true,
      };
      if (d.skuPrefix) payload.sku = d.skuPrefix;

      const res = await fetch(`${apiBase}/merchant/listings`, {
        method: "POST",
        headers: merchantHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed");

      const assignedSku = typeof data.listing?.sku === "string" ? data.listing.sku : previewSku(d.name, d.skuPrefix);

      let imageWarning = "";
      if (imageFile) {
        const form = new FormData();
        form.append("image", imageFile);
        const uploadRes = await fetch(
          `${apiBase}/merchant/listings/${encodeURIComponent(assignedSku)}/image`,
          {
            method: "POST",
            headers: merchantAuthHeaders(),
            body: form,
          },
        );
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          imageWarning = ` Listing saved, but photo upload failed: ${uploadData.error ?? "upload error"}.`;
        }
      }

      sessionStorage.removeItem(DRAFT_KEY);
      clearImagePreview();
      if (imageInput) imageInput.value = "";

      if (successEl) {
        successEl.innerHTML = `Listing submitted for review (<code>${assignedSku}</code>).${imageWarning} <a href="/sell/listings" class="text-brand-600 font-semibold">View your listings →</a>`;
        successEl.classList.remove("hidden");
      }
      step1?.classList.add("hidden");
      step2?.classList.add("hidden");
      nextBtn?.classList.add("hidden");
      backBtn?.classList.add("hidden");
      submitBtn?.classList.add("hidden");
    } catch (e) {
      if (errorEl) {
        errorEl.textContent = e instanceof Error ? e.message : "Submit failed";
        errorEl.classList.remove("hidden");
      }
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    }
  });

  updateUi();
}
