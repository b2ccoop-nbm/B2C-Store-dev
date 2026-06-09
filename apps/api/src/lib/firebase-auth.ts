import { createRemoteJWKSet, jwtVerify } from "jose";
import type { WorkerEnv } from "../env";

export type VerifiedFirebaseUser = {
  uid: string;
  email: string;
};

const jwksByProject = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksForProject(projectId: string) {
  let jwks = jwksByProject.get(projectId);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(
        "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      ),
    );
    jwksByProject.set(projectId, jwks);
  }
  return jwks;
}

export async function verifyFirebaseIdToken(
  env: WorkerEnv,
  idToken: string,
): Promise<VerifiedFirebaseUser | null> {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(idToken, jwksForProject(projectId), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!email || !uid) {
      return null;
    }

    return { uid, email };
  } catch {
    return null;
  }
}
