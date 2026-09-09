import { servicePool } from "../db/pool.js";
import { categoriseDemand } from "../ingestion/demandCategory.js";

/**
 * Re-applies the demand categoriser to already-ingested notices from their
 * retained raw payloads. Lets a rule change be evaluated without re-fetching
 * from the public API — the categoriser is deterministic, so this is a pure
 * recomputation, not a second opinion.
 */
async function main() {
  const { rows } = await servicePool.query<{ id: string; title: string; description: string | null; cpv_codes: string[] }>(
    `select id, title, description, cpv_codes from procurement`,
  );

  let cleared = 0;
  let kept = 0;
  for (const r of rows) {
    const d = categoriseDemand({ title: r.title, description: r.description ?? "", cpvCodes: r.cpv_codes ?? [] });
    if (d.categories.length === 0) cleared += 1;
    else kept += 1;
    await servicePool.query(`update procurement set demand_categories = $2, demand_basis = $3 where id = $1`, [
      r.id,
      d.categories,
      d.basis,
    ]);
  }

  console.log(`Reclassified ${rows.length} notices: ${kept} demand-generating, ${cleared} excluded/none.`);
  await servicePool.end();
}

main();
