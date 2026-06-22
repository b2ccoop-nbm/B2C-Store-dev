import { API_BASE } from "@/lib/api";
import {
  getFirebaseIdToken,
  isMemberAuthConfigured,
  signInWithEmail,
  signInWithGoogle,
  signOutMember,
  subscribeMemberAuth,
} from "@/lib/member-auth";
import {
  fetchStoreAdminSession,
  isDevBuild,
  MERCHANT_APPROVER_LABELS,
  persistDevAdminSecret,
  restoreDevAdminSecret,
  type StoreAdminSession,
} from "@/lib/store-admin";

export type StoreAdminAuthState = {
  session: StoreAdminSession | null;
  headers: HeadersInit | null;
};

export function setupStoreAdminSignIn(
  apiBase = API_BASE,
  onAuthChange?: (state: StoreAdminAuthState) => void,
): void {
  const signInCard = document.getElementById("admin-sign-in-card");
  const signedInCard = document.getElementById("admin-signed-in-card");
  const devSecretCard = document.getElementById("admin-dev-secret-card");
  const emailInput = document.getElementById("admin-sign-in-email");
  const passwordInput = document.getElementById("admin-sign-in-password");
  const signInBtn = document.getElementById("admin-sign-in-btn");
  const googleBtn = document.getElementById("admin-google-sign-in-btn");
  const signOutBtn = document.getElementById("admin-sign-out-btn");
  const signInError = document.getElementById("admin-sign-in-error");
  const signedInLabel = document.getElementById("admin-signed-in-label");
  const secretInput = document.getElementById("admin-secret");

  if (devSecretCard) {
    devSecretCard.classList.toggle("hidden", !isDevBuild());
  }

  restoreDevAdminSecret(secretInput instanceof HTMLInputElement ? secretInput : null);
  secretInput?.addEventListener("change", () => {
    if (secretInput instanceof HTMLInputElement) {
      persistDevAdminSecret(secretInput.value.trim());
      void refresh();
    }
  });

  if (!isMemberAuthConfigured()) {
    signInCard?.classList.add("hidden");
  }

  async function refresh(firebaseEmail?: string | null) {
    const devSecret = secretInput instanceof HTMLInputElement ? secretInput.value.trim() : "";
    const session = await fetchStoreAdminSession(apiBase, devSecret);
    const firebaseToken = await getFirebaseIdToken();

    let headers: HeadersInit | null = null;
    if (session?.ok) {
      if (firebaseToken) {
        headers = { Authorization: `Bearer ${firebaseToken}` };
      } else if (devSecret && session.mode === "dev_secret") {
        headers = { Authorization: `Bearer ${devSecret}` };
      }
    }

    const state: StoreAdminAuthState = { session, headers };

    if (session?.ok && headers) {
      signInCard?.classList.add("hidden");
      signedInCard?.classList.remove("hidden");
      signInError?.classList.add("hidden");
      if (signedInLabel) {
        signedInLabel.textContent = `${session.label} (${session.email})`;
      }
    } else {
      signInCard?.classList.remove("hidden");
      signedInCard?.classList.add("hidden");
      if (firebaseEmail && signInError) {
        signInError.textContent = `${firebaseEmail} is not authorized for store admin.`;
        signInError.classList.remove("hidden");
      }
    }

    onAuthChange?.(state);
  }

  subscribeMemberAuth((user) => {
    void refresh(user?.email ?? null);
  });

  signInBtn?.addEventListener("click", async () => {
    signInError?.classList.add("hidden");
    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : "";
    if (!email || !password) {
      if (signInError) {
        signInError.textContent = "Enter email and password.";
        signInError.classList.remove("hidden");
      }
      return;
    }
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      if (signInError) {
        signInError.textContent = err instanceof Error ? err.message : "Sign-in failed";
        signInError.classList.remove("hidden");
      }
    }
  });

  googleBtn?.addEventListener("click", async () => {
    signInError?.classList.add("hidden");
    try {
      await signInWithGoogle();
    } catch (err) {
      if (signInError) {
        signInError.textContent = err instanceof Error ? err.message : "Google sign-in failed";
        signInError.classList.remove("hidden");
      }
    }
  });

  signOutBtn?.addEventListener("click", () => {
    void signOutMember();
  });

  void refresh();
}

export function renderApproverListHtml(): string {
  return `<ul class="mt-3 space-y-1 text-body-sm m-0 pl-5">
    ${Object.entries(MERCHANT_APPROVER_LABELS)
      .map(
        ([email, label]) =>
          `<li><span class="font-semibold">${label}</span> — <span class="text-neutral-600">${email}</span></li>`,
      )
      .join("")}
  </ul>`;
}
