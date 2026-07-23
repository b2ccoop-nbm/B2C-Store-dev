import { API_BASE } from "@/lib/api";
import { saveApplicationStatusToken } from "@/lib/application-status";
import { fetchSellerApplication, type SellerApplication } from "@/lib/merchant-onboarding";
import { bindVendorToMember, getFirebaseIdToken, getStoredMemberEmail, subscribeMemberAuth } from "@/lib/member-auth";
import { auth } from "@/lib/firebase";
import {
  getMerchantEmail,
  hasMerchantAccess,
  saveMerchantSession,
  validateMerchantSession,
} from "@/lib/merchant-session";

const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getSignedInMemberEmail(): string {
  return auth?.currentUser?.email?.trim().toLowerCase() ?? getStoredMemberEmail().trim().toLowerCase();
}

function getApplicantEmailFieldValue(): string {
  const el = document.getElementById("applicantEmail");
  if (el instanceof HTMLInputElement) {
    return normalizeEmail(el.value);
  }
  return "";
}

function updateApplicationEmailWarning(): void {
  const banner = document.getElementById("application-email-signin-banner");
  if (!banner) return;

  const signedInEmail = getSignedInMemberEmail();
  const applicantEmail = getApplicantEmailFieldValue();

  if (!signedInEmail) {
    banner.className =
      "rounded-lg border px-4 py-3 border-neutral-200 bg-neutral-50 text-neutral-700";
    banner.innerHTML = `<p class="text-body-sm font-semibold m-0">Sign in before you apply</p>
      <p class="text-body-sm mt-1 m-0">Open <a href="/profile" class="text-brand-600 font-semibold">Your profile</a> and sign in with the email you will use on this form. That links your store for one-click seller access after approval.</p>`;
    banner.classList.remove("hidden");
    return;
  }

  if (!applicantEmail) {
    banner.classList.add("hidden");
    banner.innerHTML = "";
    return;
  }

  if (signedInEmail === applicantEmail) {
    banner.className =
      "rounded-lg border px-4 py-3 border-success-200 bg-success-50 text-success-800";
    banner.innerHTML = `<p class="text-body-sm font-semibold m-0">Email matches your sign-in</p>
      <p class="text-body-sm mt-1 m-0">Signed in as <strong>${signedInEmail}</strong>. After HQ approves, switch to Merchant in the header — no access token needed.</p>`;
    banner.classList.remove("hidden");
    return;
  }

  banner.className =
    "rounded-lg border px-4 py-3 border-amber-300 bg-amber-50 text-amber-950";
  banner.innerHTML = `<p class="text-body-sm font-semibold m-0">Email mismatch — seller sign-in may not work</p>
    <p class="text-body-sm mt-1 m-0">You are signed in as <strong>${signedInEmail}</strong>, but this application uses <strong>${applicantEmail}</strong>.</p>
    <p class="text-body-sm mt-2 m-0">For passwordless seller access, use the <strong>same email</strong> on both. Either change the business email above to <strong>${signedInEmail}</strong>, or sign in on <a href="/profile" class="text-brand-700 font-semibold">Your profile</a> with <strong>${applicantEmail}</strong>. Otherwise HQ must give you an access token after approval.</p>`;
  banner.classList.remove("hidden");
}

function syncEmailFields(email: string): void {
  for (const id of ["applicantEmail", "check-email", "merchant-email"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement && !el.value) {
      el.value = email;
    }
  }
}

function getSharedEmail(): string {
  const stored = getMerchantEmail() || getStoredMemberEmail();
  if (stored) return stored;

  for (const id of ["applicantEmail", "check-email", "merchant-email"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement && el.value.trim()) {
      return el.value.trim().toLowerCase();
    }
  }
  return "";
}

function getTurnstileToken(): string | undefined {
  if (!turnstileSiteKey) return undefined;
  const el = document.querySelector("[name=cf-turnstile-response]");
  return el instanceof HTMLInputElement ? el.value.trim() || undefined : undefined;
}

async function updateCredentialsVisibility(app: SellerApplication | null, apiBase: string): Promise<void> {
  const card = document.getElementById("merchant-credentials-card");
  const ssoCard = document.getElementById("merchant-sso-card");
  if (!card || !ssoCard) return;

  if (app?.status !== "APPROVED" || !app.vendor) {
    card.classList.add("hidden");
    ssoCard.classList.add("hidden");
    return;
  }

  ssoCard.classList.remove("hidden");
  const vendorInput = document.getElementById("merchant-vendor");
  if (vendorInput instanceof HTMLInputElement) {
    vendorInput.value = app.vendor.code;
  }

  const ready = await hasMerchantAccess(apiBase);
  const ssoMsg = document.getElementById("merchant-sso-msg");
  if (ssoMsg) {
    if (ready) {
      ssoMsg.innerHTML = `Signed in as <strong>${app.vendor.name}</strong>. Open <a href="/sell" class="text-brand-600 font-semibold">Seller dashboard →</a> or switch persona to Merchant in the header.`;
      ssoMsg.className = "text-body-sm text-success-700 mt-2 m-0";
    } else {
      ssoMsg.innerHTML =
        'Sign in on <a href="/profile" class="text-brand-600 font-semibold">Your profile</a> with the same email you used to apply. No access token needed.';
      ssoMsg.className = "text-body-sm text-neutral-600 mt-2 m-0";
    }
    ssoMsg.classList.remove("hidden");
  }

  card.classList.remove("hidden");
}

function renderStatusHtml(app: SellerApplication): string {
  let html = `<p class="text-body font-semibold m-0">${app.businessName}</p>
    <p class="text-body-sm text-neutral-500 mt-1 m-0">Status: <strong>${app.status}</strong></p>`;

  if (app.proposedVendorCode) {
    html += `<p class="text-body-sm mt-2 m-0">Proposed seller code: <code class="font-mono">${app.proposedVendorCode}</code></p>`;
  }

  const vendor = app.vendor;
  if (app.status === "APPROVED" && vendor) {
    html += `<p class="text-body-sm mt-3 m-0">Your seller code: <code class="font-mono">${vendor.code}</code></p>
      <p class="text-body-sm mt-1 m-0"><a href="/store/${vendor.slug}" class="text-brand-600 font-semibold">View your storefront →</a></p>
      <p class="text-caption text-neutral-500 mt-2 m-0">Sign in on Your profile with your member account to manage listings and orders — no access token required.</p>`;
  } else if (app.status === "PENDING") {
    html += `<p class="text-body-sm mt-2 m-0">Coop officers are reviewing your application. You'll receive an access token once approved.</p>`;
  } else if (app.status === "REJECTED") {
    html += `<p class="text-body-sm text-danger-600 mt-2 m-0">${app.reviewNotes ?? "Application was not approved."}</p>
      <p class="text-body-sm mt-2 m-0">You may submit a new application above with updated details.</p>`;
  }

  return html;
}

export function setupSellerApplicationForm(apiBase = API_BASE): void {
  const form = document.getElementById("seller-application-form");
  const statusPanel = document.getElementById("application-status");
  const statusCard = document.getElementById("application-status-card");
  const successBanner = document.getElementById("application-success-banner");
  const errorEl = document.getElementById("application-error");
  const checkBtn = document.getElementById("check-application");
  const stepperEl = document.getElementById("onboarding-stepper");

  const storedEmail = getMerchantEmail() || getStoredMemberEmail();
  if (storedEmail) syncEmailFields(storedEmail);
  updateApplicationEmailWarning();

  void getFirebaseIdToken().then((token) => {
    if (token) void refreshStatus({ scroll: false });
  });

  async function refreshStatus(options?: { scroll?: boolean; submitted?: boolean; email?: string }) {
    if (!statusPanel) return;
    statusCard?.classList.remove("hidden");
    statusPanel.classList.remove("hidden");
    statusPanel.innerHTML = "<p class='text-neutral-500 m-0'>Checking application…</p>";

    if (options?.submitted && successBanner) {
      successBanner.classList.remove("hidden");
    }

    try {
      const app = await fetchSellerApplication(apiBase, {
        email: options?.email,
        turnstileToken: getTurnstileToken(),
      });

      if (!app) {
        statusPanel.innerHTML =
          "<p class='text-body m-0'>No application on file. Submit the form above to apply, or sign in with the email you used.</p>";
        updateCredentialsVisibility(null, apiBase);
        return;
      }

      statusPanel.innerHTML = renderStatusHtml(app);
      await updateCredentialsVisibility(app, apiBase);

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
    } catch (err) {
      statusPanel.innerHTML = `<p class='text-danger-600 m-0'>${err instanceof Error ? err.message : "Could not load application status."}</p>`;
    }
  }

  checkBtn?.addEventListener("click", () => {
    const email = getSharedEmail();
    void refreshStatus({ scroll: true, email: email || undefined });
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl?.classList.add("hidden");
    successBanner?.classList.add("hidden");

    const fd = new FormData(form as HTMLFormElement);
    const payload: Record<string, string | undefined> = {
      applicantEmail: String(fd.get("applicantEmail") ?? "").trim(),
      businessName: String(fd.get("businessName") ?? "").trim(),
      businessType: String(fd.get("businessType") ?? "product"),
      contactPhone: String(fd.get("contactPhone") ?? "").trim() || undefined,
      description: String(fd.get("description") ?? "").trim() || undefined,
      turnstileToken: getTurnstileToken(),
    };

    const firebaseIdToken = await getFirebaseIdToken();
    if (firebaseIdToken) {
      payload.firebaseIdToken = firebaseIdToken;
    }

    const signedInEmail = getSignedInMemberEmail();
    const applicantEmail = normalizeEmail(String(payload.applicantEmail));
    if (signedInEmail && applicantEmail && signedInEmail !== applicantEmail && errorEl) {
      errorEl.innerHTML = `Business email (<strong>${applicantEmail}</strong>) does not match your sign-in (<strong>${signedInEmail}</strong>). Fix the email above or sign in with the matching account — otherwise you will need an access token from HQ after approval.`;
      errorEl.classList.remove("hidden");
      errorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    errorEl?.classList.add("hidden");

    try {
      const res = await fetch(`${apiBase}/seller/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Application failed");

      if (data.statusAccessToken) {
        saveApplicationStatusToken(data.statusAccessToken);
      }

      syncEmailFields(String(payload.applicantEmail));
      await refreshStatus({
        scroll: true,
        submitted: true,
        email: String(payload.applicantEmail),
      });

      if (successBanner && data.application?.proposedVendorCode) {
        successBanner.innerHTML = `<p class="text-body font-semibold text-success-700 m-0">Application received</p>
          <p class="text-body-sm text-success-700 mt-1 m-0">Proposed seller code: <code class="font-mono">${data.application.proposedVendorCode}</code>. Save this page — your status link is stored on this device.</p>`;
        successBanner.classList.remove("hidden");
      }

      (form as HTMLFormElement).reset();
      const emailField = document.getElementById("applicantEmail");
      if (emailField instanceof HTMLInputElement) {
        emailField.value = String(payload.applicantEmail);
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Application failed";
        errorEl.classList.remove("hidden");
      }
    }
  });

  for (const id of ["applicantEmail", "check-email", "merchant-email"]) {
    const el = document.getElementById(id);
    el?.addEventListener("input", () => {
      updateApplicationEmailWarning();
    });
    el?.addEventListener("change", () => {
      const email = getSharedEmail();
      if (email) syncEmailFields(email);
      updateApplicationEmailWarning();
    });
  }

  if (storedEmail) {
    void refreshStatus({ email: storedEmail });
  }

  subscribeMemberAuth(() => {
    updateApplicationEmailWarning();
    void refreshStatus({ scroll: false });
  });
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
      const vendor = await validateMerchantSession(apiBase, token);
      if (vendorInput instanceof HTMLInputElement) {
        vendorInput.value = vendor.code;
      }
      saveMerchantSession(vendor.code, token, email || undefined);
      await bindVendorToMember(apiBase, vendor.code);
      if (msg) {
        msg.textContent = `Token saved for ${vendor.name} (legacy fallback). Member sign-in is preferred.`;
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
