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

  try {
    const result = await ingestFts({
      updatedFrom: from.toISOString(),
      updatedTo: now.toISOString(),
      maxPages: Number(process.env.FTS_INGEST_MAX_PAGES ?? 20),
    });

    await servicePool.query(
      `update ingestion_runs set status = 'succeeded', finished_at = now(),
         records_fetched = $2, records_new = $3, records_updated = $4 where id = $1`,
      [runId, result.fetched, result.inserted, result.updated],
    );

    console.log("Find a Tender ingestion complete:", result);
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
