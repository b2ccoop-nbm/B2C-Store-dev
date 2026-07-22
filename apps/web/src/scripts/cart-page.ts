import type { CheckoutQuoteResponse, FulfillmentMode, PaymentMethod } from "@b2ccoop/store-shared";
import { readCart, updateQty, clearCart } from "@/lib/cart";
import { formatPhp } from "@/lib/format";

type QuoteState = CheckoutQuoteResponse | null;

export function setupCartPage(apiBase: string, turnstileSiteKey: string): void {
  const root = document.getElementById("cart-root");
  const checkoutPanel = document.getElementById("checkout-panel");
  const checkoutForm = document.getElementById("checkout-form");
  const checkoutError = document.getElementById("checkout-error");
  const checkoutSubmit = document.getElementById("checkout-submit");
  const stickyCheckout = document.getElementById("sticky-checkout");
  const stickyCheckoutBtn = document.getElementById("sticky-checkout-btn");
  const fulfillmentEl = document.getElementById("fulfillment-options");
  const paymentEl = document.getElementById("payment-options");
  const deliveryFields = document.getElementById("delivery-address-fields");
  const pickupSummary = document.getElementById("pickup-summary");

  let quote: QuoteState = null;
  let fulfillmentMode: FulfillmentMode = "delivery";
  let paymentMethod: PaymentMethod = "pickup";
  let onlinePaymentEnabled = false;
  let quoteLoading = false;

  function patronageTotal(cart: ReturnType<typeof readCart>): number {
    return cart.reduce((sum, line) => sum + Number(line.patronagePerUnit) * line.quantity, 0);
  }

  function selectedTotal(): number {
    if (!quote) return 0;
    if (fulfillmentMode === "merchant_pickup") {
      return Number(quote.merchandiseSubtotal);
    }
    return Number(quote.totalAmount);
  }

  function submitLabel(): string {
    if (paymentMethod === "online") {
      return "Continue to PayMongo — GCash / QR Ph / card";
    }
    return fulfillmentMode === "delivery"
      ? "Place order — pay on delivery"
      : "Place order — pay at pickup";
  }

  function paymentHint(): string {
    if (paymentMethod === "online") {
      return "You’ll pay now on PayMongo’s secure page (GCash, Maya, QR Ph, cards).";
    }
    return fulfillmentMode === "delivery"
      ? "Pay when your order is delivered."
      : "Pay when you pick up from the seller.";
  }

  function updateCheckoutControls(): void {
    const isDelivery = fulfillmentMode === "delivery";
    deliveryFields?.classList.toggle("hidden", !isDelivery);
    pickupSummary?.classList.toggle("hidden", isDelivery || !quote?.pickupAvailable);
    if (checkoutSubmit instanceof HTMLButtonElement) {
      checkoutSubmit.textContent = submitLabel();
    }
    renderTotals();
  }

  function renderTotals(): void {
    const totals = document.getElementById("cart-totals");
    if (!totals || !quote) return;
    const patronage = patronageTotal(readCart());
    const deliveryLine =
      fulfillmentMode === "delivery"
        ? `<p class="text-body-sm m-0 flex justify-between"><span>Delivery</span><span>${formatPhp(Number(quote.deliveryFee))}${quote.deliveryCapApplied ? " <span class=\"text-caption text-neutral-500\">(capped)</span>" : ""}</span></p>`
        : "";
    totals.innerHTML = `
      <p class="text-body-sm m-0 flex justify-between"><span>Subtotal</span><span>${formatPhp(Number(quote.merchandiseSubtotal))}</span></p>
      ${deliveryLine}
      ${
        patronage > 0
          ? `<p class="text-body-sm text-coop-600 m-0 flex justify-between"><span>Est. patronage</span><span class="font-semibold">${formatPhp(patronage)}</span></p>`
          : ""
      }
      <p class="text-title-sm m-0 flex justify-between pt-2 border-t border-neutral-200"><span>Total</span><span>${formatPhp(selectedTotal())}</span></p>
      <p class="text-caption text-neutral-500 m-0">${paymentHint()}</p>`;
  }

  function renderPickupSummary(): void {
    if (!pickupSummary || !quote?.pickup) return;
    const p = quote.pickup;
    pickupSummary.innerHTML = `
      <p class="text-body-sm font-semibold m-0 mb-1">Pickup location</p>
      <p class="text-body-sm m-0">${p.address}</p>
      ${p.landmark ? `<p class="text-caption text-neutral-500 m-0 mt-1">Landmark: ${p.landmark}</p>` : ""}
      ${p.hours ? `<p class="text-caption text-neutral-500 m-0 mt-1">Hours: ${p.hours}</p>` : ""}
      ${p.phone ? `<p class="text-caption text-neutral-500 m-0 mt-1">Contact: ${p.phone}</p>` : ""}
      ${p.instructions ? `<p class="text-caption text-neutral-500 m-0 mt-2">${p.instructions}</p>` : ""}`;
  }

  function bindPaymentOptions(): void {
    if (!paymentEl) return;
    paymentEl.classList.toggle("hidden", !onlinePaymentEnabled);
    paymentEl.querySelectorAll<HTMLInputElement>('input[name="paymentMethod"]').forEach((input) => {
      input.checked = input.value === paymentMethod;
    });
  }

  fulfillmentEl?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name !== "fulfillmentMode" || !target.checked) return;
    fulfillmentMode = target.value as FulfillmentMode;
    updateCheckoutControls();
  });

  paymentEl?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name !== "paymentMethod" || !target.checked) return;
    paymentMethod = target.value as PaymentMethod;
    updateCheckoutControls();
  });

  function bindFulfillmentOptions(): void {
    if (!fulfillmentEl) return;
    fulfillmentEl.querySelectorAll<HTMLInputElement>('input[name="fulfillmentMode"]').forEach((input) => {
      input.checked = input.value === fulfillmentMode;
      input.disabled = input.value === "merchant_pickup" && !quote?.pickupAvailable;
    });
    renderPickupSummary();
    bindPaymentOptions();
    updateCheckoutControls();
  }

  async function loadCheckoutSettings(): Promise<void> {
    try {
      const res = await fetch(`${apiBase}/settings/commerce`);
      const data = await res.json();
      onlinePaymentEnabled = Boolean(data.checkout?.onlinePaymentEnabled);
      if (!onlinePaymentEnabled && paymentMethod === "online") {
        paymentMethod = "pickup";
      }
    } catch {
      onlinePaymentEnabled = false;
      paymentMethod = "pickup";
    }
    bindPaymentOptions();
  }

  async function loadQuote(): Promise<void> {
    const cart = readCart();
    if (!cart.length) {
      quote = null;
      return;
    }
    quoteLoading = true;
    try {
      const res = await fetch(`${apiBase}/checkout/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ sku: l.sku, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not calculate delivery");
      quote = data as CheckoutQuoteResponse;
      if (!quote.pickupAvailable && fulfillmentMode === "merchant_pickup") {
        fulfillmentMode = "delivery";
      }
    } catch (err) {
      quote = null;
      if (checkoutError) {
        checkoutError.textContent = err instanceof Error ? err.message : "Could not load checkout quote";
        checkoutError.classList.remove("hidden");
      }
    } finally {
      quoteLoading = false;
      bindFulfillmentOptions();
    }
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
      <div id="cart-totals" class="mt-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
        ${quoteLoading ? "<p class=\"text-body-sm text-neutral-500 m-0\">Calculating delivery…</p>" : ""}
      </div>`;

    root.querySelectorAll("[data-dec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sku = btn.getAttribute("data-dec");
        const line = readCart().find((l) => l.sku === sku);
        if (line && sku) updateQty(sku, line.quantity - 1);
        void renderWithQuote();
      });
    });
    root.querySelectorAll("[data-inc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sku = btn.getAttribute("data-inc");
        const line = readCart().find((l) => l.sku === sku);
        if (line && sku) updateQty(sku, line.quantity + 1);
        void renderWithQuote();
      });
    });

    renderTotals();
    window.dispatchEvent(new CustomEvent("cart-updated"));
  }

  async function renderWithQuote(): Promise<void> {
    render();
    await loadQuote();
    renderTotals();
    bindFulfillmentOptions();
  }

  stickyCheckoutBtn?.addEventListener("click", () => {
    checkoutPanel?.scrollIntoView({ behavior: "smooth" });
    document.getElementById("checkout-email")?.focus();
  });

  checkoutForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    checkoutError?.classList.add("hidden");
    if (!(checkoutForm instanceof HTMLFormElement)) return;
    if (!quote) {
      if (checkoutError) {
        checkoutError.textContent = "Delivery quote not ready — try again in a moment.";
        checkoutError.classList.remove("hidden");
      }
      return;
    }

    const fd = new FormData(checkoutForm);
    const cart = readCart();
    const turnstileToken = turnstileSiteKey
      ? (document.querySelector("[name=cf-turnstile-response]") as HTMLInputElement | null)?.value
      : undefined;

    const body: Record<string, unknown> = {
      email: String(fd.get("email") ?? ""),
      displayName: String(fd.get("displayName") ?? "") || undefined,
      paymentMethod,
      fulfillmentMode,
      items: cart.map((l) => ({ sku: l.sku, quantity: l.quantity })),
      ...(turnstileToken ? { turnstileToken } : {}),
    };

    if (fulfillmentMode === "delivery") {
      const recipientName = String(fd.get("recipientName") ?? "").trim();
      const phone = String(fd.get("deliveryPhone") ?? "").trim();
      const line1 = String(fd.get("addressLine1") ?? "").trim();
      const city = String(fd.get("city") ?? "").trim();
      if (!recipientName || !phone || !line1 || !city) {
        if (checkoutError) {
          checkoutError.textContent = "Complete the delivery address to continue.";
          checkoutError.classList.remove("hidden");
        }
        return;
      }
      body.deliveryAddress = {
        recipientName,
        phone,
        line1,
        line2: String(fd.get("addressLine2") ?? "").trim() || undefined,
        barangay: String(fd.get("barangay") ?? "").trim() || undefined,
        city,
        province: String(fd.get("province") ?? "").trim() || undefined,
        postalCode: String(fd.get("postalCode") ?? "").trim() || undefined,
        notes: String(fd.get("deliveryNotes") ?? "").trim() || undefined,
      };
    }

    if (checkoutSubmit instanceof HTMLButtonElement) {
      checkoutSubmit.disabled = true;
      checkoutSubmit.textContent = paymentMethod === "online" ? "Opening PayMongo…" : "Placing order…";
    }
    try {
      const res = await fetch(`${apiBase}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");

      if (paymentMethod === "online" && typeof data.checkoutUrl === "string") {
        clearCart();
        window.location.href = data.checkoutUrl;
        return;
      }

      clearCart();
      window.location.href = `/order/${data.orderId}`;
    } catch (err) {
      if (checkoutError) {
        checkoutError.textContent = err instanceof Error ? err.message : "Checkout failed";
        checkoutError.classList.remove("hidden");
      }
      if (checkoutSubmit instanceof HTMLButtonElement) {
        checkoutSubmit.disabled = false;
        checkoutSubmit.textContent = submitLabel();
      }
    }
  });

  void loadCheckoutSettings().then(() => renderWithQuote());
  if (window.location.hash === "#checkout") {
    checkoutPanel?.scrollIntoView({ behavior: "smooth" });
  }
}
