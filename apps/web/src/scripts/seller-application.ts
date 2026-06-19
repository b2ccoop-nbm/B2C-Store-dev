import { API_BASE } from "@/lib/api";
import { fetchSellerApplication, type SellerApplication } from "@/lib/merchant-onboarding";
import { getMerchantEmail, saveMerchantSession, validateMerchantToken } from "@/lib/merchant-session";

function syncEmailFields(email: string): void {
  for (const id of ["applicantEmail", "check-email", "merchant-email"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement && !el.value) {
      el.value = email;
    }
  }
}

function getSharedEmail(): string {
  const stored = getMerchantEmail();
  if (stored) return stored;

  for (const id of ["applicantEmail", "check-email", "merchant-email"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement && el.value.trim()) {
      return el.value.trim().toLowerCase();
    }
  }
  return "";
}

function updateCredentialsVisibility(app: SellerApplication | null): void {
  const card = document.getElementById("merchant-credentials-card");
  if (!card) return;

  if (app?.status === "APPROVED" && app.vendor) {
    card.classList.remove("hidden");
    const vendorInput = document.getElementById("merchant-vendor");
    if (vendorInput instanceof HTMLInputElement && !vendorInput.value) {
      vendorInput.value = app.vendor.code;
    }
  } else {
    card.classList.add("hidden");
  }
}

export function setupSellerApplicationForm(apiBase = API_BASE): void {
  const form = document.getElementById("seller-application-form");
  const statusPanel = document.getElementById("application-status");
  const statusCard = document.getElementById("application-status-card");
  const successBanner = document.getElementById("application-success-banner");
  const errorEl = document.getElementById("application-error");
  const checkBtn = document.getElementById("check-application");
  const stepperEl = document.getElementById("onboarding-stepper");

  const storedEmail = getMerchantEmail();
  if (storedEmail) syncEmailFields(storedEmail);

  async function showStatus(email: string, options?: { scroll?: boolean; submitted?: boolean }) {
    if (!statusPanel) return;
    statusCard?.classList.remove("hidden");
    statusPanel.classList.remove("hidden");
    statusPanel.innerHTML = "<p class='text-neutral-500 m-0'>Checking application…</p>";

    if (options?.submitted && successBanner) {
      successBanner.classList.remove("hidden");
    }

    try {
      const app = await fetchSellerApplication(apiBase, email);
      if (!app) {
        statusPanel.innerHTML =
          "<p class='text-body m-0'>No application on file for this email. Submit the form above to apply.</p>";
        updateCredentialsVisibility(null);
        return;
      }

      let html = `<p class="text-body font-semibold m-0">${app.businessName}</p>
        <p class="text-body-sm text-neutral-500 mt-1 m-0">Status: <strong>${app.status}</strong></p>`;

      if (app.proposedVendorCode) {
        html += `<p class="text-body-sm mt-2 m-0">Proposed seller code: <code class="font-mono">${app.proposedVendorCode}</code></p>`;
      }

      const vendor = app.vendor;
      if (app.status === "APPROVED" && vendor) {
        html += `<p class="text-body-sm mt-3 m-0">Your seller code: <code class="font-mono">${vendor.code}</code></p>
          <p class="text-body-sm mt-1 m-0"><a href="/store/${vendor.slug}" class="text-brand-600 font-semibold">View your storefront →</a></p>
          <p class="text-caption text-neutral-500 mt-2 m-0">Enter your access token below to manage listings and orders on this device.</p>`;
      } else if (app.status === "PENDING") {
        html += `<p class="text-body-sm mt-2 m-0">Coop officers are reviewing your application. You'll receive an access token once approved.</p>`;
      } else if (app.status === "REJECTED") {
        html += `<p class="text-body-sm text-danger-600 mt-2 m-0">${app.reviewNotes ?? "Application was not approved."}</p>
          <p class="text-body-sm mt-2 m-0">You may submit a new application above with updated details.</p>`;
      }

      statusPanel.innerHTML = html;
      updateCredentialsVisibility(app);

      if (stepperEl) {
        const { loadOnboardingContext, renderOnboardingStepper: render } = await import(
          "@/lib/merchant-onboarding"
        );
        const ctx = await loadOnboardingContext(apiBase);
        stepperEl.innerHTML = render(ctx.step);
      }

      if (options?.scroll && statusCard) {
        statusCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch {
      statusPanel.innerHTML = "<p class='text-danger-600 m-0'>Could not load application status.</p>";
    }
  }

  checkBtn?.addEventListener("click", () => {
    const email = getSharedEmail();
    if (!email) return;
    void showStatus(email, { scroll: true });
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl?.classList.add("hidden");
    successBanner?.classList.add("hidden");

    const fd = new FormData(form as HTMLFormElement);
    const payload = {
      applicantEmail: String(fd.get("applicantEmail") ?? "").trim(),
      businessName: String(fd.get("businessName") ?? "").trim(),
      businessType: String(fd.get("businessType") ?? "product"),
      contactPhone: String(fd.get("contactPhone") ?? "").trim() || undefined,
      description: String(fd.get("description") ?? "").trim() || undefined,
    };

    try {
      const res = await fetch(`${apiBase}/seller/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Application failed");

      syncEmailFields(payload.applicantEmail);
      await showStatus(payload.applicantEmail, { scroll: true, submitted: true });

      if (successBanner && data.application?.proposedVendorCode) {
        successBanner.innerHTML = `<p class="text-body font-semibold text-success-700 m-0">Application received</p>
          <p class="text-body-sm text-success-700 mt-1 m-0">Proposed seller code: <code class="font-mono">${data.application.proposedVendorCode}</code>. We'll email you when HQ approves your store.</p>`;
        successBanner.classList.remove("hidden");
      }

      (form as HTMLFormElement).reset();
      const emailField = document.getElementById("applicantEmail");
      if (emailField instanceof HTMLInputElement) {
        emailField.value = payload.applicantEmail;
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Application failed";
        errorEl.classList.remove("hidden");
      }
    }
  });

  // Sync email across fields
  for (const id of ["applicantEmail", "check-email", "merchant-email"]) {
    const el = document.getElementById(id);
    el?.addEventListener("change", () => {
      const email = getSharedEmail();
      if (email) syncEmailFields(email);
    });
  }

  if (storedEmail) {
    void showStatus(storedEmail);
  }
}

export function setupMerchantCredentials(apiBase = API_BASE): void {
  const saveBtn = document.getElementById("save-merchant-session");
  const vendorInput = document.getElementById("merchant-vendor");
  const tokenInput = document.getElementById("merchant-token");
  const emailInput = document.getElementById("merchant-email");
  const msg = document.getElementById("merchant-session-msg");

  saveBtn?.addEventListener("click", async () => {
    const token = tokenInput instanceof HTMLInputElement ? tokenInput.value.trim() : "";
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    if (!token) {
      if (msg) {
        msg.textContent = "Enter your access token from HQ.";
        msg.className = "text-body-sm text-danger-600 mt-2 m-0";
        msg.classList.remove("hidden");
      }
      return;
    }

    if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = true;
    if (msg) {
      msg.textContent = "Verifying token…";
      msg.className = "text-body-sm text-neutral-500 mt-2 m-0";
      msg.classList.remove("hidden");
    }

    try {
      const vendor = await validateMerchantToken(apiBase, token);
      if (vendorInput instanceof HTMLInputElement) {
        vendorInput.value = vendor.code;
      }
      saveMerchantSession(vendor.code, token, email || undefined);
      if (msg) {
        msg.textContent = `Saved for ${vendor.name} — you can use Listings, New listing, and Order queue.`;
        msg.className = "text-body-sm text-success-600 mt-2 m-0";
        msg.classList.remove("hidden");
      }
    } catch (err) {
      if (msg) {
        msg.textContent = err instanceof Error ? err.message : "Token verification failed";
        msg.className = "text-body-sm text-danger-600 mt-2 m-0";
        msg.classList.remove("hidden");
      }
    } finally {
      if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = false;
    }
  });
}
