import { API_BASE } from "@/lib/api";
import { getMerchantVendorCode, merchantHeaders } from "@/lib/merchant-session";

const DRAFT_KEY = "b2c_listing_wizard_draft";

type Draft = {
  sku: string;
  name: string;
  category: string;
  unitPrice: string;
  patronagePerUnit: string;
};

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as Draft;
  } catch {
    /* ignore */
  }
  return { sku: "", name: "", category: "Groceries", unitPrice: "", patronagePerUnit: "0" };
}

function saveDraft(draft: Draft): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function setupListingWizard(apiBase = API_BASE): void {
  let step = 1;
  const totalSteps = 3;
  const draft = loadDraft();

  const stepLabel = document.getElementById("wizard-step-label");
  const step1 = document.getElementById("wizard-step-1");
  const step2 = document.getElementById("wizard-step-2");
  const step3 = document.getElementById("wizard-step-3");
  const backBtn = document.getElementById("wizard-back");
  const nextBtn = document.getElementById("wizard-next");
  const submitBtn = document.getElementById("wizard-submit");
  const errorEl = document.getElementById("wizard-error");
  const successEl = document.getElementById("wizard-success");
  const reviewEl = document.getElementById("wizard-review");

  const fields = {
    sku: document.getElementById("listing-sku") as HTMLInputElement | null,
    name: document.getElementById("listing-name") as HTMLInputElement | null,
    category: document.getElementById("listing-category") as HTMLSelectElement | null,
    unitPrice: document.getElementById("listing-price") as HTMLInputElement | null,
    patronage: document.getElementById("listing-patronage") as HTMLInputElement | null,
  };

  if (fields.sku) fields.sku.value = draft.sku;
  if (fields.name) fields.name.value = draft.name;
  if (fields.category) fields.category.value = draft.category;
  if (fields.unitPrice) fields.unitPrice.value = draft.unitPrice;
  if (fields.patronage) fields.patronage.value = draft.patronagePerUnit;

  function readDraft(): Draft {
    return {
      sku: fields.sku?.value.trim().toUpperCase().replace(/\s+/g, "-") ?? "",
      name: fields.name?.value.trim() ?? "",
      category: fields.category?.value ?? "General",
      unitPrice: fields.unitPrice?.value.trim() ?? "",
      patronagePerUnit: fields.patronage?.value.trim() || "0",
    };
  }

  function updateUi() {
    stepLabel && (stepLabel.textContent = `Step ${step} of ${totalSteps}`);
    step1?.classList.toggle("hidden", step !== 1);
    step2?.classList.toggle("hidden", step !== 2);
    step3?.classList.toggle("hidden", step !== 3);
    backBtn?.classList.toggle("hidden", step === 1);
    nextBtn?.classList.toggle("hidden", step === totalSteps);
    submitBtn?.classList.toggle("hidden", step !== totalSteps);

    if (step === totalSteps && reviewEl) {
      const d = readDraft();
      reviewEl.innerHTML = `
        <dl class="grid gap-2 text-body-sm m-0">
          <div><dt class="text-neutral-500 inline">SKU:</dt> <dd class="inline font-mono">${d.sku}</dd></div>
          <div><dt class="text-neutral-500 inline">Name:</dt> <dd class="inline">${d.name}</dd></div>
          <div><dt class="text-neutral-500 inline">Category:</dt> <dd class="inline">${d.category}</dd></div>
          <div><dt class="text-neutral-500 inline">Price:</dt> <dd class="inline text-price text-brand-600">₱${Number(d.unitPrice).toFixed(2)}</dd></div>
          <div><dt class="text-neutral-500 inline">Patronage / unit:</dt> <dd class="inline">₱${Number(d.patronagePerUnit).toFixed(2)}</dd></div>
        </dl>
        <p class="text-caption text-neutral-500 mt-4 m-0">Submitted listings are reviewed by coop officers before appearing in the marketplace.</p>`;
    }
  }

  function validateStep(): string | null {
    const d = readDraft();
    saveDraft(d);
    if (step === 1) {
      if (!d.name) return "Product name is required";
      if (!d.sku) return "SKU is required";
    }
    if (step === 2) {
      if (!d.unitPrice || Number(d.unitPrice) <= 0) return "Enter a valid price";
    }
    return null;
  }

  nextBtn?.addEventListener("click", () => {
    errorEl?.classList.add("hidden");
    const err = validateStep();
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
    const err = validateStep();
    if (err) {
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
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;

    try {
      const res = await fetch(`${apiBase}/merchant/listings`, {
        method: "POST",
        headers: merchantHeaders(),
        body: JSON.stringify({
          sku: d.sku,
          name: d.name,
          category: d.category,
          unitPrice: Number(d.unitPrice).toFixed(2),
          patronagePerUnit: Number(d.patronagePerUnit).toFixed(2),
          submitForReview: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed");

      sessionStorage.removeItem(DRAFT_KEY);
      if (successEl) {
        successEl.innerHTML = `Listing submitted for review (<code>${data.listing.sku}</code>). <a href="/sell/listings" class="text-brand-600 font-semibold">View your listings →</a>`;
        successEl.classList.remove("hidden");
      }
      step1?.classList.add("hidden");
      step2?.classList.add("hidden");
      step3?.classList.add("hidden");
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
