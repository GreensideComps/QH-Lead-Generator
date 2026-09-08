import { servicePool } from "../db/pool.js";
import { computeMatch } from "./scoring.js";
import { calculateCommercial } from "../commercial/calculate.js";
import { primaryPlaceName, geocodePlace, haversineMiles } from "../lib/geocode.js";
import type { BusinessProfileForMatching, ProcurementCandidate } from "./types.js";

/**
 * Batch job: computes matches for every business against every ingested
 * procurement notice. Run as a backend job (service-role connection,
 * scoped explicitly by business_id in each query) — not a live per-request
 * path, so this does not go through withTenant/RLS. See
 * docs/security/00-security-architecture.md for why this split is
 * deliberate, and src/web/routes for the RLS-scoped live paths.
 */
async function main() {
  const { rows: businesses } = await servicePool.query(`
    select b.id as business_id, bp.services, bp.fleet, bp.base_location,
           bp.operating_radius_miles, bp.capacity_available, bp.min_opportunity_value,
           bp.preferred_sectors, bp.rates
    from businesses b join business_profiles bp on bp.business_id = b.id
  `);

  const { rows: notices } = await servicePool.query(`
    select id, title, description, buyer_name, value_low, value_high,
           location_text, deadline, cpv_codes, source_url
    from procurement
  `);

  let created = 0;
  let updated = 0;

  for (const b of businesses) {
    const profile: BusinessProfileForMatching = {
      businessId: b.business_id,
      services: b.services,
      fleet: b.fleet,
      baseLocation: b.base_location,
      operatingRadiusMiles: b.operating_radius_miles,
      capacityAvailable: b.capacity_available,
      minOpportunityValue: b.min_opportunity_value,
      preferredSectors: b.preferred_sectors,
      rates: b.rates,
    };

    for (const notice of notices) {
      const { rows: reqRows } = await servicePool.query(
        `select field_name, value_text, confidence, source_span from requirements where procurement_id = $1`,
        [notice.id],
      );

      const candidate: ProcurementCandidate = {
        procurementId: notice.id,
        title: notice.title,
        description: notice.description,
        buyerName: notice.buyer_name,
        valueLow: notice.value_low !== null ? Number(notice.value_low) : null,
        valueHigh: notice.value_high !== null ? Number(notice.value_high) : null,
        locationText: notice.location_text,
        deadline: notice.deadline,
        cpvCodes: notice.cpv_codes,
        sourceUrl: notice.source_url,
        requirements: reqRows.map((r) => ({
          fieldName: r.field_name,
          valueText: r.value_text,
          confidence: r.confidence,
          sourceSpan: r.source_span,
        })),
      };

      const match = await computeMatch(profile, candidate);

      // upsert opportunity
      const oppRes = await servicePool.query(
        `insert into opportunities (business_id, procurement_id)
         values ($1, $2)
         on conflict do nothing
         returning id`,
        [profile.businessId, notice.id],
      );
      let opportunityId: string;
      if (oppRes.rowCount) {
        opportunityId = oppRes.rows[0].id;
        created += 1;
      } else {
        const existing = await servicePool.query(
          `select id from opportunities where business_id = $1 and procurement_id = $2`,
          [profile.businessId, notice.id],
        );
        opportunityId = existing.rows[0].id;
        updated += 1;
      }

      await servicePool.query(
        `insert into matches
           (opportunity_id, service_score, fleet_score, geography_score, capacity_score,
            commercial_score, sector_score, total_score, weights_used,
            positive_factors, negative_factors, unknown_factors, computed_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
         on conflict (opportunity_id) do update set
           service_score = excluded.service_score, fleet_score = excluded.fleet_score,
           geography_score = excluded.geography_score, capacity_score = excluded.capacity_score,
           commercial_score = excluded.commercial_score, sector_score = excluded.sector_score,
           total_score = excluded.total_score, weights_used = excluded.weights_used,
           positive_factors = excluded.positive_factors, negative_factors = excluded.negative_factors,
           unknown_factors = excluded.unknown_factors, computed_at = now()`,
        [
          opportunityId,
          match.service.score,
          match.fleet.score,
          match.geography.score,
          match.capacity.score,
          match.commercial.score,
          match.sector.score,
          match.totalScore,
          JSON.stringify(match.weightsUsed),
          match.positiveFactors,
          match.negativeFactors,
          match.unknownFactors,
        ],
      );

      // Commercial estimate — needs tonnage (from requirements) and distance (recompute via geocode)
      const tonnesReq = candidate.requirements.find((r) => r.fieldName === "quantity");
      const tonnesMatch = tonnesReq?.valueText.match(/([\d,]+(?:\.\d+)?)\s*(?:tonnes|tonne)/i);
      const tonnes = tonnesMatch ? Number(tonnesMatch[1].replace(/,/g, "")) : null;

      const placeName = primaryPlaceName(candidate.locationText);
      let distanceMiles: number | null = null;
      if (placeName && profile.baseLocation) {
        const [basePoint, oppPoint] = await Promise.all([geocodePlace(profile.baseLocation), geocodePlace(placeName)]);
        if (basePoint && oppPoint) distanceMiles = haversineMiles(basePoint, oppPoint);
      }

      const commercial = calculateCommercial({
        tonnes,
        distanceMiles,
        valueLow: candidate.valueLow,
        valueHigh: candidate.valueHigh,
        rates: profile.rates,
      });

      await servicePool.query(
        `insert into commercial_estimates
           (opportunity_id, estimated_loads, estimated_revenue, estimated_cost,
            estimated_contribution, estimated_margin_pct, revenue_basis, rate_inputs_used, note, computed_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
         on conflict (opportunity_id) do update set
           estimated_loads = excluded.estimated_loads, estimated_revenue = excluded.estimated_revenue,
           estimated_cost = excluded.estimated_cost, estimated_contribution = excluded.estimated_contribution,
           estimated_margin_pct = excluded.estimated_margin_pct, revenue_basis = excluded.revenue_basis,
           rate_inputs_used = excluded.rate_inputs_used, note = excluded.note, computed_at = now()`,
        [
          opportunityId,
          commercial.estimatedLoads,
          commercial.estimatedRevenue,
          commercial.estimatedCost,
          commercial.estimatedContribution,
          commercial.estimatedMarginPct,
          commercial.revenueBasis,
          JSON.stringify(profile.rates),
          commercial.note,
        ],
      );

      // Evidence — one row per requirement (copies extraction provenance) plus
      // the commercial estimate's own basis, so the opportunity detail page
      // has a single place to read every claim's provenance from.
      await servicePool.query(`delete from evidence where opportunity_id = $1`, [opportunityId]);
      for (const req of candidate.requirements) {
        await servicePool.query(
          `insert into evidence (opportunity_id, claim, value_text, confidence, source_type, source_url, source_span)
           values ($1,$2,$3,$4,'procurement_notice',$5,$6)`,
          [opportunityId, req.fieldName, req.valueText, req.confidence, candidate.sourceUrl, req.sourceSpan],
        );
      }
      if (candidate.valueLow !== null) {
        await servicePool.query(
          `insert into evidence (opportunity_id, claim, value_text, confidence, source_type, source_url)
           values ($1,'contract_value',$2,'verified','procurement_notice',$3)`,
          [opportunityId, `£${candidate.valueLow.toLocaleString()}${candidate.valueHigh && candidate.valueHigh !== candidate.valueLow ? ` - £${candidate.valueHigh.toLocaleString()}` : ""}`, candidate.sourceUrl],
        );
      }
      if (distanceMiles !== null) {
        await servicePool.query(
          `insert into evidence (opportunity_id, claim, value_text, confidence, source_type)
           values ($1,'distance_from_base',$2,'calculated','geocoding')`,
          [opportunityId, `${Math.round(distanceMiles)} miles`],
        );
      }
    }
  }

  console.log(`Matching complete. ${created} new opportunity link(s), ${updated} re-scored.`);
  await servicePool.end();
}

main();
