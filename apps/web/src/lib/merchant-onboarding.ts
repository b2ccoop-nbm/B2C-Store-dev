import { API_BASE } from "@/lib/api";
import { getApplicationStatusToken } from "@/lib/application-status";
import { getFirebaseIdToken, getStoredMemberEmail } from "@/lib/member-auth";
import {
  getMerchantEmail,
  hasMerchantSession,
} from "@/lib/merchant-session";

export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | null;

export type SellerApplication = {
  applicationId: string;
  applicantEmail: string;
  businessName: string;
  businessType: string;
  proposedVendorCode: string | null;
  status: ApplicationStatus;
  reviewNotes: string | null;
  vendor?: { code: string; slug: string; name: string } | null;
};

export type OnboardingStep =
  | "apply"
  | "await_approval"
  | "setup_store"
  | "first_listing"
  | "await_publish"
  | "live";

export const ONBOARDING_STEPS: ReadonlyArray<{ id: OnboardingStep; label: string }> = [
  { id: "apply", label: "Apply" },
  { id: "await_approval", label: "Await approval" },
  { id: "setup_store", label: "Set up store" },
  { id: "first_listing", label: "First listing" },
  { id: "await_publish", label: "Await publish" },
  { id: "live", label: "Live" },
];

export type FetchApplicationOptions = {
  email?: string;
  statusToken?: string;
  firebaseIdToken?: string;
  turnstileToken?: string;
};

export async function fetchSellerApplication(
  apiBase: string,
  options: FetchApplicationOptions = {},
): Promise<SellerApplication | null> {
  const statusToken = options.statusToken ?? getApplicationStatusToken();
  const firebaseIdToken = options.firebaseIdToken ?? (await getFirebaseIdToken()) ?? undefined;
  const email =
    options.email ?? (getMerchantEmail() || getStoredMemberEmail() || undefined);

  if (!statusToken && !firebaseIdToken && !email) {
    return null;
  }

  const body: Record<string, string> = {};
  if (statusToken) body.statusToken = statusToken;
  if (firebaseIdToken) body.firebaseIdToken = firebaseIdToken;
  if (email) body.email = email;
  if (options.turnstileToken) body.turnstileToken = options.turnstileToken;

  const res = await fetch(`${apiBase}/seller/applications/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Could not load application");
  }
  if (!data.found) return null;
  return data.application as SellerApplication;
}

export function resolveOnboardingStep(
  app: SellerApplication | null,
  hasSession: boolean,
  listingSummary?: { hasActive: boolean; hasPending: boolean },
): OnboardingStep {
  if (!app) return "apply";
  if (app.status === "PENDING") return "await_approval";
  if (app.status === "REJECTED") return "apply";
  if (app.status === "APPROVED") {
    if (!hasSession) return "setup_store";
    if (listingSummary?.hasActive) return "live";
    if (listingSummary?.hasPending) return "await_publish";
    return "first_listing";
  }
  return "apply";
}

export function canUseMerchantTools(app: SellerApplication | null): boolean {
  return app?.status === "APPROVED" && hasMerchantSession();
}

export function renderOnboardingStepper(current: OnboardingStep): string {
  const order = ONBOARDING_STEPS.map((s) => s.id);
  const idx = order.indexOf(current);

  return `<ol class="flex flex-wrap gap-2 list-none m-0 p-0 mb-6" aria-label="Seller onboarding progress">
    ${ONBOARDING_STEPS.map((step, i) => {
      const done = i < idx;
      const active = i === idx;
      const state = done ? "done" : active ? "active" : "upcoming";
      const bg =
        state === "done"
          ? "bg-success-50 text-success-700 border-success-200"
          : state === "active"
            ? "bg-merchant-50 text-merchant-700 border-merchant-200"
            : "bg-neutral-50 text-neutral-400 border-neutral-200";
      return `<li class="text-caption font-semibold px-3 py-1.5 rounded-full border ${bg}">${step.label}</li>`;
    }).join("")}
  </ol>`;
}

export async function loadOnboardingContext(apiBase = API_BASE) {
  const application = await fetchSellerApplication(apiBase).catch(() => null);
  const email = application?.applicantEmail ?? getMerchantEmail() ?? getStoredMemberEmail();

  let listingSummary: { hasActive: boolean; hasPending: boolean } | undefined;

  if (application?.status === "APPROVED" && hasMerchantSession()) {
    try {
      const { merchantHeaders } = await import("@/lib/merchant-session");
      const res = await fetch(`${apiBase}/merchant/listings`, { headers: merchantHeaders() });
      if (res.ok) {
        const data = await res.json();
        const listings = (data.listings ?? []) as Array<{ listingStatus: string }>;
        listingSummary = {
          hasActive: listings.some((l) => l.listingStatus === "ACTIVE"),
          hasPending: listings.some((l) => l.listingStatus === "PENDING_REVIEW"),
        };
      }
    } catch {
      /* listings optional for step resolution */
    }
  }

  const step = resolveOnboardingStep(application, hasMerchantSession(), listingSummary);
  return {
    email,
    application,
    step,
    canSell: canUseMerchantTools(application),
  };
}
