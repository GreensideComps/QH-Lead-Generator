import type { PoolClient } from "pg";
import { appPool } from "./pool.js";

/**
 * Runs `fn` inside a transaction with `app.business_id` set for the
 * duration — the Row Level Security policies in 0001_init.sql key off
 * this setting to enforce tenant isolation at the database layer, not
 * just in application code. Every customer-facing query must go through
 * this helper; never query `appPool` directly for tenant-scoped tables.
 */
export async function withTenant<T>(
  businessId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    // set_config with is_local=true scopes this to the current transaction only
    await client.query("SELECT set_config('app.business_id', $1, true)", [businessId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
