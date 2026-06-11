export function setupAdminQueue(apiBase: string): void {
  const loadBtn = document.getElementById("load-pending");
  const secretInput = document.getElementById("admin-secret");
  const list = document.getElementById("order-list");
  const loadError = document.getElementById("admin-load-error");

  function getSecret(): string {
    if (secretInput instanceof HTMLInputElement) return secretInput.value.trim();
    return "";
  }

  async function confirmOrder(orderId: string) {
    const secret = getSecret();
    if (!secret) throw new Error("Enter staff secret first");
    const res = await fetch(`${apiBase}/admin/orders/${orderId}/confirm-pickup`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Confirm failed");
    return data;
  }

  loadBtn?.addEventListener("click", async () => {
    const secret = getSecret();
    loadError?.classList.add("hidden");
    if (!secret) {
      if (loadError) {
        loadError.textContent = "Enter staff secret";
        loadError.classList.remove("hidden");
      }
      return;
    }

    if (!list) return;

    try {
      const res = await fetch(`${apiBase}/admin/orders/pending`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");

      if (!data.orders?.length) {
        list.innerHTML = '<p class="text-neutral-500">No pending pickup orders.</p>';
        return;
      }

      list.innerHTML = data.orders
        .map(
          (o: { orderId: string; grossAmount: string; guestEmail: string; externalId: string }) => `
        <article class="elevation-1 p-4" data-order-id="${o.orderId}">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-price m-0 text-brand-600">₱${Number(o.grossAmount).toFixed(2)}</p>
              <p class="text-body-sm m-0 mt-1">${o.guestEmail}</p>
              <p class="text-caption text-neutral-500 m-0 mt-1 font-mono">${o.externalId}</p>
            </div>
            <div class="flex flex-col gap-2">
              <a href="/order/${o.orderId}" class="text-body-sm font-semibold text-brand-600">Receipt →</a>
              <button type="button" class="b2c-confirm-pickup touch-target min-h-10 px-4 rounded-lg bg-accent-600 text-white text-body-sm font-semibold border-0 cursor-pointer" data-id="${o.orderId}">
                Confirm pickup
              </button>
            </div>
          </div>
          <p class="hidden text-body-sm mt-2 m-0 b2c-confirm-msg" role="status"></p>
        </article>`,
        )
        .join("");

      list.querySelectorAll(".b2c-confirm-pickup").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (!id) return;
          const card = btn.closest("[data-order-id]");
          const msg = card?.querySelector(".b2c-confirm-msg");
          if (btn instanceof HTMLButtonElement) btn.disabled = true;
          try {
            const result = await confirmOrder(id);
            if (msg) {
              msg.textContent = `Posted — ${result.status}`;
              msg.className = "text-body-sm mt-2 m-0 text-success-600 b2c-confirm-msg";
              msg.classList.remove("hidden");
            }
            setTimeout(() => loadBtn?.click(), 1000);
          } catch (err) {
            if (msg) {
              msg.textContent = err instanceof Error ? err.message : "Failed";
              msg.className = "text-body-sm mt-2 m-0 text-danger-600 b2c-confirm-msg";
              msg.classList.remove("hidden");
            }
            if (btn instanceof HTMLButtonElement) btn.disabled = false;
          }
        });
      });
    } catch (err) {
      if (loadError) {
        loadError.textContent = err instanceof Error ? err.message : "Load failed";
        loadError.classList.remove("hidden");
      }
    }
  });
}
