import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID ?? "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey?.trim() && firebaseConfig.projectId?.trim(),
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export { app, auth };
