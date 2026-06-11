import { API_BASE } from "@/lib/api";

type OrderRow = {
  orderId: string;
  status: string;
  grossAmount: string;
  vendorCode: string;
  createdAt: string;
  patronageAmount: string;
  bucket: "active" | "completed";
};

export function setupActivityOrders(apiBase = API_BASE): void {
  const form = document.getElementById("activity-email-form");
  const list = document.getElementById("activity-order-list");
  const empty = document.getElementById("activity-empty");
  const errorEl = document.getElementById("activity-error");
  const tabs = document.querySelectorAll<HTMLButtonElement>("[data-activity-tab]");
  let currentTab: "active" | "completed" = "active";
  let cachedOrders: OrderRow[] = [];

  function renderOrders(orders: OrderRow[]) {
    if (!list || !empty) return;
    const filtered = orders.filter((o) => o.bucket === currentTab);
    if (filtered.length === 0) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      empty.textContent =
        currentTab === "active"
          ? "No active orders for this email."
          : "No completed orders for this email.";
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = filtered
      .map(
        (o) => `
      <article class="elevation-1 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-price m-0 text-brand-600">₱${Number(o.grossAmount).toFixed(2)}</p>
            <p class="text-body-sm text-neutral-500 m-0 mt-1">${o.vendorCode} · ${new Date(o.createdAt).toLocaleDateString()}</p>
            ${Number(o.patronageAmount) > 0 ? `<p class="text-body-sm text-coop-600 m-0 mt-1">+₱${Number(o.patronageAmount).toFixed(2)} patronage</p>` : ""}
          </div>
          <div class="text-right">
            <span class="inline-block rounded-full px-2 py-0.5 text-caption font-semibold bg-neutral-100 text-neutral-700">${o.status.replace(/_/g, " ")}</span>
            <p class="m-0 mt-2"><a href="/order/${o.orderId}" class="text-body-sm font-semibold text-brand-600">Receipt →</a></p>
          </div>
        </div>
      </article>`,
      )
      .join("");
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const next = tab.getAttribute("data-activity-tab");
      if (next !== "active" && next !== "completed") return;
      currentTab = next;
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute("aria-selected", selected ? "true" : "false");
        t.className = selected
          ? "px-4 py-3 text-body-sm font-semibold border-b-2 border-brand-600 text-brand-600 bg-transparent cursor-pointer"
          : "px-4 py-3 text-body-sm font-medium text-neutral-500 bg-transparent border-b-2 border-transparent cursor-pointer";
      });
      renderOrders(cachedOrders);
    });
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl?.classList.add("hidden");
    const emailInput = document.getElementById("activity-email");
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    if (!email) return;

    try {
      const res = await fetch(`${apiBase}/orders?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      cachedOrders = data.orders ?? [];
      try {
        localStorage.setItem("b2c_activity_email", email.toLowerCase());
      } catch {
        /* ignore */
      }
      renderOrders(cachedOrders);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Could not load orders";
        errorEl.classList.remove("hidden");
      }
    }
  });

  try {
    const saved = localStorage.getItem("b2c_activity_email");
    const emailInput = document.getElementById("activity-email");
    if (saved && emailInput instanceof HTMLInputElement) {
      emailInput.value = saved;
      form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  } catch {
    /* ignore */
  }
}
