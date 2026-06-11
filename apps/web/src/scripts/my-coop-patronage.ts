import { API_BASE } from "@/lib/api";

export function setupMyCoopPatronage(apiBase = API_BASE): void {
  const form = document.getElementById("coop-email-form");
  const card = document.getElementById("patronage-card");
  const errorEl = document.getElementById("coop-error");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl?.classList.add("hidden");
    const emailInput = document.getElementById("coop-email");
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    if (!email || !card) return;

    try {
      const res = await fetch(`${apiBase}/members/store-patronage?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      const total = Number(data.accruedTotal) || 0;
      const count = data.accrualCount ?? 0;
      card.innerHTML = `
        <div class="rounded-xl border border-coop-600/20 bg-coop-50 p-6">
          <p class="text-caption font-semibold uppercase tracking-wide text-coop-600 m-0 mb-2">Store patronage</p>
          <p class="text-display m-0 text-coop-700">₱${total.toFixed(2)}</p>
          <p class="text-body-sm text-neutral-600 mt-2 m-0">${
            count === 0
              ? "Patronage from coop store purchases will appear here."
              : `${count} accrual${count === 1 ? "" : "s"} from marketplace orders.`
          }</p>
          <p class="text-caption text-neutral-500 mt-2 m-0 font-mono">${data.email}</p>
        </div>`;

      try {
        localStorage.setItem("b2c_activity_email", email.toLowerCase());
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Could not load patronage";
        errorEl.classList.remove("hidden");
      }
    }
  });

  try {
    const saved = localStorage.getItem("b2c_activity_email");
    const emailInput = document.getElementById("coop-email");
    if (saved && emailInput instanceof HTMLInputElement) {
      emailInput.value = saved;
      form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  } catch {
    /* ignore */
  }
}
