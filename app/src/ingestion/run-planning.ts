import { servicePool } from "../db/pool.js";
import { ingestPlanningDataset } from "./planningIngest.js";

// brownfield-land is the dataset used for this vertical slice — real,
// structured, keyless, and a genuine early-signal source (site clearance /
// groundworks-adjacent). See docs/research/02-data-sources.md and the scope
// note in 0001_init.sql for why this isn't presented as full planning-
// application coverage.
const DATASETS = ["brownfield-land"];

async function main() {
  for (const dataset of DATASETS) {
    const runRes = await servicePool.query(
      `insert into ingestion_runs (source, status) values ($1, 'running') returning id`,
      [`planning_data_gov_uk:${dataset}`],
    );
    const runId = runRes.rows[0].id;

    try {
      const result = await ingestPlanningDataset({ dataset, limit: 100 });
      await servicePool.query(
        `update ingestion_runs set status = 'succeeded', finished_at = now(),
           records_fetched = $2, records_new = $3, records_updated = $4 where id = $1`,
        [runId, result.fetched, result.inserted, result.updated],
      );
      console.log(`Planning dataset '${dataset}' ingestion complete:`, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await servicePool.query(
        `update ingestion_runs set status = 'failed', finished_at = now(), error_text = $2 where id = $1`,
        [runId, message],
      );
      console.error(`Planning dataset '${dataset}' ingestion FAILED:`, message);
      process.exitCode = 1;
    }
  }
  await servicePool.end();
}

main();
