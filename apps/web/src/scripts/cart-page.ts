import { readCart, updateQty, clearCart, cartTotals } from "@/lib/cart";
import { formatPhp } from "@/lib/format";

export function setupCartPage(apiBase: string, turnstileSiteKey: string): void {
  const root = document.getElementById("cart-root");
  const checkoutPanel = document.getElementById("checkout-panel");
  const checkoutForm = document.getElementById("checkout-form");
  const checkoutError = document.getElementById("checkout-error");
  const checkoutSubmit = document.getElementById("checkout-submit");
  const stickyCheckout = document.getElementById("sticky-checkout");
  const stickyCheckoutBtn = document.getElementById("sticky-checkout-btn");

  function patronageTotal(cart: ReturnType<typeof readCart>): number {
    return cart.reduce((sum, line) => sum + Number(line.patronagePerUnit) * line.quantity, 0);
  }

  function render() {
    const cart = readCart();
    if (!root || !checkoutPanel) return;

    if (!cart.length) {
      root.innerHTML = `
        <div class="flex flex-col items-center text-center py-12 px-4 max-w-md mx-auto">
          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-4" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          </div>
          <h2 class="text-title m-0 mb-2">Your cart is empty</h2>
          <p class="text-body text-neutral-500 m-0 mb-4">Add items from the catalog to checkout.</p>
          <a href="/category/products" class="inline-flex min-h-touch items-center justify-center px-6 rounded-lg bg-brand-600 text-white font-semibold no-underline">Browse catalog</a>
        </div>
      `;
      checkoutPanel.classList.add("hidden");
      stickyCheckout?.classList.add("hidden");
      window.dispatchEvent(new CustomEvent("cart-updated"));
      return;
    }

    checkoutPanel.classList.remove("hidden");
    stickyCheckout?.classList.remove("hidden");
    const { gross } = cartTotals(cart);
    const patronage = patronageTotal(cart);

    root.innerHTML = `
      <ul class="list-none m-0 p-0 divide-y divide-neutral-200">
        ${cart
          .map(
            (line) => `
          <li class="py-4 flex flex-wrap items-center justify-between gap-4" data-sku="${line.sku}">
            <div class="min-w-0 flex-1">
              <p class="font-semibold m-0 truncate">${line.name}</p>
              <p class="text-body-sm text-coop-600 m-0">${formatPhp(Number(line.patronagePerUnit))} patronage each</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" class="touch-target w-11 h-11 rounded-lg border border-neutral-200 bg-neutral-0 text-lg" data-dec="${line.sku}" aria-label="Decrease quantity">−</button>
              <span class="min-w-[2ch] text-center font-medium tabular-nums">${line.quantity}</span>
              <button type="button" class="touch-target w-11 h-11 rounded-lg border border-neutral-200 bg-neutral-0 text-lg" data-inc="${line.sku}" aria-label="Increase quantity">+</button>
              <span class="font-semibold min-w-[5.5rem] text-right tabular-nums">${formatPhp(Number(line.unitPrice) * line.quantity)}</span>
            </div>
          </li>`,
          )
          .join("")}
      </ul>
      <div class="mt-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
        ${
          patronage > 0
            ? `<p class="text-body-sm text-coop-600 m-0 flex justify-between"><span>Est. patronage</span><span class="font-semibold">${formatPhp(patronage)}</span></p>`
            : ""
        }
        <p class="text-title-sm m-0 flex justify-between"><span>Total</span><span>${formatPhp(gross)}</span></p>
        <p class="text-caption text-neutral-500 m-0">Pay when you pick up at the counter.</p>
      </div>
    `;

    root.querySelectorAll("[data-dec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sku = btn.getAttribute("data-dec");
        const line = readCart().find((l) => l.sku === sku);
        if (line && sku) updateQty(sku, line.quantity - 1);
        render();
      });
    });
    root.querySelectorAll("[data-inc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sku = btn.getAttribute("data-inc");
        const line = readCart().find((l) => l.sku === sku);
        if (line && sku) updateQty(sku, line.quantity + 1);
        render();
      });
    });
    window.dispatchEvent(new CustomEvent("cart-updated"));
  }

  stickyCheckoutBtn?.addEventListener("click", () => {
    checkoutPanel?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("checkout-email")?.focus();
  });

  checkoutForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    checkoutError?.classList.add("hidden");
    if (!(checkoutForm instanceof HTMLFormElement)) return;
    const fd = new FormData(checkoutForm);
    const cart = readCart();
    const turnstileToken = turnstileSiteKey
      ? (document.querySelector("[name=cf-turnstile-response]") as HTMLInputElement | null)?.value
      : undefined;

    const body = {
      email: String(fd.get("email") ?? ""),
      displayName: String(fd.get("displayName") ?? "") || undefined,
      paymentMethod: "pickup",
      items: cart.map((l) => ({ sku: l.sku, quantity: l.quantity })),
      ...(turnstileToken ? { turnstileToken } : {}),
    };

    if (checkoutSubmit instanceof HTMLButtonElement) {
      checkoutSubmit.disabled = true;
      checkoutSubmit.textContent = "Placing order…";
    }
    try {
      const res = await fetch(`${apiBase}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      clearCart();
      window.location.href = `/order/${data.orderId}`;
    } catch (err) {
      if (checkoutError) {
        checkoutError.textContent = err instanceof Error ? err.message : "Checkout failed";
        checkoutError.classList.remove("hidden");
      }
      if (checkoutSubmit instanceof HTMLButtonElement) {
        checkoutSubmit.disabled = false;
        checkoutSubmit.textContent = "Place order — pay at pickup";
      }
    }
  });

  render();
  if (window.location.hash === "#checkout") {
    checkoutPanel?.scrollIntoView({ behavior: "smooth" });
  }
}
