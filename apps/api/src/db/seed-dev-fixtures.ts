/**
 * Mock dev shoppers & staff — for local / dev testing only.
 * Create matching Firebase users in project b2ccoop-87114 when testing member flows.
 */

export type DevShopper = {
  email: string;
  displayName: string;
  /** Mock WebApp Participant.id — link when WebApp resolve API is wired. */
  participantId?: string;
  memberIdNo?: string;
  notes: string;
};

export type DevStaff = {
  email: string;
  displayName: string;
  role: "store_admin" | "pickup_clerk";
  notes: string;
};

/** Fixed UUIDs so tests and docs stay stable across re-seeds. */
export const DEV_SHOPPERS: DevShopper[] = [
  {
    email: "guest.shopper@b2ccoop.test",
    displayName: "Ana Guest Shopper",
    notes: "Guest checkout — no Firebase; patronage accrues on email only.",
  },
  {
    email: "member.demo@b2ccoop.test",
    displayName: "Ben Demo Member",
    participantId: "a1111111-1111-4111-8111-111111111111",
    memberIdNo: "B2C-DEV-001",
    notes: "Mock member — sign in with Firebase using this email when configured.",
  },
  {
    email: "member.patron@b2ccoop.test",
    displayName: "Carla Patron Member",
    participantId: "a2222222-2222-4222-8222-222222222222",
    memberIdNo: "B2C-DEV-002",
    notes: "Second member for patronage merge tests after account link.",
  },
];

export const DEV_STAFF: DevStaff[] = [
  {
    email: "store.admin@b2ccoop.test",
    displayName: "Dev Store Admin",
    role: "store_admin",
    notes: "Staff pickup confirm + catalog admin (Phase 1c). Use DEV_ADMIN_SECRET in .dev.vars.",
  },
  {
    email: "pickup.clerk@b2ccoop.test",
    displayName: "Dev Pickup Clerk",
    role: "pickup_clerk",
    notes: "Mark orders paid at pickup counter.",
  },
];

/** Sample orders inserted by seed (idempotent on external_id). */
export const DEV_SAMPLE_ORDERS = [
  {
    id: "b1000001-0000-4000-8000-000000000001",
    externalId: "order:dev-guest-pending-001",
    guestEmail: "guest.shopper@b2ccoop.test",
    participantId: null as string | null,
    vendorCode: "B2C-DEMO",
    status: "PENDING_PICKUP" as const,
    grossAmount: "470.00",
    salesAmount: "70.00",
    vendorPayableAmount: "400.00",
    cogsAmount: "400.00",
    patronageAmount: "7.00",
    memo: "Dev fixture — rice + oil bundle (guest)",
    lines: [
      {
        sku: "RICE-5KG",
        productName: "Premium Rice 5kg",
        quantity: 1,
        unitPrice: "350.00",
        lineGross: "350.00",
        linePatronage: "5.00",
      },
      {
        sku: "OIL-1L",
        productName: "Cooking Oil 1L",
        quantity: 1,
        unitPrice: "120.00",
        lineGross: "120.00",
        linePatronage: "2.00",
      },
    ],
  },
  {
    id: "b1000002-0000-4000-8000-000000000002",
    externalId: "order:dev-member-paid-001",
    guestEmail: "member.demo@b2ccoop.test",
    participantId: "a1111111-1111-4111-8111-111111111111",
    vendorCode: "B2C-DEMO",
    status: "PAID" as const,
    grossAmount: "85.00",
    salesAmount: "12.00",
    vendorPayableAmount: "73.00",
    cogsAmount: "73.00",
    patronageAmount: "1.50",
    memo: "Dev fixture — sugar (member, paid at pickup)",
    lines: [
      {
        sku: "SUGAR-1KG",
        productName: "Brown Sugar 1kg",
        quantity: 1,
        unitPrice: "85.00",
        lineGross: "85.00",
        linePatronage: "1.50",
      },
    ],
  },
] as const;
