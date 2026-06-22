import type { MerchantProfile } from "@b2ccoop/store-shared";
import { API_BASE } from "@/lib/api";
import { merchantHeaders } from "@/lib/merchant-session";

export function setupMerchantSettings(apiBase = API_BASE): void {
  const panel = document.getElementById("merchant-settings-panel");
  const loadingEl = document.getElementById("settings-loading");
  const form = document.getElementById("merchant-settings-form");
  const pendingEl = document.getElementById("settings-pending-name");
  const vendorCodeEl = document.getElementById("settings-vendor-code");
  const storefrontLink = document.getElementById("settings-storefront-link");
  const errorEl = document.getElementById("settings-error");
  const successEl = document.getElementById("settings-success");
  const saveBtn = document.getElementById("settings-save");

  const fields = {
    name: document.getElementById("settings-name") as HTMLInputElement | null,
    businessType: document.getElementById("settings-business-type") as HTMLSelectElement | null,
    email: document.getElementById("settings-email") as HTMLInputElement | null,
    phone: document.getElementById("settings-phone") as HTMLInputElement | null,
    description: document.getElementById("settings-description") as HTMLTextAreaElement | null,
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

  function fillForm(profile: MerchantProfile) {
    currentProfile = profile;
    if (fields.name) fields.name.value = profile.pendingName ?? profile.name;
    if (fields.businessType) fields.businessType.value = profile.businessType;
    if (fields.email) fields.email.value = profile.email ?? profile.ownerEmail ?? "";
    if (fields.phone) fields.phone.value = profile.contactPhone ?? "";
    if (fields.description) fields.description.value = profile.description ?? "";

    if (vendorCodeEl) vendorCodeEl.textContent = profile.code;
    if (storefrontLink instanceof HTMLAnchorElement) {
      storefrontLink.href = `/store/${profile.slug}`;
      storefrontLink.textContent = `/store/${profile.slug}`;
    }

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

    const payload = {
      name: fields.name?.value.trim(),
      businessType: fields.businessType?.value,
      email: fields.email?.value.trim(),
      contactPhone: fields.phone?.value.trim() || null,
      description: fields.description?.value.trim() || null,
    };

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
          ? "Contact details saved. Business name change sent for coop officer review."
          : (data.message as string) ?? "Store profile updated.",
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Save failed");
    } finally {
      if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = false;
    }
  });

  void loadProfile();
}
