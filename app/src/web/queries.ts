import { withTenant } from "../db/withTenant.js";

export interface OpportunityListItem {
  opportunityId: string;
  status: string;
  title: string;
  buyerName: string | null;
  locationText: string | null;
  deadline: string | null;
  sourceUrl: string;
  totalScore: number;
  positiveFactors: string[];
  negativeFactors: string[];
  estimatedRevenue: number | null;
  revenueBasis: string;
  isUnlocked: boolean;
}

export interface ListFilters {
  search?: string;
  minScore?: number;
  statusIn?: string[];
}

export async function listOpportunities(businessId: string, filters: ListFilters = {}): Promise<OpportunityListItem[]> {
  return withTenant(businessId, async (client) => {
    const conditions: string[] = ["o.business_id = $1"];
    const params: unknown[] = [businessId];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(p.title ilike $${params.length} or p.buyer_name ilike $${params.length})`);
    }
    if (filters.minScore !== undefined) {
      params.push(filters.minScore);
      conditions.push(`m.total_score >= $${params.length}`);
    }
    if (filters.statusIn && filters.statusIn.length > 0) {
      params.push(filters.statusIn);
      conditions.push(`o.status = any($${params.length}::text[])`);
    }

    const { rows } = await client.query(
      `select o.id as opportunity_id, o.status, p.title, p.buyer_name, p.location_text, p.deadline, p.source_url,
              m.total_score, m.positive_factors, m.negative_factors,
              ce.estimated_revenue, ce.revenue_basis,
              (iu.opportunity_id is not null) as is_unlocked
       from opportunities o
       join procurement p on p.id = o.procurement_id
       join matches m on m.opportunity_id = o.id
       left join commercial_estimates ce on ce.opportunity_id = o.id
       left join intelligence_unlocks iu on iu.opportunity_id = o.id and iu.business_id = o.business_id
       where ${conditions.join(" and ")}
       order by m.total_score desc`,
      params,
    );

    return rows.map((r) => ({
      opportunityId: r.opportunity_id,
      status: r.status,
      title: r.title,
      buyerName: r.buyer_name,
      locationText: r.location_text,
      deadline: r.deadline,
      sourceUrl: r.source_url,
      totalScore: r.total_score,
      positiveFactors: r.positive_factors,
      negativeFactors: r.negative_factors,
      estimatedRevenue: r.estimated_revenue !== null ? Number(r.estimated_revenue) : null,
      revenueBasis: r.revenue_basis,
      isUnlocked: r.is_unlocked,
    }));
  });
}

export async function getOpportunityDetail(businessId: string, opportunityId: string) {
  return withTenant(businessId, async (client) => {
    const { rows: oppRows } = await client.query(
      `select o.id, o.status, o.business_id, p.id as procurement_id, p.title, p.description, p.buyer_name,
              p.value_low, p.value_high, p.location_text, p.deadline, p.published_date, p.contract_period_text,
              p.source_url, p.cpv_codes
       from opportunities o join procurement p on p.id = o.procurement_id
       where o.id = $1 and o.business_id = $2`,
      [opportunityId, businessId],
    );
    if (!oppRows.length) return null;
    const opp = oppRows[0];

    const { rows: matchRows } = await client.query(`select * from matches where opportunity_id = $1`, [opportunityId]);
    const { rows: commercialRows } = await client.query(`select * from commercial_estimates where opportunity_id = $1`, [opportunityId]);
    const { rows: evidenceRows } = await client.query(`select * from evidence where opportunity_id = $1 order by created_at`, [opportunityId]);
    const { rows: requirementRows } = await client.query(
      `select field_name, value_text, confidence, source_span, extracted_by from requirements where procurement_id = $1`,
      [opp.procurement_id],
    );
    const { rows: unlockRows } = await client.query(
      `select content, credits_spent, unlocked_at from intelligence_unlocks where opportunity_id = $1 and business_id = $2`,
      [opportunityId, businessId],
    );

    return {
      opportunity: opp,
      match: matchRows[0] ?? null,
      commercial: commercialRows[0] ?? null,
      evidence: evidenceRows,
      requirements: requirementRows,
      unlock: unlockRows[0] ?? null,
    };
  });
}

export async function dashboardStats(businessId: string) {
  return withTenant(businessId, async (client) => {
    const { rows } = await client.query(
      `select
         count(*) filter (where o.status = 'new') as new_count,
         count(*) filter (where m.total_score >= 70) as high_priority_count,
         count(*) as total_count
       from opportunities o join matches m on m.opportunity_id = o.id
       where o.business_id = $1`,
      [businessId],
    );
    return rows[0];
  });
}

/**
 * The only statuses an opportunity may hold. Mirrors the CHECK constraint on
 * opportunities.status in 0001_init.sql — the database is the backstop, this
 * is the app-layer gate so an invalid value is a clean 400 rather than a
 * constraint violation surfacing as a 500.
 */
export const OPPORTUNITY_STATUSES = ["new", "interested", "contacted", "won", "lost", "not_relevant"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export function isValidStatus(value: string): value is OpportunityStatus {
  return (OPPORTUNITY_STATUSES as readonly string[]).includes(value);
}

/** Postgres uuid columns reject non-UUID text with an error; validate first so a
 *  malformed id in a URL is a 404, not a 500. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function updateStatus(businessId: string, opportunityId: string, status: OpportunityStatus): Promise<void> {
  await withTenant(businessId, async (client) => {
    await client.query(`update opportunities set status = $1, updated_at = now() where id = $2 and business_id = $3`, [status, opportunityId, businessId]);
  });
}

export async function getCreditBalance(businessId: string): Promise<number> {
  return withTenant(businessId, async (client) => {
    const { rows } = await client.query(`select balance from credits where business_id = $1`, [businessId]);
    return rows[0]?.balance ?? 0;
  });
}
