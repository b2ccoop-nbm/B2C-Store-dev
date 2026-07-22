import type { MerchantProfile } from "@b2ccoop/store-shared";
import { API_BASE } from "@/lib/api";
import { merchantHeaders } from "@/lib/merchant-session";

export function setupMerchantSettings(apiBase = API_BASE): void {
  const panel = document.getElementById("merchant-settings-panel");
  const loadingEl = document.getElementById("settings-loading");
  const form = document.getElementById("merchant-settings-form");
  const pendingEl = document.getElementById("settings-pending-name");
  const vendorCodeEl = document.getElementById("settings-vendor-code");
  const sellerKindEl = document.getElementById("settings-seller-kind");
  const storefrontLink = document.getElementById("settings-storefront-link");
  const pickupFields = document.getElementById("pickup-fields");
  const errorEl = document.getElementById("settings-error");
  const successEl = document.getElementById("settings-success");
  const saveBtn = document.getElementById("settings-save");

  const fields = {
    name: document.getElementById("settings-name") as HTMLInputElement | null,
    businessType: document.getElementById("settings-business-type") as HTMLSelectElement | null,
    email: document.getElementById("settings-email") as HTMLInputElement | null,
    phone: document.getElementById("settings-phone") as HTMLInputElement | null,
    description: document.getElementById("settings-description") as HTMLTextAreaElement | null,
    pickupEnabled: document.getElementById("settings-pickup-enabled") as HTMLInputElement | null,
    pickupAddress: document.getElementById("settings-pickup-address") as HTMLInputElement | null,
    pickupLandmark: document.getElementById("settings-pickup-landmark") as HTMLInputElement | null,
    pickupHours: document.getElementById("settings-pickup-hours") as HTMLInputElement | null,
    pickupPhone: document.getElementById("settings-pickup-phone") as HTMLInputElement | null,
    pickupInstructions: document.getElementById("settings-pickup-instructions") as HTMLTextAreaElement | null,
    deliveryPerItem: document.getElementById("settings-delivery-rate") as HTMLInputElement | null,
    partnerListingFeePercent: document.getElementById("settings-partner-fee") as HTMLInputElement | null,
  };

  let currentProfile: MerchantProfile | null = null;

  function showError(message: string) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
    successEl?.classList.add("hidden");
  }

  function showSuccess(message: string) {
    if (!successEl) return;
    successEl.textContent = message;
    successEl.classList.remove("hidden");
    errorEl?.classList.add("hidden");
  }

  function updatePickupVisibility() {
    const enabled = fields.pickupEnabled?.checked ?? false;
    pickupFields?.classList.toggle("hidden", !enabled);
  }

  function updatePartnerFeeVisibility() {
    const isPartner = currentProfile?.sellerKind === "PARTNER";
    document.getElementById("partner-fee-field")?.classList.toggle("hidden", !isPartner);
  }

  function fillForm(profile: MerchantProfile) {
    currentProfile = profile;
    if (fields.name) fields.name.value = profile.pendingName ?? profile.name;
    if (fields.businessType) fields.businessType.value = profile.businessType;
    if (fields.email) fields.email.value = profile.email ?? profile.ownerEmail ?? "";
    if (fields.phone) fields.phone.value = profile.contactPhone ?? "";
    if (fields.description) fields.description.value = profile.description ?? "";
    if (fields.pickupEnabled) fields.pickupEnabled.checked = profile.pickupEnabled;
    if (fields.pickupAddress) fields.pickupAddress.value = profile.pickupAddress ?? "";
    if (fields.pickupLandmark) fields.pickupLandmark.value = profile.pickupLandmark ?? "";
    if (fields.pickupHours) fields.pickupHours.value = profile.pickupHours ?? "";
    if (fields.pickupPhone) fields.pickupPhone.value = profile.pickupPhone ?? "";
    if (fields.pickupInstructions) fields.pickupInstructions.value = profile.pickupInstructions ?? "";
    if (fields.deliveryPerItem) fields.deliveryPerItem.value = profile.deliveryPerItem ?? "";
    if (fields.partnerListingFeePercent) {
      fields.partnerListingFeePercent.value = profile.partnerListingFeePercent ?? "";
    }

    if (vendorCodeEl) vendorCodeEl.textContent = profile.code;
    if (sellerKindEl) sellerKindEl.textContent = profile.sellerKind;
    if (storefrontLink instanceof HTMLAnchorElement) {
      storefrontLink.href = `/store/${profile.slug}`;
      storefrontLink.textContent = `/store/${profile.slug}`;
    }

    updatePickupVisibility();
    updatePartnerFeeVisibility();

    if (pendingEl) {
      if (profile.pendingName && profile.pendingSlug) {
        pendingEl.innerHTML = `Name change pending coop review: <strong>${profile.pendingName}</strong> → storefront will become <code class="font-mono">/store/${profile.pendingSlug}</code> when approved. Your current storefront stays live until then.`;
        pendingEl.classList.remove("hidden");
      } else {
        pendingEl.classList.add("hidden");
        pendingEl.textContent = "";
      }
    }
  }

  fields.pickupEnabled?.addEventListener("change", updatePickupVisibility);

  async function loadProfile() {
    try {
      const res = await fetch(`${apiBase}/merchant/profile`, { headers: merchantHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load profile");

      loadingEl?.classList.add("hidden");
      form?.classList.remove("hidden");
      fillForm(data.profile as MerchantProfile);
    } catch (err) {
      if (loadingEl) {
        loadingEl.textContent = err instanceof Error ? err.message : "Could not load profile";
        loadingEl.className = "text-body-sm text-danger-600 m-0";
      }
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl?.classList.add("hidden");
    successEl?.classList.add("hidden");

    const pickupEnabled = fields.pickupEnabled?.checked ?? false;
    const payload: Record<string, unknown> = {
      name: fields.name?.value.trim(),
      businessType: fields.businessType?.value,
      email: fields.email?.value.trim(),
      contactPhone: fields.phone?.value.trim() || null,
      description: fields.description?.value.trim() || null,
      pickupEnabled,
      pickupAddress: pickupEnabled ? fields.pickupAddress?.value.trim() || null : null,
      pickupLandmark: pickupEnabled ? fields.pickupLandmark?.value.trim() || null : null,
      pickupHours: pickupEnabled ? fields.pickupHours?.value.trim() || null : null,
      pickupPhone: pickupEnabled ? fields.pickupPhone?.value.trim() || null : null,
      pickupInstructions: pickupEnabled ? fields.pickupInstructions?.value.trim() || null : null,
      deliveryPerItem: fields.deliveryPerItem?.value.trim() || null,
    };

    if (currentProfile?.sellerKind === "PARTNER") {
      payload.partnerListingFeePercent = fields.partnerListingFeePercent?.value.trim() || null;
    }

    if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = true;

    try {
      const res = await fetch(`${apiBase}/merchant/profile`, {
        method: "PATCH",
        headers: { ...merchantHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      fillForm(data.profile as MerchantProfile);
      showSuccess(
        data.nameChangePending
          ? "Settings saved. Business name change sent for coop officer review."
          : (data.message as string) ?? "Store settings updated.",
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Save failed");
    } finally {
      if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = false;
    }
  });

  void loadProfile();
}
