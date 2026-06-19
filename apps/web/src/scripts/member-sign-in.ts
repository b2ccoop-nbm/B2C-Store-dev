import { API_BASE } from "@/lib/api";
import {
  getFirebaseIdToken,
  getStoredMemberEmail,
  isMemberAuthConfigured,
  signInWithEmail,
  signInWithGoogle,
  signOutMember,
  subscribeMemberAuth,
} from "@/lib/member-auth";

export function setupMemberSignIn(apiBase = API_BASE): void {
  const panel = document.getElementById("member-sign-in-panel");
  const signedInPanel = document.getElementById("member-signed-in-panel");
  const emailInput = document.getElementById("member-sign-in-email");
  const passwordInput = document.getElementById("member-sign-in-password");
  const errorEl = document.getElementById("member-sign-in-error");
  const emailLabel = document.getElementById("member-signed-in-email");
  const merchantHint = document.getElementById("member-merchant-hint");
  const signInBtn = document.getElementById("member-sign-in-btn");
  const googleBtn = document.getElementById("member-google-sign-in-btn");
  const signOutBtn = document.getElementById("member-sign-out-btn");

  if (!isMemberAuthConfigured()) {
    panel?.classList.add("hidden");
    return;
  }

  panel?.classList.remove("hidden");

  async function refreshMerchantHint() {
    if (!merchantHint) return;
    const token = await getFirebaseIdToken();
    if (!token) {
      merchantHint.classList.add("hidden");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/members/merchant-context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        merchantHint.classList.add("hidden");
        return;
      }
      const data = await res.json();
      if (data.isApprovedVendor && data.vendor) {
        merchantHint.innerHTML = `You have an approved store: <strong>${data.vendor.name}</strong>. <a href="/sell" class="text-brand-600 font-semibold">Open seller dashboard →</a>`;
        merchantHint.classList.remove("hidden");
      } else if (data.application?.status === "PENDING") {
        merchantHint.textContent = "Your seller application is under review.";
        merchantHint.classList.remove("hidden");
      } else {
        merchantHint.classList.add("hidden");
      }
    } catch {
      merchantHint.classList.add("hidden");
    }
  }

  function showUser(email: string | null) {
    if (email) {
      panel?.classList.add("hidden");
      signedInPanel?.classList.remove("hidden");
      if (emailLabel) emailLabel.textContent = email;
      void refreshMerchantHint();
    } else {
      panel?.classList.remove("hidden");
      signedInPanel?.classList.add("hidden");
      merchantHint?.classList.add("hidden");
    }
  }

  subscribeMemberAuth((user) => {
    showUser(user?.email ?? null);
  });

  const stored = getStoredMemberEmail();
  if (stored && emailInput instanceof HTMLInputElement && !emailInput.value) {
    emailInput.value = stored;
  }

  signInBtn?.addEventListener("click", async () => {
    errorEl?.classList.add("hidden");
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : "";
    if (!email || !password) {
      if (errorEl) {
        errorEl.textContent = "Enter email and password.";
        errorEl.classList.remove("hidden");
      }
      return;
    }
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Sign-in failed";
        errorEl.classList.remove("hidden");
      }
    }
  });

  googleBtn?.addEventListener("click", async () => {
    errorEl?.classList.add("hidden");
    try {
      await signInWithGoogle();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : "Google sign-in failed";
        errorEl.classList.remove("hidden");
      }
    }
  });

  signOutBtn?.addEventListener("click", () => {
    void signOutMember();
  });
}
