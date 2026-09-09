import { fetchJson, hashPayload } from "./httpClient.js";
import { isRelevant } from "./relevance.js";
import { categoriseDemand } from "./demandCategory.js";
import { servicePool } from "../db/pool.js";

const FTS_BASE = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages";

interface OcdsReleasePackage {
  releases: OcdsRelease[];
  links?: { next?: string };
}

interface OcdsRelease {
  ocid: string;
  id: string;
  date: string;
  tender?: {
    title?: string;
    description?: string;
    status?: string;
    classification?: { id?: string; description?: string };
    value?: { amount?: number; currency?: string };
    tenderPeriod?: { endDate?: string };
    procurementMethod?: string;
  };
  buyer?: { id?: string; name?: string };
  parties?: Array<{ id?: string; name?: string; roles?: string[]; address?: Record<string, string> }>;
  awards?: Array<{
    id?: string;
    date?: string;
    value?: { amount?: number; currency?: string };
    suppliers?: Array<{ id?: string; name?: string }>;
  }>;
}

export type NoticeStage = "tender" | "award";

export interface FtsIngestOptions {
  updatedFrom: string; // ISO date
  updatedTo: string; // ISO date
  maxPages?: number;
  /** Which OCDS stage to ingest. 'award' notices name the winning contractor —
   *  the party an operator can actually approach for subcontract work. */
  stage?: NoticeStage;
}

export interface FtsIngestResult {
  stage: NoticeStage;
  fetched: number;
  relevant: number;
  inserted: number;
  updated: number;
  skippedIrrelevant: number;
  withSupplier: number;
}

/**
 * Ingests Find a Tender notices in a date window. Real, live, keyless OCDS
 * API — see docs/research/02-data-sources.md (Tier 1). Applies the
 * deterministic relevance filter before writing anything, so the shared
 * `procurement` table doesn't fill up with notices no current customer
 * profile could ever match — consistent with the "precision over volume"
 * product principle (docs/research/05-product-strategy.md).
 */
export async function ingestFts(opts: FtsIngestOptions): Promise<FtsIngestResult> {
  const stage: NoticeStage = opts.stage ?? "tender";
  const result: FtsIngestResult = { stage, fetched: 0, relevant: 0, inserted: 0, updated: 0, skippedIrrelevant: 0, withSupplier: 0 };
  let url =
    `${FTS_BASE}?updatedFrom=${encodeURIComponent(opts.updatedFrom)}` +
    `&updatedTo=${encodeURIComponent(opts.updatedTo)}&stages=${stage}&limit=100`;
  let page = 0;
  const maxPages = opts.maxPages ?? 5;

  while (url && page < maxPages) {
    const pkg = await fetchJson<OcdsReleasePackage>(url);
    page += 1;

    for (const release of pkg.releases) {
      result.fetched += 1;
      const tender = release.tender;
      if (!tender?.title) continue;

      const cpv = collectCpv(release);
      const demand = categoriseDemand({
        title: tender.title,
        description: tender.description ?? "",
        cpvCodes: cpv,
      });

      // Tender stage keeps the original narrow filter ("could a haulier bid
      // for this?"). Award stage uses the demand categoriser instead ("will
      // this scheme create work a haulier could be subcontracted for?") —
      // the two questions are genuinely different, and only the second one
      // matches how this trade actually wins work.
      const keep =
        stage === "award"
          ? demand.categories.length > 0
          : isRelevant({ title: tender.title, description: tender.description ?? "", cpvCodes: cpv }).relevant;

      if (!keep) {
        result.skippedIrrelevant += 1;
        continue;
      }
      result.relevant += 1;

      const award = release.awards?.[0];
      const supplierName = award?.suppliers?.[0]?.name ?? null;
      if (supplierName) result.withSupplier += 1;

      const externalId = release.id || release.ocid;
      const sourceUrl = `https://www.find-tender.service.gov.uk/Notice/${externalId}`;
      const hash = hashPayload(release);

      const upsertResult = await servicePool.query(
        `insert into procurement
           (source, external_id, title, description, buyer_name, value_low, value_high,
            currency, location_text, deadline, published_date, cpv_codes, source_url,
            raw_payload, raw_payload_hash,
            notice_stage, supplier_name, award_value, award_date, demand_categories, demand_basis)
         values ('find_a_tender', $1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16, $17, $18, $19)
         on conflict (source, external_id) do update set
           title = excluded.title,
           description = excluded.description,
           buyer_name = excluded.buyer_name,
           value_low = excluded.value_low,
           value_high = excluded.value_high,
           deadline = excluded.deadline,
           cpv_codes = excluded.cpv_codes,
           raw_payload = excluded.raw_payload,
           raw_payload_hash = excluded.raw_payload_hash,
           notice_stage = excluded.notice_stage,
           supplier_name = excluded.supplier_name,
           award_value = excluded.award_value,
           award_date = excluded.award_date,
           demand_categories = excluded.demand_categories,
           demand_basis = excluded.demand_basis,
           updated_at = now()
         where procurement.raw_payload_hash is distinct from excluded.raw_payload_hash
         returning (xmax = 0) as inserted`,
        [
          externalId,
          tender.title,
          tender.description ?? null,
          release.buyer?.name ?? null,
          tender.value?.amount ?? null,
          tender.value?.currency ?? "GBP",
          buyerLocation(release),
          tender.tenderPeriod?.endDate ? new Date(tender.tenderPeriod.endDate) : null,
          new Date(release.date),
          cpv,
          sourceUrl,
          JSON.stringify(release),
          hash,
          stage,
          supplierName,
          award?.value?.amount ?? null,
          award?.date ? new Date(award.date) : null,
          demand.categories,
          demand.basis,
        ],
      );

      if (upsertResult.rowCount && upsertResult.rowCount > 0) {
        if (upsertResult.rows[0].inserted) result.inserted += 1;
        else result.updated += 1;
      }
    }

    url = pkg.links?.next ?? "";
  }

  return result;
}

/** OCDS scatters CPV across tender.classification, additionalClassifications
 *  and per-item classifications. The earlier version read only the first of
 *  those, which silently dropped the codes the demand rules depend on. */
function collectCpv(release: OcdsRelease): string[] {
  const t = release.tender as
    | (OcdsRelease["tender"] & {
        additionalClassifications?: Array<{ id?: string }>;
        items?: Array<{ classification?: { id?: string }; additionalClassifications?: Array<{ id?: string }> }>;
      })
    | undefined;
  const out = new Set<string>();
  if (t?.classification?.id) out.add(String(t.classification.id));
  for (const c of t?.additionalClassifications ?? []) if (c.id) out.add(String(c.id));
  for (const item of t?.items ?? []) {
    if (item.classification?.id) out.add(String(item.classification.id));
    for (const c of item.additionalClassifications ?? []) if (c.id) out.add(String(c.id));
  }
  return [...out];
}

function buyerLocation(release: OcdsRelease): string | null {
  const buyerParty = release.parties?.find((p) => p.id === release.buyer?.id);
  const addr = buyerParty?.address;
  if (!addr) return null;
  return [addr.locality, addr.region].filter(Boolean).join(", ") || null;
}
