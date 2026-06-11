export function setupOrderConfirm(apiBase: string, orderId: string): void {
  const btn = document.getElementById("confirm-pickup");
  const secretInput = document.getElementById("admin-secret");
  const msg = document.getElementById("admin-msg");

  btn?.addEventListener("click", async () => {
    const secret = secretInput instanceof HTMLInputElement ? secretInput.value.trim() : "";
    if (!secret) {
      if (msg) {
        msg.textContent = "Enter staff secret";
        msg.className = "text-body-sm mt-3 m-0 text-danger-600";
        msg.classList.remove("hidden");
      }
      return;
    }
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    try {
      const res = await fetch(`${apiBase}/admin/orders/${orderId}/confirm-pickup`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirm failed");
      if (msg) {
        msg.textContent = "Payment confirmed — receipt will update shortly.";
        msg.className = "text-body-sm mt-3 m-0 text-success-600";
        msg.classList.remove("hidden");
      }
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      if (msg) {
        msg.textContent = err instanceof Error ? err.message : "Confirm failed";
        msg.className = "text-body-sm mt-3 m-0 text-danger-600";
        msg.classList.remove("hidden");
      }
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
    }
  });
}
