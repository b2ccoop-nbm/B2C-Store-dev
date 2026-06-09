import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type StoreDatabase = PostgresJsDatabase<typeof schema>;

export function createDb(connectionString: string): { db: StoreDatabase; close: () => Promise<void> } {
  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return {
    db: drizzle(client, { schema }),
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

export async function pingDatabase(connectionString: string): Promise<boolean> {
  const { db, close } = createDb(connectionString);
  try {
    await db.execute(sql`select 1 as ok`);
    return true;
  } catch {
    return false;
  } finally {
    await close();
  }
}
