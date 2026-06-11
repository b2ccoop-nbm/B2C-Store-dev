import { API_BASE } from "@/lib/api";

function getSecret(): string {
  const input = document.getElementById("admin-secret");
  return input instanceof HTMLInputElement ? input.value.trim() : "";
}

export function setupAdminMerchants(apiBase = API_BASE): void {
  const loadAppsBtn = document.getElementById("load-applications");
  const appsList = document.getElementById("applications-list");
  const loadListingsBtn = document.getElementById("load-pending-listings");
  const listingsPanel = document.getElementById("pending-listings-panel");
  const errorEl = document.getElementById("admin-merchants-error");

  loadAppsBtn?.addEventListener("click", async () => {
    errorEl?.classList.add("hidden");
    const secret = getSecret();
    if (!secret) {
      if (errorEl) {
        errorEl.textContent = "Enter staff secret";
        errorEl.classList.remove("hidden");
      }
      return;
    }
    if (!appsList) return;
    appsList.innerHTML = "<p class='text-neutral-500 m-0'>Loading…</p>";

    try {
      const res = await fetch(`${apiBase}/admin/seller-applications`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      if (!data.applications?.length) {
        appsList.innerHTML = "<p class='text-neutral-500 m-0'>No pending seller applications.</p>";
        return;
      }

      appsList.innerHTML = data.applications
        .map(
          (a: {
            applicationId: string;
            businessName: string;
            applicantEmail: string;
            businessType: string;
            proposedVendorCode: string;
            description: string | null;
          }) => `
        <article class="elevation-1 p-4 mb-3" data-app-id="${a.applicationId}">
          <h3 class="text-title m-0">${a.businessName}</h3>
          <p class="text-body-sm text-neutral-500 m-0 mt-1">${a.applicantEmail} · ${a.businessType}</p>
          <p class="text-caption text-neutral-500 m-0 mt-1">Code: <code>${a.proposedVendorCode}</code></p>
          ${a.description ? `<p class="text-body-sm mt-2 m-0">${a.description}</p>` : ""}
          <div class="flex flex-wrap gap-2 mt-4">
            <button type="button" class="b2c-approve-app touch-target min-h-10 px-4 rounded-lg bg-success-600 text-white text-body-sm font-semibold border-0 cursor-pointer" data-id="${a.applicationId}">Approve seller</button>
            <button type="button" class="b2c-reject-app touch-target min-h-10 px-4 rounded-lg border border-neutral-300 bg-neutral-0 text-body-sm font-semibold cursor-pointer" data-id="${a.applicationId}">Reject</button>
          </div>
          <p class="hidden text-body-sm mt-2 m-0 b2c-app-msg" role="status"></p>
        </article>`,
        )
        .join("");

      appsList.querySelectorAll(".b2c-approve-app").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (!id) return;
          const card = btn.closest("[data-app-id]");
          const msg = card?.querySelector(".b2c-app-msg");
          try {
            const res = await fetch(`${apiBase}/admin/seller-applications/${id}/approve`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Approve failed");
            if (msg) {
              msg.textContent = `Approved — storefront /store/${data.vendor.slug}`;
              msg.className = "text-body-sm mt-2 m-0 text-success-600 b2c-app-msg";
              msg.classList.remove("hidden");
            }
            setTimeout(() => loadAppsBtn?.click(), 1200);
          } catch (err) {
            if (msg) {
              msg.textContent = err instanceof Error ? err.message : "Failed";
              msg.className = "text-body-sm mt-2 m-0 text-danger-600 b2c-app-msg";
              msg.classList.remove("hidden");
            }
          }
        });
      });

      appsList.querySelectorAll(".b2c-reject-app").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (!id) return;
          const notes = window.prompt("Optional reason for rejection:") ?? "";
          const card = btn.closest("[data-app-id]");
          const msg = card?.querySelector(".b2c-app-msg");
          try {
            const res = await fetch(`${apiBase}/admin/seller-applications/${id}/reject`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
              body: JSON.stringify({ reviewNotes: notes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Reject failed");
            if (msg) {
              msg.textContent = "Application rejected.";
              msg.className = "text-body-sm mt-2 m-0 text-neutral-600 b2c-app-msg";
              msg.classList.remove("hidden");
            }
            setTimeout(() => loadAppsBtn?.click(), 1200);
          } catch (err) {
            if (msg) {
              msg.textContent = err instanceof Error ? err.message : "Failed";
              msg.className = "text-body-sm mt-2 m-0 text-danger-600 b2c-app-msg";
              msg.classList.remove("hidden");
            }
          }
        });
      });
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Load failed";
        errorEl.classList.remove("hidden");
      }
    }
  });

  loadListingsBtn?.addEventListener("click", async () => {
    const secret = getSecret();
    if (!secret) {
      if (errorEl) {
        errorEl.textContent = "Enter staff secret";
        errorEl.classList.remove("hidden");
      }
      return;
    }
    if (!listingsPanel) return;
    listingsPanel.innerHTML = "<p class='text-neutral-500 m-0'>Loading…</p>";

    try {
      const res = await fetch(`${apiBase}/admin/listings/pending`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      if (!data.listings?.length) {
        listingsPanel.innerHTML = "<p class='text-neutral-500 m-0'>No listings awaiting approval.</p>";
        return;
      }

      listingsPanel.innerHTML = data.listings
        .map(
          (l: {
            vendorCode: string;
            sku: string;
            name: string;
            unitPrice: string;
            listingStatus: string;
          }) => `
        <article class="elevation-1 p-4 mb-3 flex flex-wrap items-center justify-between gap-3" data-listing="${l.vendorCode}:${l.sku}">
          <div>
            <p class="text-body font-semibold m-0">${l.name}</p>
            <p class="text-caption text-neutral-500 m-0 mt-1">${l.vendorCode} · ${l.sku} · ₱${Number(l.unitPrice).toFixed(2)}</p>
          </div>
          <button type="button" class="b2c-approve-listing touch-target min-h-10 px-4 rounded-lg bg-success-600 text-white text-body-sm font-semibold border-0 cursor-pointer"
            data-vendor="${l.vendorCode}" data-sku="${l.sku}">Publish listing</button>
        </article>`,
        )
        .join("");

      listingsPanel.querySelectorAll(".b2c-approve-listing").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const vendor = btn.getAttribute("data-vendor");
          const sku = btn.getAttribute("data-sku");
          if (!vendor || !sku) return;
          if (btn instanceof HTMLButtonElement) btn.disabled = true;
          try {
            const res = await fetch(
              `${apiBase}/admin/listings/${encodeURIComponent(vendor)}/${encodeURIComponent(sku)}/approve`,
              { method: "PATCH", headers: { Authorization: `Bearer ${secret}` } },
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Approve failed");
            btn.closest("article")?.remove();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Approve failed");
            if (btn instanceof HTMLButtonElement) btn.disabled = false;
          }
        });
      });
    } catch (err) {
      listingsPanel.innerHTML = "";
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Load failed";
        errorEl.classList.remove("hidden");
      }
    }
  });
}
