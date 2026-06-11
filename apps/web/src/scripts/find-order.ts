export function setupFindOrder(apiBase: string): void {
  const form = document.getElementById("find-order-form");
  const findError = document.getElementById("find-error");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    findError?.classList.add("hidden");
    if (!(form instanceof HTMLFormElement)) return;
    const fd = new FormData(form);
    const orderId = String(fd.get("orderId") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();

    try {
      const res = await fetch(`${apiBase}/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error("Order not found");
      const orderEmail = String(data.guestEmail ?? "").toLowerCase();
      if (orderEmail && orderEmail !== email) {
        throw new Error("Email does not match this order");
      }
      window.location.href = `/order/${orderId}`;
    } catch (err) {
      if (findError) {
        findError.textContent = err instanceof Error ? err.message : "Could not find order";
        findError.classList.remove("hidden");
      }
    }
  });
}
