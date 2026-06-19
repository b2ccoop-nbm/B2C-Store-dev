import { API_BASE } from "@/lib/api";
import { loadOnboardingContext } from "@/lib/merchant-onboarding";

type GateOptions = {
  /** Disable interactive elements inside this container when gated */
  containerId?: string;
  /** Custom message element id (creates gate banner if missing) */
  messageId?: string;
};

export function setupMerchantPageGate(apiBase = API_BASE, options: GateOptions = {}): void {
  const messageId = options.messageId ?? "merchant-gate-msg";
  const containerId = options.containerId;

  void (async () => {
    const ctx = await loadOnboardingContext(apiBase);
    if (ctx.canSell) return;

    let gateMsg = document.getElementById(messageId);
    if (!gateMsg) {
      gateMsg = document.createElement("p");
      gateMsg.id = messageId;
      gateMsg.className =
        "text-body-sm text-merchant-700 bg-merchant-50 border border-merchant-200 rounded-lg px-4 py-3 mb-6 m-0";
      gateMsg.setAttribute("role", "status");
      const main = document.querySelector("main#main-content");
      const header = main?.querySelector("header");
      if (header?.nextSibling) {
        main?.insertBefore(gateMsg, header.nextSibling);
      } else if (main) {
        main.prepend(gateMsg);
      }
    }

    let message = "Complete your seller application to use this page.";
    if (ctx.application?.status === "PENDING") {
      message =
        "Your application is under review. This page unlocks after HQ approval and you save your access token.";
    } else if (ctx.application?.status === "APPROVED") {
      message =
        "Application approved — save your access token on the Apply page to unlock seller tools.";
    } else if (!ctx.application) {
      message = 'Submit a <a href="/sell/apply" class="text-brand-600 font-semibold">seller application</a> first.';
    }
    gateMsg.innerHTML = message;
    gateMsg.classList.remove("hidden");

    const container = containerId ? document.getElementById(containerId) : null;
    const root = container ?? document.querySelector("main#main-content");
    root?.querySelectorAll("a, button, input, select, textarea").forEach((el) => {
      if (el.closest(`#${messageId}`)) return;
      if (el instanceof HTMLAnchorElement && el.getAttribute("href")?.startsWith("/sell/apply")) return;
      if (el instanceof HTMLAnchorElement) {
        el.classList.add("pointer-events-none", "opacity-50");
        el.setAttribute("aria-disabled", "true");
        el.removeAttribute("href");
      } else if (el instanceof HTMLButtonElement) {
        el.disabled = true;
        el.classList.add("opacity-50");
      } else if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        el.disabled = true;
        el.classList.add("opacity-50");
      }
    });
  })();
}
