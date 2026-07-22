import { and, desc, eq } from "drizzle-orm";
import { inferSellerKindFromVendorCode } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { sellerApplications, vendors } from "../db/schema";
import { slugify, vendorCodeFromName } from "../lib/slug";
import {
  generateStatusAccessToken,
  hashStatusAccessToken,
} from "../lib/status-access-token";
import { provisionVendorInAccounting } from "./accounting-vendors";
import { generateVendorToken, hashVendorToken } from "../lib/vendor-token";
import type { WorkerEnv } from "../env";

export class SellerApplicationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "SellerApplicationError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type SubmitSellerApplicationInput = {
  applicantEmail: string;
  businessName: string;
  businessType: string;
  contactPhone?: string;
  description?: string;
  applicantFirebaseUid?: string;
};

export type SellerApplicationRecord = ReturnType<typeof serializeApplication> & {
  vendor?: { code: string; slug: string; name: string } | null;
};

async function loadVendorForApplication(
  db: StoreDatabase,
  vendorId: string | null,
): Promise<{ code: string; slug: string; name: string } | null> {
  if (!vendorId) return null;
  const vendorRows = await db
    .select({ code: vendors.code, slug: vendors.slug, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);
  return vendorRows[0] ?? null;
}

export async function submitSellerApplication(
  db: StoreDatabase,
  input: SubmitSellerApplicationInput,
) {
  const applicantEmail = normalizeEmail(input.applicantEmail);
  const businessName = input.businessName.trim();
  if (!businessName) {
    throw new SellerApplicationError("Business name is required");
  }

  const pending = await db
    .select({ id: sellerApplications.id })
    .from(sellerApplications)
    .where(
      and(
        eq(sellerApplications.applicantEmail, applicantEmail),
        eq(sellerApplications.status, "PENDING"),
      ),
    )
    .limit(1);

  if (pending.length > 0) {
    throw new SellerApplicationError("You already have a pending application", 409);
  }

  const proposedVendorCode = vendorCodeFromName(businessName);
  const statusAccessToken = generateStatusAccessToken();
  const statusTokenHash = await hashStatusAccessToken(statusAccessToken);

  const inserted = await db
    .insert(sellerApplications)
    .values({
      applicantEmail,
      businessName,
      businessType: input.businessType.trim() || "product",
      contactPhone: input.contactPhone?.trim() || null,
      description: input.description?.trim() || null,
      proposedVendorCode,
      applicantFirebaseUid: input.applicantFirebaseUid?.trim() || null,
      statusTokenHash,
    })
    .returning();

  const row = inserted[0]!;
  return {
    application: serializeApplication(row),
    statusAccessToken,
  };
}

export async function getSellerApplicationByEmail(db: StoreDatabase, email: string) {
  const normalized = normalizeEmail(email);
  const rows = await db
    .select()
    .from(sellerApplications)
    .where(eq(sellerApplications.applicantEmail, normalized))
    .orderBy(desc(sellerApplications.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const vendor = await loadVendorForApplication(db, row.vendorId);
  return { ...serializeApplication(row), vendor };
}

export async function getSellerApplicationByStatusToken(db: StoreDatabase, statusToken: string) {
  const statusTokenHash = await hashStatusAccessToken(statusToken);
  const rows = await db
    .select()
    .from(sellerApplications)
    .where(eq(sellerApplications.statusTokenHash, statusTokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const vendor = await loadVendorForApplication(db, row.vendorId);
  return { ...serializeApplication(row), vendor };
}

export async function getSellerApplicationByFirebaseUid(db: StoreDatabase, firebaseUid: string) {
  const rows = await db
    .select()
    .from(sellerApplications)
    .where(eq(sellerApplications.applicantFirebaseUid, firebaseUid.trim()))
    .orderBy(desc(sellerApplications.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const vendor = await loadVendorForApplication(db, row.vendorId);
  return { ...serializeApplication(row), vendor };
}

export async function listPendingSellerApplications(db: StoreDatabase) {
  const rows = await db
    .select()
    .from(sellerApplications)
    .where(eq(sellerApplications.status, "PENDING"))
    .orderBy(desc(sellerApplications.createdAt));

  return rows.map(serializeApplication);
}

async function uniqueVendorCode(db: StoreDatabase, base: string): Promise<string> {
  let code = base;
  let suffix = 1;
  while (true) {
    const existing = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.code, code)).limit(1);
    if (existing.length === 0) return code;
    suffix += 1;
    code = `${base}-${suffix}`;
  }
}

async function uniqueVendorSlug(db: StoreDatabase, base: string): Promise<string> {
  let slug = base;
  let suffix = 1;
  while (true) {
    const existing = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, slug)).limit(1);
    if (existing.length === 0) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
}

export async function approveSellerApplication(
  db: StoreDatabase,
  env: WorkerEnv,
  applicationId: string,
  reviewNotes?: string,
) {
  const rows = await db
    .select()
    .from(sellerApplications)
    .where(eq(sellerApplications.id, applicationId))
    .limit(1);
  const application = rows[0];
  if (!application) {
    throw new SellerApplicationError("Application not found", 404);
  }
  if (application.status !== "PENDING") {
    throw new SellerApplicationError(`Application is already ${application.status}`, 409);
  }

  const baseCode = application.proposedVendorCode ?? vendorCodeFromName(application.businessName);
  const code = await uniqueVendorCode(db, baseCode);
  const baseSlug = slugify(application.businessName);
  const slug = await uniqueVendorSlug(db, baseSlug);

  const accessToken = generateVendorToken();
  const apiTokenHash = await hashVendorToken(accessToken);

  let firebaseUid = application.applicantFirebaseUid?.trim() || null;
  let firebaseLinkSkipped: { existingVendorCode: string } | null = null;
  if (firebaseUid) {
    const existingLink = await db
      .select({ code: vendors.code })
      .from(vendors)
      .where(eq(vendors.firebaseUid, firebaseUid))
      .limit(1);
    if (existingLink[0]) {
      firebaseLinkSkipped = { existingVendorCode: existingLink[0].code };
      firebaseUid = null;
    }
  }

  const vendorInserted = await db
    .insert(vendors)
    .values({
      code,
      slug,
      name: application.businessName,
      email: application.applicantEmail,
      ownerEmail: application.applicantEmail,
      description: application.description,
      contactPhone: application.contactPhone,
      businessType: application.businessType,
      sellerKind: inferSellerKindFromVendorCode(code),
      apiTokenHash,
      firebaseUid,
    })
    .returning();

  const vendor = vendorInserted[0]!;

  const accountingProvision = await provisionVendorInAccounting(env, {
    code: vendor.code,
    name: vendor.name,
    email: vendor.email,
  });

  const updated = await db
    .update(sellerApplications)
    .set({
      status: "APPROVED",
      vendorId: vendor.id,
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(sellerApplications.id, applicationId))
    .returning();

  return {
    application: serializeApplication(updated[0]!),
    vendor: {
      code: vendor.code,
      slug: vendor.slug,
      name: vendor.name,
    },
    accessToken,
    accountingProvision: accountingProvision.ok
      ? { ok: true as const, created: accountingProvision.created }
      : { ok: false as const, error: accountingProvision.error ?? "Accounting vendor provision failed" },
    ...(firebaseLinkSkipped
      ? {
          firebaseLinkSkipped: true as const,
          existingVendorCode: firebaseLinkSkipped.existingVendorCode,
          firebaseLinkNote:
            "Member Google sign-in is already linked to another store. The seller can use vendor code + access token at /sell/apply.",
        }
      : {}),
  };
}

export async function rejectSellerApplication(
  db: StoreDatabase,
  applicationId: string,
  reviewNotes?: string,
) {
  const rows = await db
    .select()
    .from(sellerApplications)
    .where(eq(sellerApplications.id, applicationId))
    .limit(1);
  const application = rows[0];
  if (!application) {
    throw new SellerApplicationError("Application not found", 404);
  }
  if (application.status !== "PENDING") {
    throw new SellerApplicationError(`Application is already ${application.status}`, 409);
  }

  const updated = await db
    .update(sellerApplications)
    .set({
      status: "REJECTED",
      reviewNotes: reviewNotes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(sellerApplications.id, applicationId))
    .returning();

  return serializeApplication(updated[0]!);
}

function serializeApplication(row: typeof sellerApplications.$inferSelect) {
  return {
    applicationId: row.id,
    applicantEmail: row.applicantEmail,
    businessName: row.businessName,
    businessType: row.businessType,
    contactPhone: row.contactPhone,
    description: row.description,
    proposedVendorCode: row.proposedVendorCode,
    status: row.status,
    vendorId: row.vendorId,
    reviewNotes: row.reviewNotes,
    hasFirebaseLink: Boolean(row.applicantFirebaseUid),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
