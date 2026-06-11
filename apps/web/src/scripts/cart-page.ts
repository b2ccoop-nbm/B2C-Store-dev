import { readCart, updateQty, clearCart, cartTotals } from "@/lib/cart";
import { formatPhp } from "@/lib/format";

export function setupCartPage(apiBase: string, turnstileSiteKey: string): void {
  const root = document.getElementById("cart-root");
  const checkoutPanel = document.getElementById("checkout-panel");
  const checkoutForm = document.getElementById("checkout-form");
  const checkoutError = document.getElementById("checkout-error");
  const checkoutSubmit = document.getElementById("checkout-submit");

  function render() {
    const cart = readCart();
    if (!root || !checkoutPanel) return;

    if (!cart.length) {
      root.innerHTML = `
        <p class="text-neutral-500">Your cart is empty.</p>
        <a href="/category/products" class="inline-flex mt-4 text-brand-600 font-semibold">Browse products →</a>
      `;
      checkoutPanel.classList.add("hidden");
      window.dispatchEvent(new CustomEvent("cart-updated"));
      return;
    }

    checkoutPanel.classList.remove("hidden");
    const { gross } = cartTotals(cart);

    root.innerHTML = `
      <ul class="list-none m-0 p-0 divide-y divide-neutral-200">
        ${cart
          .map(
            (line) => `
          <li class="py-4 flex flex-wrap items-center justify-between gap-4" data-sku="${line.sku}">
            <div>
              <p class="font-semibold m-0">${line.name}</p>
              <p class="text-body-sm text-neutral-500 m-0">${line.sku}</p>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" class="touch-target w-10 h-10 rounded-lg border border-neutral-200 bg-neutral-0" data-dec="${line.sku}" aria-label="Decrease quantity">−</button>
              <span class="min-w-[2ch] text-center font-medium">${line.quantity}</span>
              <button type="button" class="touch-target w-10 h-10 rounded-lg border border-neutral-200 bg-neutral-0" data-inc="${line.sku}" aria-label="Increase quantity">+</button>
              <span class="font-semibold min-w-[5rem] text-right">${formatPhp(Number(line.unitPrice) * line.quantity)}</span>
            </div>
          </li>`,
          )
          .join("")}
      </ul>
      <div class="mt-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
        <p class="text-title-sm m-0 flex justify-between"><span>Total</span><span>${formatPhp(gross)}</span></p>
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

    if (checkoutSubmit instanceof HTMLButtonElement) checkoutSubmit.disabled = true;
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
      if (checkoutSubmit instanceof HTMLButtonElement) checkoutSubmit.disabled = false;
    }
  });

  render();
  if (window.location.hash === "#checkout") {
    document.getElementById("checkout-panel")?.scrollIntoView({ behavior: "smooth" });
  }
}
