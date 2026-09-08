import { servicePool } from "../db/pool.js";

/**
 * Planning signals (planning.data.gov.uk brownfield-land entities) arrive
 * as already-structured JSON fields, not free prose — unlike a procurement
 * notice, there is nothing here for the Extraction Agent to read and
 * interpret. Deriving "known facts" from them is a deterministic field
 * mapping, not an AI task (docs/architecture/03-ai-routing-strategy.md:
 * use deterministic code wherever it's sufficient). This writes to the same
 * `requirements` table the Extraction Agent uses, `extracted_by =
 * 'deterministic:planning_data_gov_uk'` — an honest, distinct provenance
 * value, not a fabricated AI attribution, and NOT a second data model.
 */
export async function normalizePlanningSignals(): Promise<{ processed: number }> {
  const { rows } = await servicePool.query(
    `select id, raw_payload from planning_signals p
     where not exists (select 1 from requirements r where r.planning_signal_id = p.id)`,
  );

  let processed = 0;
  for (const row of rows) {
    const payload = row.raw_payload as Record<string, unknown>;
    const facts: Array<{ field: string; value: string }> = [];

    const dwellings = payload["maximum-net-dwellings"];
    if (dwellings) facts.push({ field: "planning_dwelling_capacity", value: `${dwellings} dwellings (maximum net)` });

    const status = payload["planning-permission-status"];
    if (status) facts.push({ field: "planning_permission_status", value: String(status) });

    const permDate = payload["planning-permission-date"];
    if (permDate) facts.push({ field: "planning_permission_date", value: String(permDate) });

    const hectares = payload["hectares"];
    if (hectares) facts.push({ field: "site_area", value: `${hectares} hectares` });

    const ownership = payload["ownership-status"];
    if (ownership) facts.push({ field: "ownership_status", value: String(ownership) });

    const notes = payload["notes"];
    if (notes) facts.push({ field: "site_notes", value: String(notes) });

    for (const fact of facts) {
      await servicePool.query(
        `insert into requirements (planning_signal_id, field_name, value_text, confidence, source_span, extracted_by)
         values ($1, $2, $3, 'verified', null, 'deterministic:planning_data_gov_uk')`,
        [row.id, fact.field, fact.value],
      );
    }
    processed += 1;
  }

  return { processed };
}
