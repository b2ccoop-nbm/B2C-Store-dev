import { API_BASE } from "@/lib/api";
import { loadOnboardingContext } from "@/lib/merchant-onboarding";
import { subscribeMemberAuth } from "@/lib/member-auth";

type GateOptions = {
  /** Disable interactive elements inside this container when gated */
  containerId?: string;
  /** Custom message element id (creates gate banner if missing) */
  messageId?: string;
};

function setInteractiveDisabled(root: ParentNode, disabled: boolean, messageId: string): void {
  root.querySelectorAll("a, button, input, select, textarea").forEach((el) => {
    if (el.closest(`#${messageId}`)) return;
    if (el instanceof HTMLAnchorElement && el.getAttribute("href")?.startsWith("/sell/apply")) return;
    if (el instanceof HTMLAnchorElement && el.getAttribute("href") === "/profile") return;

    if (disabled) {
      if (el instanceof HTMLAnchorElement) {
        if (!el.dataset.gateHref) {
          el.dataset.gateHref = el.getAttribute("href") ?? "";
        }
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
      return;
    }

    if (el instanceof HTMLAnchorElement && el.dataset.gateHref) {
      el.setAttribute("href", el.dataset.gateHref);
      el.classList.remove("pointer-events-none", "opacity-50");
      el.removeAttribute("aria-disabled");
    } else if (el instanceof HTMLButtonElement) {
      el.disabled = false;
      el.classList.remove("opacity-50");
    } else if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ) {
      el.disabled = false;
      el.classList.remove("opacity-50");
    }
  });
}

export function setupMerchantPageGate(apiBase = API_BASE, options: GateOptions = {}): void {
  const messageId = options.messageId ?? "merchant-gate-msg";
  const containerId = options.containerId;

  async function evaluateGate(): Promise<void> {
    const ctx = await loadOnboardingContext(apiBase);
    const container = containerId ? document.getElementById(containerId) : null;
    const root = container ?? document.querySelector("main#main-content");
    let gateMsg = document.getElementById(messageId);

    if (ctx.canSell) {
      gateMsg?.classList.add("hidden");
      if (root) setInteractiveDisabled(root, false, messageId);
      window.dispatchEvent(new CustomEvent("merchant-access-ready"));
      return;
    }

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
        "Your application is under review. Seller tools unlock after HQ approval and member sign-in.";
    } else if (ctx.application?.status === "APPROVED") {
      message =
        'Application approved — sign in on <a href="/profile" class="text-brand-600 font-semibold">Your profile</a> with your member account to unlock seller tools.';
    } else if (!ctx.application) {
      message =
        'Submit a <a href="/sell/apply" class="text-brand-600 font-semibold">seller application</a> first.';
    }
    gateMsg.innerHTML = message;
    gateMsg.classList.remove("hidden");

    if (root) setInteractiveDisabled(root, true, messageId);
  }

  void evaluateGate();
  subscribeMemberAuth(() => {
    void evaluateGate();
  });
}
