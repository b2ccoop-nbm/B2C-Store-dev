import { eq } from "drizzle-orm";
import type { FulfillmentStatus } from "@b2ccoop/store-shared";
import type { StoreDatabase } from "../db/client";
import { provisionAccountingVendor } from "../integrations/accounting-client";
import type { WorkerEnv } from "../env";

export type ProvisionVendorInput = {
  code: string;
  name: string;
  email?: string | null;
};

export type ProvisionVendorResult = {
  ok: boolean;
  created?: boolean;
  error?: string;
};

export async function provisionVendorInAccounting(
  env: WorkerEnv,
  input: ProvisionVendorInput,
): Promise<ProvisionVendorResult> {
  return provisionAccountingVendor(env, {
    code: input.code,
    name: input.name,
    email: input.email ?? undefined,
  });
}
