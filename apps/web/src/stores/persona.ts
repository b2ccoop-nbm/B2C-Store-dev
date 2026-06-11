import { persistentAtom } from "@nanostores/persistent";

/** Persona framework — no role-specific logic in Sprint 1 */
export type Persona = "customer" | "member" | "merchant" | "officer" | "admin";

export const PERSONAS: ReadonlyArray<{ id: Persona; label: string; description: string }> = [
  { id: "customer", label: "Customer", description: "Shop and browse the marketplace" },
  { id: "member", label: "Member", description: "Member benefits and coop life" },
  { id: "merchant", label: "Merchant", description: "Sell products and services" },
  { id: "officer", label: "Officer", description: "Coop staff operations" },
  { id: "admin", label: "Admin", description: "HQ administration" },
] as const;

export const $persona = persistentAtom<Persona>("b2ccoop_persona", "customer");

export function isOfficerPersona(persona: Persona): boolean {
  return persona === "officer" || persona === "admin";
}

export function getPersonaLabel(persona: Persona): string {
  return PERSONAS.find((p) => p.id === persona)?.label ?? "Customer";
}
