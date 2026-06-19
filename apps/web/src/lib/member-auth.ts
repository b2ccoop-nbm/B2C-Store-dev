import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

const EMAIL_KEY = "b2c_member_email";

export function isMemberAuthConfigured(): boolean {
  return isFirebaseConfigured && Boolean(auth);
}

export function getStoredMemberEmail(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(EMAIL_KEY)?.trim() ?? "";
}

function persistMemberEmail(email: string): void {
  if (email) localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  else localStorage.removeItem(EMAIL_KEY);
}

export async function getFirebaseIdToken(): Promise<string | null> {
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export function subscribeMemberAuth(onChange: (user: User | null) => void): () => void {
  if (!auth) {
    onChange(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    persistMemberEmail(user?.email ?? "");
    onChange(user);
  });
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  if (!auth) throw new Error("Member sign-in is not configured");
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error("Member sign-in is not configured");
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOutMember(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
  persistMemberEmail("");
}

export async function fetchMerchantContext(apiBase: string) {
  const token = await getFirebaseIdToken();
  if (!token) return null;

  const res = await fetch(`${apiBase}/members/merchant-context`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    isApprovedVendor: boolean;
    vendor: { code: string; slug: string; name: string; linked: boolean } | null;
    application: { status: string; businessName: string } | null;
  }>;
}

export async function bindVendorToMember(apiBase: string, vendorCode: string): Promise<boolean> {
  const token = await getFirebaseIdToken();
  if (!token) return false;

  const res = await fetch(
    `${apiBase}/merchant/bind-firebase?vendorCode=${encodeURIComponent(vendorCode)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firebaseIdToken: token }),
    },
  );
  return res.ok;
}
