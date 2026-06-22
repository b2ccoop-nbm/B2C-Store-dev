import { API_BASE } from "@/lib/api";
import { setupStoreAdminSignIn } from "@/scripts/store-admin-auth";

type VendorSummary = {
  code: string;
  name: string;
  slug: string;
  ownerEmail: string | null;
};

type ApprovalCredentials = {
  name: string;
  code: string;
  slug: string;
  accessToken: string;
};

const ISSUED_TOKENS_KEY = "b2ccoop_admin_issued_tokens";

function getIssuedTokens(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(ISSUED_TOKENS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function saveIssuedToken(vendorCode: string, accessToken: string): void {
  const tokens = getIssuedTokens();
  tokens[vendorCode] = accessToken;
  sessionStorage.setItem(ISSUED_TOKENS_KEY, JSON.stringify(tokens));
}

function getIssuedToken(vendorCode: string): string | undefined {
  return getIssuedTokens()[vendorCode];
}

export function setupAdminMerchants(apiBase = API_BASE): void {
  const loadAppsBtn = document.getElementById("load-applications");
  const appsList = document.getElementById("applications-list");
  const loadListingsBtn = document.getElementById("load-pending-listings");
  const listingsPanel = document.getElementById("pending-listings-panel");
  const loadVendorsBtn = document.getElementById("load-vendors");
  const vendorsList = document.getElementById("vendors-list");
  const loadProfileChangesBtn = document.getElementById("load-profile-changes");
  const profileChangesPanel = document.getElementById("profile-changes-panel");
  const credentialsAlert = document.getElementById("credentials-alert");
  const errorEl = document.getElementById("admin-merchants-error");

  let authHeaders: HeadersInit | null = null;

  function authJsonHeaders(): HeadersInit | null {
    if (!authHeaders) return null;
    return { ...authHeaders, "Content-Type": "application/json" };
  }

  function requireAuth(): HeadersInit | null {
    if (!authHeaders) {
      if (errorEl) {
        errorEl.textContent = "Sign in as a designated merchant approver first.";
        errorEl.classList.remove("hidden");
      }
      return null;
    }
    return authHeaders;
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escapeAttr(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  }

  function accessTokenField(value: string): string {
    return `
      <div class="mt-3">
        <p class="text-caption font-semibold uppercase tracking-wide text-neutral-500 m-0">Access token</p>
        <div class="flex flex-col sm:flex-row gap-2 mt-1">
          <input
            type="text"
            readonly
            value="${escapeAttr(value)}"
            aria-label="Access token"
            class="flex-1 min-h-touch px-4 rounded-lg border border-neutral-200 bg-neutral-0 font-mono text-body-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
          <button
            type="button"
            class="b2c-copy-access-token touch-target min-h-touch px-5 rounded-lg bg-merchant-600 text-white text-body-sm font-semibold border-0 cursor-pointer shrink-0"
            data-copy="${escapeAttr(value)}"
          >Copy access token</button>
        </div>
      </div>`;
  }

  function credentialField(label: string, value: string, copyLabel: string): string {
    return `
      <div class="mt-3">
        <p class="text-caption font-semibold uppercase tracking-wide text-neutral-500 m-0">${label}</p>
        <div class="flex flex-wrap items-center gap-2 mt-1">
          <code class="font-mono text-body font-semibold text-neutral-900 break-all bg-neutral-0 border border-neutral-200 rounded-lg px-3 py-2">${escapeHtml(value)}</code>
          <button type="button" class="b2c-copy-credential touch-target min-h-10 px-4 rounded-lg border border-neutral-300 bg-neutral-0 text-body-sm font-semibold cursor-pointer" data-copy="${escapeAttr(value)}">${copyLabel}</button>
        </div>
      </div>`;
  }

  function renderCredentialsCard(
    title: string,
    subtitle: string,
    credentials: { code: string; accessToken?: string; slug?: string },
    options: { variant?: "success" | "neutral" } = {},
  ): string {
    const variant = options.variant ?? "neutral";
    const shellClass =
      variant === "success"
        ? "border-2 border-success-600 bg-success-50 rounded-xl p-5"
        : "border border-neutral-200 bg-neutral-50 rounded-xl p-4 mt-3";

    const tokenField = credentials.accessToken
      ? `${accessTokenField(credentials.accessToken)}
         <div class="mt-2">
           <button type="button" class="b2c-copy-both touch-target min-h-10 px-4 rounded-lg border border-neutral-300 bg-neutral-0 text-body-sm font-semibold cursor-pointer" data-code="${escapeAttr(credentials.code)}" data-token="${escapeAttr(credentials.accessToken)}">Copy vendor code + access token</button>
         </div>`
      : `<div class="mt-3">
           <p class="text-caption font-semibold uppercase tracking-wide text-neutral-500 m-0">Access token</p>
           <p class="text-body-sm text-neutral-500 m-0 mt-1">Not available — rotate to generate a new token to share with the seller.</p>
         </div>`;

    const storefront = credentials.slug
      ? `<p class="text-body-sm m-0 mt-3">Storefront: <a href="/store/${escapeHtml(credentials.slug)}" class="text-brand-600 font-semibold no-underline">/store/${escapeHtml(credentials.slug)}</a></p>`
      : "";

    return `
      <div class="${shellClass}">
        <h3 class="text-title m-0">${escapeHtml(title)}</h3>
        <p class="text-body-sm text-neutral-600 m-0 mt-1">${escapeHtml(subtitle)}</p>
        ${credentialField("Vendor code", credentials.code, "Copy code")}
        ${tokenField}
        ${storefront}
      </div>`;
  }

  function showCredentialsAlert(credentials: ApprovalCredentials): void {
    saveIssuedToken(credentials.code, credentials.accessToken);
    if (!credentialsAlert) return;
    credentialsAlert.innerHTML = renderCredentialsCard(
      `Seller approved — ${credentials.name}`,
      "Copy both values and send them to the seller for /sell/apply sign-in.",
      credentials,
      { variant: "success" },
    );
    credentialsAlert.classList.remove("hidden");
    credentialsAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
    bindCopyButtons(credentialsAlert);
  }

  function bindCopyButtons(root: ParentNode): void {
    const copyHandler = async (btn: HTMLButtonElement, text: string, copiedLabel: string) => {
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = copiedLabel;
        setTimeout(() => {
          btn.textContent = prev;
        }, 1500);
      } catch {
        window.prompt("Copy:", text);
      }
    };

    root.querySelectorAll(".b2c-copy-credential, .b2c-copy-access-token").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-copy");
        if (!text || !(btn instanceof HTMLButtonElement)) return;
        const copiedLabel = btn.classList.contains("b2c-copy-access-token") ? "Copied!" : "Copied";
        await copyHandler(btn, text, copiedLabel);
      });
    });

    root.querySelectorAll(".b2c-copy-both").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.getAttribute("data-code");
        const token = btn.getAttribute("data-token");
        if (!code || !token || !(btn instanceof HTMLButtonElement)) return;
        const text = `Vendor code: ${code}\nAccess token: ${token}`;
        try {
          await navigator.clipboard.writeText(text);
          const prev = btn.textContent;
          btn.textContent = "Copied both";
          setTimeout(() => {
            btn.textContent = prev;
          }, 1500);
        } catch {
          window.prompt("Copy:", text);
        }
      });
    });
  }

  async function rotateVendorToken(
    vendorCode: string,
    card: HTMLElement,
    button?: HTMLButtonElement,
  ) {
    const headers = requireAuth();
    if (!headers) return;

    const credentialsBox = card.querySelector(".b2c-vendor-credentials");
    const resultEl = card.querySelector(".b2c-token-result");

    if (button) button.disabled = true;
    if (resultEl instanceof HTMLElement) {
      resultEl.classList.remove("hidden");
      resultEl.innerHTML = "<p class='text-body-sm text-neutral-500 m-0'>Rotating token…</p>";
    }

    try {
      const res = await fetch(
        `${apiBase}/admin/vendors/${encodeURIComponent(vendorCode)}/rotate-token`,
        { method: "PATCH", headers },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rotate failed");

      saveIssuedToken(data.vendor.code, data.accessToken);

      const slugLink = card.querySelector("a[href^='/store/']")?.getAttribute("href")?.replace("/store/", "");
      const credentialsHtml = renderCredentialsCard(
        "Store credentials",
        "Share vendor code and access token with the seller. Previous token no longer works.",
        {
          code: data.vendor.code,
          accessToken: data.accessToken,
          slug: slugLink ?? undefined,
        },
      );

      if (credentialsBox instanceof HTMLElement) {
        credentialsBox.innerHTML = credentialsHtml;
        bindCopyButtons(credentialsBox);
      }

      if (resultEl instanceof HTMLElement) {
        resultEl.classList.add("hidden");
        resultEl.innerHTML = "";
      }

      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      if (resultEl instanceof HTMLElement) {
        resultEl.innerHTML = `<p class="text-body-sm text-danger-600 m-0">${escapeHtml(err instanceof Error ? err.message : "Rotate failed")}</p>`;
        resultEl.classList.remove("hidden");
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindVendorCardActions(root: ParentNode): void {
    bindCopyButtons(root);

    root.querySelectorAll(".b2c-rotate-token").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.getAttribute("data-code");
        const card = btn.closest("[data-vendor-code]");
        if (!code || !(card instanceof HTMLElement)) return;
        await rotateVendorToken(code, card, btn instanceof HTMLButtonElement ? btn : undefined);
      });
    });
  }

  function renderVendorCard(v: VendorSummary): string {
    const accessToken = getIssuedToken(v.code);
    return `
      <article class="elevation-1 p-4 mb-3" data-vendor-code="${escapeAttr(v.code)}">
        <h3 class="text-title m-0">${escapeHtml(v.name)}</h3>
        <p class="text-body-sm text-neutral-500 m-0 mt-1">${escapeHtml(v.ownerEmail ?? "No owner email on file")}</p>
        <div class="b2c-vendor-credentials">
          ${renderCredentialsCard(
            "Store credentials",
            accessToken
              ? "Vendor code and access token for /sell/apply. Token shown from your current browser session."
              : "Vendor code is permanent. Rotate access token to generate a new one for the seller.",
            { code: v.code, slug: v.slug, accessToken },
          )}
        </div>
        <div class="flex flex-wrap gap-2 mt-4">
          <button type="button" class="b2c-rotate-token touch-target min-h-10 px-4 rounded-lg bg-merchant-600 text-white text-body-sm font-semibold border-0 cursor-pointer" data-code="${escapeAttr(v.code)}">${accessToken ? "Rotate access token" : "Generate access token"}</button>
        </div>
        <div class="hidden b2c-token-result mt-3" role="status" />
      </article>`;
  }

  async function loadApplications() {
    errorEl?.classList.add("hidden");
    const headers = requireAuth();
    if (!headers || !appsList) return;
    appsList.innerHTML = "<p class='text-neutral-500 m-0'>Loading…</p>";

    try {
      const res = await fetch(`${apiBase}/admin/seller-applications`, { headers });
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
          <h3 class="text-title m-0">${escapeHtml(a.businessName)}</h3>
          <p class="text-body-sm text-neutral-500 m-0 mt-1">${escapeHtml(a.applicantEmail)} · ${escapeHtml(a.businessType)}</p>
          <p class="text-body-sm text-neutral-500 m-0 mt-2">Proposed vendor code: <code class="font-mono text-caption">${escapeHtml(a.proposedVendorCode)}</code></p>
          ${a.description ? `<p class="text-body-sm mt-2 m-0">${escapeHtml(a.description)}</p>` : ""}
          <div class="flex flex-wrap gap-2 mt-4">
            <button type="button" class="b2c-approve-app touch-target min-h-10 px-4 rounded-lg bg-success-600 text-white text-body-sm font-semibold border-0 cursor-pointer" data-id="${a.applicationId}">Approve seller</button>
            <button type="button" class="b2c-reject-app touch-target min-h-10 px-4 rounded-lg border border-neutral-300 bg-neutral-0 text-body-sm font-semibold cursor-pointer" data-id="${a.applicationId}">Reject</button>
          </div>
          <div class="hidden b2c-app-credentials mt-4" role="status"></div>
          <p class="hidden text-body-sm mt-2 m-0 b2c-app-msg" role="alert"></p>
        </article>`,
        )
        .join("");

      appsList.querySelectorAll(".b2c-approve-app").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (!id) return;
          const h = authJsonHeaders();
          if (!h) return;
          const card = btn.closest("[data-app-id]");
          const credentialsBox = card?.querySelector(".b2c-app-credentials");
          const msg = card?.querySelector(".b2c-app-msg");
          const actionRow = card?.querySelector(".flex.flex-wrap.gap-2.mt-4");

          if (btn instanceof HTMLButtonElement) btn.disabled = true;

          try {
            const res = await fetch(`${apiBase}/admin/seller-applications/${id}/approve`, {
              method: "PATCH",
              headers: h,
              body: JSON.stringify({}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Approve failed");

            const credentials: ApprovalCredentials = {
              name: data.vendor.name,
              code: data.vendor.code,
              slug: data.vendor.slug,
              accessToken: data.accessToken,
            };

            if (credentialsBox instanceof HTMLElement) {
              credentialsBox.innerHTML = renderCredentialsCard(
                "Generated store credentials",
                "Share vendor code and access token with the seller. They enter both at /sell/apply.",
                credentials,
                { variant: "success" },
              );
              credentialsBox.classList.remove("hidden");
              bindCopyButtons(credentialsBox);
            }

            showCredentialsAlert(credentials);
            actionRow?.remove();
            void loadVendors();
          } catch (err) {
            if (msg) {
              msg.textContent = err instanceof Error ? err.message : "Failed";
              msg.className = "text-body-sm mt-2 m-0 text-danger-600 b2c-app-msg";
              msg.classList.remove("hidden");
            }
            if (btn instanceof HTMLButtonElement) btn.disabled = false;
          }
        });
      });

      appsList.querySelectorAll(".b2c-reject-app").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (!id) return;
          const h = authJsonHeaders();
          if (!h) return;
          const notes = window.prompt("Optional reason for rejection:") ?? "";
          const card = btn.closest("[data-app-id]");
          const msg = card?.querySelector(".b2c-app-msg");
          try {
            const res = await fetch(`${apiBase}/admin/seller-applications/${id}/reject`, {
              method: "PATCH",
              headers: h,
              body: JSON.stringify({ reviewNotes: notes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Reject failed");
            if (msg) {
              msg.textContent = "Application rejected.";
              msg.className = "text-body-sm mt-2 m-0 text-neutral-600 b2c-app-msg";
              msg.classList.remove("hidden");
            }
            setTimeout(() => void loadApplications(), 1200);
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
  }

  async function loadVendors() {
    const headers = requireAuth();
    if (!headers || !vendorsList) return;
    vendorsList.innerHTML = "<p class='text-neutral-500 m-0'>Loading merchant credentials…</p>";

    try {
      const res = await fetch(`${apiBase}/admin/vendors`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      if (!data.vendors?.length) {
        vendorsList.innerHTML =
          "<p class='text-neutral-500 m-0'>No approved merchants yet. Approve a seller application above to generate a vendor code.</p>";
        return;
      }

      vendorsList.innerHTML = data.vendors.map((v: VendorSummary) => renderVendorCard(v)).join("");
      bindVendorCardActions(vendorsList);
    } catch (err) {
      vendorsList.innerHTML = "";
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Load failed";
        errorEl.classList.remove("hidden");
      }
    }
  }

  async function loadProfileChanges() {
    const headers = requireAuth();
    if (!headers || !profileChangesPanel) return;
    profileChangesPanel.innerHTML = "<p class='text-neutral-500 m-0'>Loading…</p>";

    try {
      const res = await fetch(`${apiBase}/admin/profile-changes/pending`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      if (!data.changes?.length) {
        profileChangesPanel.innerHTML = "<p class='text-neutral-500 m-0'>No pending store profile changes.</p>";
        return;
      }

      profileChangesPanel.innerHTML = data.changes
        .map(
          (c: {
            code: string;
            currentName: string;
            currentSlug: string;
            pendingName: string;
            pendingSlug: string;
            ownerEmail: string | null;
          }) => `
        <article class="elevation-1 p-4 mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-body font-semibold m-0">${escapeHtml(c.currentName)} → ${escapeHtml(c.pendingName)}</p>
            <p class="text-caption text-neutral-500 m-0 mt-1">${escapeHtml(c.code)} · ${escapeHtml(c.ownerEmail ?? "No email")}</p>
            <p class="text-body-sm m-0 mt-2">Storefront: <code class="font-mono text-caption">/store/${escapeHtml(c.currentSlug)}</code> → <code class="font-mono text-caption">/store/${escapeHtml(c.pendingSlug)}</code></p>
          </div>
          <button type="button" class="b2c-approve-profile touch-target min-h-10 px-4 rounded-lg bg-success-600 text-white text-body-sm font-semibold border-0 cursor-pointer" data-code="${escapeAttr(c.code)}">Approve rename</button>
        </article>`,
        )
        .join("");

      profileChangesPanel.querySelectorAll(".b2c-approve-profile").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const code = btn.getAttribute("data-code");
          const h = requireAuth();
          if (!code || !h) return;
          if (btn instanceof HTMLButtonElement) btn.disabled = true;
          try {
            const res = await fetch(
              `${apiBase}/admin/vendors/${encodeURIComponent(code)}/approve-profile`,
              { method: "PATCH", headers: h },
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Approve failed");
            btn.closest("article")?.remove();
            if (profileChangesPanel && !profileChangesPanel.querySelector("article")) {
              profileChangesPanel.innerHTML = "<p class='text-neutral-500 m-0'>No pending store profile changes.</p>";
            }
          } catch (err) {
            alert(err instanceof Error ? err.message : "Approve failed");
            if (btn instanceof HTMLButtonElement) btn.disabled = false;
          }
        });
      });
    } catch (err) {
      profileChangesPanel.innerHTML = "";
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Load failed";
        errorEl.classList.remove("hidden");
      }
    }
  }

  async function loadListings() {
    const headers = requireAuth();
    if (!headers || !listingsPanel) return;
    listingsPanel.innerHTML = "<p class='text-neutral-500 m-0'>Loading…</p>";

    try {
      const res = await fetch(`${apiBase}/admin/listings/pending`, { headers });
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
          }) => `
        <article class="elevation-1 p-4 mb-3 flex flex-wrap items-center justify-between gap-3" data-listing="${l.vendorCode}:${l.sku}">
          <div>
            <p class="text-body font-semibold m-0">${escapeHtml(l.name)}</p>
            <p class="text-caption text-neutral-500 m-0 mt-1">${escapeHtml(l.vendorCode)} · ${escapeHtml(l.sku)} · ₱${Number(l.unitPrice).toFixed(2)}</p>
          </div>
          <button type="button" class="b2c-approve-listing touch-target min-h-10 px-4 rounded-lg bg-success-600 text-white text-body-sm font-semibold border-0 cursor-pointer"
            data-vendor="${escapeHtml(l.vendorCode)}" data-sku="${escapeHtml(l.sku)}">Publish listing</button>
        </article>`,
        )
        .join("");

      listingsPanel.querySelectorAll(".b2c-approve-listing").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const vendor = btn.getAttribute("data-vendor");
          const sku = btn.getAttribute("data-sku");
          const h = requireAuth();
          if (!vendor || !sku || !h) return;
          if (btn instanceof HTMLButtonElement) btn.disabled = true;
          try {
            const res = await fetch(
              `${apiBase}/admin/listings/${encodeURIComponent(vendor)}/${encodeURIComponent(sku)}/approve`,
              { method: "PATCH", headers: h },
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
  }

  loadAppsBtn?.addEventListener("click", () => void loadApplications());
  loadListingsBtn?.addEventListener("click", () => void loadListings());
  loadVendorsBtn?.addEventListener("click", () => void loadVendors());
  loadProfileChangesBtn?.addEventListener("click", () => void loadProfileChanges());

  setupStoreAdminSignIn(apiBase, (state) => {
    authHeaders = state.headers;
    if (state.headers) {
      void loadApplications();
      void loadVendors();
      void loadProfileChanges();
      void loadListings();
    }
  });
}
