import { fetchJson, hashPayload } from "./httpClient.js";
import { servicePool } from "../db/pool.js";

const PLANNING_BASE = "https://www.planning.data.gov.uk/entity.json";

interface PlanningEntity {
  entity: number;
  name?: string;
  reference?: string;
  dataset: string;
  organisation_entity?: string;
  point?: string;
  "site-address"?: string;
  "site-plan-url"?: string;
  "planning-permission-status"?: string;
  "planning-permission-date"?: string;
  "maximum-net-dwellings"?: string;
  notes?: string;
  [key: string]: unknown;
}

interface PlanningEntityResponse {
  entities: PlanningEntity[];
  count: number;
}

export interface PlanningIngestOptions {
  dataset: string; // e.g. 'brownfield-land'
  limit?: number;
}

export interface PlanningIngestResult {
  fetched: number;
  inserted: number;
  updated: number;
}

/**
 * Ingests planning.data.gov.uk spatial/reference entities. IMPORTANT scope
 * note (see 0001_init.sql and docs/research/02-data-sources.md): this is
 * NOT national planning-application coverage — that's confirmed fragmented
 * (73/311 LPAs). What's ingested here is real, structured, keyless
 * reference data (e.g. the brownfield land register) used as a contextual
 * planning SIGNAL, not presented to customers as an equivalent to a live
 * planning application.
 */
export async function ingestPlanningDataset(opts: PlanningIngestOptions): Promise<PlanningIngestResult> {
  const result: PlanningIngestResult = { fetched: 0, inserted: 0, updated: 0 };
  const url = `${PLANNING_BASE}?dataset=${encodeURIComponent(opts.dataset)}&limit=${opts.limit ?? 50}`;
  const res = await fetchJson<PlanningEntityResponse>(url);

  for (const entity of res.entities) {
    result.fetched += 1;
    const externalId = String(entity.entity);
    const sourceUrl = `https://www.planning.data.gov.uk/entity/${entity.entity}`;
    const hash = hashPayload(entity);

    const upsertResult = await servicePool.query(
      `insert into planning_signals
         (dataset, external_id, name, entity_type, location_text, organisation,
          documentation_url, source_url, raw_payload, raw_payload_hash)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (source, dataset, external_id) do update set
         name = excluded.name,
         location_text = excluded.location_text,
         raw_payload = excluded.raw_payload,
         raw_payload_hash = excluded.raw_payload_hash,
         updated_at = now()
       where planning_signals.raw_payload_hash is distinct from excluded.raw_payload_hash
       returning (xmax = 0) as inserted`,
      [
        opts.dataset,
        externalId,
        entity.name ?? entity.reference ?? null,
        opts.dataset,
        entity["site-address"] ?? null,
        entity.organisation_entity ?? null,
        entity["site-plan-url"] ?? null,
        sourceUrl,
        JSON.stringify(entity),
        hash,
      ],
    );

    if (upsertResult.rowCount && upsertResult.rowCount > 0) {
      if (upsertResult.rows[0].inserted) result.inserted += 1;
      else result.updated += 1;
    }
  }

  return result;
}
