import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { servicePool } from "./pool.js";

/**
 * Minimal, real migration runner — applies every .sql file in
 * src/db/migrations/ in filename order, tracked in schema_migrations so
 * re-running is safe (skips already-applied files). This is what actually
 * ran to build the schema in this environment; docs/architecture/04-implementation-status.md
 * "Path to production" assumes this script, not manual psql commands.
 */
async function main() {
  await servicePool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  const { rows: applied } = await servicePool.query(`select filename from schema_migrations`);
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`skip (already applied): ${file}`);
      continue;
    }
    const sql = readFileSync(path.join(dir, file), "utf8");
    console.log(`applying: ${file}`);
    const client = await servicePool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`insert into schema_migrations (filename) values ($1)`, [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`FAILED: ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log("Migrations complete.");
  await servicePool.end();
}

main();
