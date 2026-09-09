import { servicePool } from "../db/pool.js";
import { ingestFts } from "./ftsIngest.js";

async function main() {
  const runRes = await servicePool.query(
    `insert into ingestion_runs (source, status) values ('find_a_tender', 'running') returning id`,
  );
  const runId = runRes.rows[0].id;

  const now = new Date();
  const days = Number(process.env.FTS_INGEST_WINDOW_DAYS ?? 90);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Both stages. Award notices are the ones that name the winning contractor,
  // which is the party an operator can approach for subcontract work — see
  // docs/research/08-award-hypothesis.md. Override with FTS_INGEST_STAGES.
  const stages = (process.env.FTS_INGEST_STAGES ?? "tender,award")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is "tender" | "award" => s === "tender" || s === "award");

  try {
    const results = [];
    for (const stage of stages) {
      results.push(
        await ingestFts({
          updatedFrom: from.toISOString(),
          updatedTo: now.toISOString(),
          maxPages: Number(process.env.FTS_INGEST_MAX_PAGES ?? 20),
          stage,
        }),
      );
    }

    const total = results.reduce(
      (a, r) => ({
        fetched: a.fetched + r.fetched,
        inserted: a.inserted + r.inserted,
        updated: a.updated + r.updated,
      }),
      { fetched: 0, inserted: 0, updated: 0 },
    );

    await servicePool.query(
      `update ingestion_runs set status = 'succeeded', finished_at = now(),
         records_fetched = $2, records_new = $3, records_updated = $4 where id = $1`,
      [runId, total.fetched, total.inserted, total.updated],
    );

    for (const r of results) console.log("Find a Tender ingestion complete:", r);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await servicePool.query(
      `update ingestion_runs set status = 'failed', finished_at = now(), error_text = $2 where id = $1`,
      [runId, message],
    );
    console.error("Find a Tender ingestion FAILED:", message);
    process.exitCode = 1;
  } finally {
    await servicePool.end();
  }
}

main();
