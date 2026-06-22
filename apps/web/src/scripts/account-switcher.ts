import { API_BASE } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { fetchMerchantContext, subscribeMemberAuth } from "@/lib/member-auth";
import {
  getMerchantEmail,
  getMerchantToken,
  getMerchantVendorCode,
  hasMerchantSession,
  validateMerchantToken,
} from "@/lib/merchant-session";
import { fetchStoreAdminSession } from "@/lib/store-admin";
import { $persona, getPersonaLabel, type Persona } from "@/stores/persona";

type AccountSnapshot = {
  persona: Persona;
  personaLabel: string;
  detail: string;
  subtitle: string;
  initials: string;
  memberEmail: string | null;
  merchantStore: string | null;
  merchantCode: string | null;
  applicationStatus: string | null;
  adminLabel: string | null;
};

function inferPersonaFromPath(path: string): Persona | null {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/sell")) return "merchant";
  if (path.startsWith("/my-coop")) return "member";
  return null;
}

function initialsFrom(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return text.trim().slice(0, 2).toUpperCase() || "You";
}

function emailLocalPart(email: string): string {
  return email.split("@")[0] ?? email;
}

async function loadAccountSnapshot(apiBase: string): Promise<AccountSnapshot> {
  const pathPersona = inferPersonaFromPath(window.location.pathname);
  const persona = pathPersona ?? $persona.get();
  const memberEmail = auth?.currentUser?.email?.trim().toLowerCase() ?? getStoredMemberFallback();

  let merchantStore: string | null = null;
  let merchantCode = getMerchantVendorCode() || null;
  let applicationStatus: string | null = null;
  let adminLabel: string | null = null;

  if (hasMerchantSession()) {
    try {
      const vendor = await validateMerchantToken(apiBase, getMerchantToken());
      merchantStore = vendor.name;
      merchantCode = vendor.code;
    } catch {
      merchantStore = merchantCode;
    }
  }

  const merchantContext = memberEmail ? await fetchMerchantContext(apiBase) : null;
  if (merchantContext?.vendor?.name) {
    merchantStore = merchantContext.vendor.name;
    merchantCode = merchantContext.vendor.code;
  }
  if (merchantContext?.application?.status) {
    applicationStatus = merchantContext.application.status;
  }

  const adminSession = await fetchStoreAdminSession(apiBase);
  if (adminSession?.ok) {
    adminLabel = adminSession.label;
  }

  const effectiveEmail = memberEmail ?? (getMerchantEmail() || adminSession?.email || null);

  let detail = "Browse as guest";
  let subtitle = "Sign in on Your profile for member benefits";

  if (persona === "admin" && adminLabel) {
    detail = adminSession?.email ?? effectiveEmail ?? "Coop officer";
    subtitle = `${adminLabel} · HQ tools`;
  } else if (persona === "merchant") {
    if (merchantStore) {
      detail = merchantStore;
      subtitle = merchantCode ? `Store · ${merchantCode}` : "Seller tools";
    } else if (applicationStatus === "PENDING") {
      detail = effectiveEmail ?? "Seller applicant";
      subtitle = "Application under review";
    } else if (effectiveEmail) {
      detail = effectiveEmail;
      subtitle = hasMerchantSession() ? "Store credentials saved" : "Save credentials at Apply to sell";
    } else {
      detail = "Seller area";
      subtitle = "Apply or save store credentials";
    }
  } else if (persona === "member" || (persona === "customer" && effectiveEmail)) {
    detail = effectiveEmail ?? "Member";
    subtitle =
      merchantContext?.isApprovedVendor && merchantStore
        ? `Also sells as ${merchantStore}`
        : applicationStatus === "PENDING"
          ? "Seller application pending"
          : "Signed-in member";
  } else if (effectiveEmail) {
    detail = effectiveEmail;
    subtitle = "Signed in";
  }

  const initials = merchantStore
    ? initialsFrom(merchantStore)
    : effectiveEmail
      ? initialsFrom(emailLocalPart(effectiveEmail))
      : initialsFrom(getPersonaLabel(persona));

  return {
    persona,
    personaLabel: getPersonaLabel(persona),
    detail,
    subtitle,
    initials,
    memberEmail: effectiveEmail,
    merchantStore,
    merchantCode,
    applicationStatus,
    adminLabel,
  };
}

function getStoredMemberFallback(): string | null {
  if (typeof localStorage === "undefined") return null;
  const email = localStorage.getItem("b2c_member_email")?.trim();
  return email || null;
}

export function setupAccountSwitcher(apiBase = API_BASE): void {
  const trigger = document.getElementById("persona-trigger");
  const menu = document.getElementById("persona-menu");
  const label = document.getElementById("persona-label");
  const detailEl = document.getElementById("account-detail");
  const summaryEl = document.getElementById("account-summary");
  const subtitleEl = document.getElementById("account-subtitle");
  const initialsEl = document.getElementById("account-initials");
  if (!trigger || !menu) return;

  const pathPersona = inferPersonaFromPath(window.location.pathname);
  if (pathPersona && pathPersona !== $persona.get()) {
    $persona.set(pathPersona);
  }

  let refreshTimer: number | undefined;

  async function refresh() {
    const snapshot = await loadAccountSnapshot(apiBase);
    if (label) label.textContent = snapshot.personaLabel;
    if (detailEl) detailEl.textContent = snapshot.detail;
    if (summaryEl) {
      summaryEl.textContent = `${snapshot.personaLabel} · ${snapshot.detail}`;
    }
    if (subtitleEl) subtitleEl.textContent = snapshot.subtitle;
    if (initialsEl) initialsEl.textContent = snapshot.initials;

    menu?.querySelectorAll("[data-persona-option]").forEach((btn) => {
      const id = (btn as HTMLElement).dataset.personaOption;
      btn.setAttribute("aria-selected", id === snapshot.persona ? "true" : "false");
      btn.classList.toggle("bg-neutral-50", id === snapshot.persona);
    });
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => void refresh(), 80);
  }

  $persona.subscribe(scheduleRefresh);
  subscribeMemberAuth(scheduleRefresh);
  window.addEventListener("persona-change", scheduleRefresh);
  document.addEventListener("astro:page-load", () => {
    const inferred = inferPersonaFromPath(window.location.pathname);
    if (inferred) $persona.set(inferred);
    scheduleRefresh();
  });

  const close = () => {
    menu.classList.add("hidden");
    trigger.setAttribute("aria-expanded", "false");
  };

  trigger.addEventListener("click", () => {
    const open = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !open);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) void refresh();
  });

  menu.querySelectorAll("[data-persona-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLElement).dataset.personaOption as Persona;
      $persona.set(id);
      close();
      window.dispatchEvent(new CustomEvent("persona-change", { detail: { persona: id } }));
      const routes: Partial<Record<Persona, string>> = {
        merchant: "/sell",
        admin: "/admin",
        member: "/my-coop",
        customer: "/",
      };
      const target = routes[id];
      if (target && !window.location.pathname.startsWith(target)) {
        window.location.href = target;
      }
    });
  });

  document.addEventListener("click", (e) => {
    if (!trigger.contains(e.target as Node) && !menu.contains(e.target as Node)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  void refresh();
}
