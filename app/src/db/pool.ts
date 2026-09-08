import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

/**
 * Service-role pool: bypasses RLS (connects as the table-owning role).
 * Used ONLY by ingestion workers, migrations, and admin/seed scripts —
 * never by request handlers serving a specific customer.
 * See docs/security/00-security-architecture.md.
 */
export const servicePool = new Pool({
  connectionString: requireEnv("DATABASE_URL"),
});

/**
 * Tenant-scoped pool: subject to Row Level Security. Every query made
 * through this pool for a specific business MUST go through
 * `withTenant(businessId, fn)` (see withTenant.ts) so `app.business_id`
 * is set before any query runs in that transaction.
 */
export const appPool = new Pool({
  connectionString: requireEnv("DATABASE_URL_APP"),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy app/.env.example to app/.env and fill it in.`,
    );
  }
  return value;
}
