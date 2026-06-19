import { API_BASE } from "@/lib/api";
import { loadOnboardingContext, renderOnboardingStepper } from "@/lib/merchant-onboarding";

export function setupMerchantDashboard(apiBase = API_BASE): void {
  const stepperEl = document.getElementById("onboarding-stepper");
  const catalogCard = document.getElementById("dashboard-catalog-card");
  const queueCard = document.getElementById("dashboard-queue-card");
  const gateMsg = document.getElementById("dashboard-gate-msg");

  void (async () => {
    const ctx = await loadOnboardingContext(apiBase);

    if (stepperEl) {
      stepperEl.innerHTML = renderOnboardingStepper(ctx.step);
    }

    if (!ctx.canSell) {
      const disableInteractive = (root: Element | null | undefined) => {
        root?.querySelectorAll("a, button").forEach((el) => {
          if (el instanceof HTMLAnchorElement && el.getAttribute("href") === "/sell/apply") return;
          if (el instanceof HTMLAnchorElement) {
            el.classList.add("pointer-events-none", "opacity-50");
            el.setAttribute("aria-disabled", "true");
            el.removeAttribute("href");
          }
          if (el instanceof HTMLButtonElement) {
            el.disabled = true;
            el.classList.add("opacity-50");
          }
        });
      };

      disableInteractive(catalogCard);
      disableInteractive(queueCard);
      disableInteractive(document.querySelector("main#main-content ul"));

      if (gateMsg) {
        let message = "Complete your seller application to unlock listings and orders.";
        if (ctx.application?.status === "PENDING") {
          message = "Your application is under review. Listings and orders unlock after HQ approval.";
        } else if (ctx.application?.status === "APPROVED" && !ctx.canSell) {
          message = "Application approved — save your access token on the Apply page to unlock seller tools.";
        }
        gateMsg.textContent = message;
        gateMsg.classList.remove("hidden");
      }
    }
  })();
}
