import { API_BASE } from "@/lib/api";
import { saveMerchantSession } from "@/lib/merchant-session";

export function setupSellerApplicationForm(apiBase = API_BASE): void {
  const form = document.getElementById("seller-application-form");
  const statusPanel = document.getElementById("application-status");
  const errorEl = document.getElementById("application-error");
  const checkBtn = document.getElementById("check-application");

  async function showStatus(email: string) {
    if (!statusPanel) return;
    statusPanel.classList.remove("hidden");
    statusPanel.innerHTML = "<p class='text-neutral-500 m-0'>Checking application…</p>";

    try {
      const res = await fetch(`${apiBase}/seller/applications?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!data.found) {
        statusPanel.innerHTML =
          "<p class='text-body m-0'>No application on file for this email. Submit the form below to apply.</p>";
        return;
      }

      const app = data.application;
      const vendor = data.application.vendor;
      let html = `<p class="text-body font-semibold m-0">${app.businessName}</p>
        <p class="text-body-sm text-neutral-500 mt-1 m-0">Status: <strong>${app.status}</strong></p>`;

      if (app.status === "APPROVED" && vendor) {
        html += `<p class="text-body-sm mt-3 m-0">Your seller code: <code>${vendor.code}</code></p>
          <p class="text-body-sm mt-1 m-0"><a href="/store/${vendor.slug}" class="text-brand-600 font-semibold">View your storefront →</a></p>
          <p class="text-caption text-neutral-500 mt-2 m-0">Save your vendor code below to manage listings and orders.</p>`;
      } else if (app.status === "PENDING") {
        html += `<p class="text-body-sm mt-2 m-0">Coop officers are reviewing your application. You'll be able to list products once approved.</p>`;
      } else if (app.status === "REJECTED") {
        html += `<p class="text-body-sm text-danger-600 mt-2 m-0">${app.reviewNotes ?? "Application was not approved. Contact the coop for details."}</p>`;
      }

      statusPanel.innerHTML = html;
    } catch {
      statusPanel.innerHTML = "<p class='text-danger-600 m-0'>Could not load application status.</p>";
    }
  }

  checkBtn?.addEventListener("click", () => {
    const emailInput = document.getElementById("check-email");
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    if (!email) return;
    void showStatus(email);
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl?.classList.add("hidden");

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

      const secretInput = document.getElementById("merchant-secret");
      const secret = secretInput instanceof HTMLInputElement ? secretInput.value.trim() : "";
      if (secret && data.application?.proposedVendorCode) {
        saveMerchantSession(data.application.proposedVendorCode, secret, payload.applicantEmail);
      }

      await showStatus(payload.applicantEmail);
      (form as HTMLFormElement).reset();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Application failed";
        errorEl.classList.remove("hidden");
      }
    }
  });
}

export function setupMerchantCredentials(_apiBase = API_BASE): void {
  const saveBtn = document.getElementById("save-merchant-session");
  const vendorInput = document.getElementById("merchant-vendor");
  const secretInput = document.getElementById("merchant-secret");
  const emailInput = document.getElementById("merchant-email");
  const msg = document.getElementById("merchant-session-msg");

  if (vendorInput instanceof HTMLInputElement && vendorInput.value) {
    // restored via server render optional
  }

  saveBtn?.addEventListener("click", () => {
    const vendor = vendorInput instanceof HTMLInputElement ? vendorInput.value.trim() : "";
    const secret = secretInput instanceof HTMLInputElement ? secretInput.value.trim() : "";
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    if (!vendor || !secret) {
      if (msg) {
        msg.textContent = "Enter vendor code and staff secret.";
        msg.className = "text-body-sm text-danger-600 mt-2 m-0";
      }
      return;
    }
    saveMerchantSession(vendor, secret, email || undefined);
    if (msg) {
      msg.textContent = "Saved — you can use Listings, New listing, and Activity.";
      msg.className = "text-body-sm text-success-600 mt-2 m-0";
    }
  });
}
