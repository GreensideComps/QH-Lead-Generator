import { servicePool } from "../db/pool.js";

/**
 * TRANSPARENCY NOTE — read this before trusting these rows as "the
 * automated pipeline's output."
 *
 * This sandbox has no ANTHROPIC_API_KEY configured for a standalone
 * production backend (see docs/architecture/04-implementation-status.md).
 * `run-extraction.ts` — the real, automated Extraction + Verification
 * pipeline (src/extraction/extractionAgent.ts, calling the Anthropic API) —
 * correctly refuses to fabricate results when no key is present.
 *
 * To still demonstrate the full commercial loop end-to-end on REAL ingested
 * notices (not invented ones), the extraction below was performed manually,
 * in this development session, by Claude reading the actual notice text
 * pulled live from Find a Tender (see the `notes` field and exact quoted
 * `source_span` on every row — check them against `procurement.description`
 * yourself). It follows the exact same rules as
 * src/extraction/prompts.ts:EXTRACTION_SYSTEM_PROMPT — extract only what's
 * explicitly stated, quote the supporting text, mark everything else
 * "unknown" rather than inferred or guessed.
 *
 * Every row's `extracted_by` is set to 'claude-code-manual-session', NOT
 * 'claude-api-production' — this is a real, auditable, non-fabricated
 * distinction the schema and the UI both surface (see requirements table,
 * 0001_init.sql). Swapping to the automated path is `npm run extract:run`
 * once ANTHROPIC_API_KEY is set — no other code changes needed.
 */

interface SeedField {
  field_name: string;
  value_text: string;
  confidence: "verified" | "calculated" | "customer_provided" | "estimated" | "inferred" | "unknown";
  source_span: string | null;
}

const EXTRACTIONS: Record<string, { fields: SeedField[]; notes: string }> = {
  "056561-2026": {
    // Plumpton Sports Pavilion
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Demolition of the current sports pavilion and construction of a new sports pavilion",
        confidence: "verified",
        source_span: "demolition of their current sports pavilion and construction of a new sports pavilion",
      },
    ],
    notes:
      "Small-scale demolition/construction project. No tonnage, vehicle, or contract-period detail stated in the public notice — full specification available only via the Clerk to the Council on request.",
  },
  "058671-2026": {
    // Waste Management Services (Wheatley Housing Group)
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Integrated waste management services across the Group's housing portfolio",
        confidence: "verified",
        source_span: "seeking a suitably experienced contractor to deliver integrated waste management services across its portfolio",
      },
    ],
    notes:
      "Relevant to waste haulage capability, but the notice gives no waste volume, vehicle, or duration detail — a full specification would be in tender documents, not the public notice text.",
  },
  "060399-2026": {
    // Footpath upgrade, Belmont HR2
    fields: [
      {
        field_name: "material_or_service",
        value_text:
          "Upgrade the footpath around the perimeter of Abbey View East, Belmont, including the footpaths linking Jubilee Field and Abbey View East with Dorchester Way",
        confidence: "verified",
        source_span:
          "invites tenders to upgrade the footpath around the perimeter of the area known as Abbey View East, Belmont, including the footpaths linking Jubilee Field and Abbey View East with Dorchester Way",
      },
      {
        field_name: "key_risk_or_constraint",
        value_text: "Existing run-off causes flooding in certain areas; an approved design addresses this",
        confidence: "verified",
        source_span: "The existing footpath suffers with run off the main area causing flooding in certain areas",
      },
    ],
    notes:
      "The notice asks bidders to state their own material quantities (\"approximate quantities of the materials, ie concrete, reinforcement etc\") rather than stating a quantity itself — correctly left as unknown, not guessed. Small parish-level job; marginal fit for a haulage/aggregates-focused fleet versus a groundworks/drainage specialist.",
  },
  "064802-2026": {
    // Gremista Landfill Phase 3 — strongest match in this sample
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Cut and fill earthworks, new haul roads, and surface water drainage installation for a landfill extension",
        confidence: "verified",
        source_span:
          "will primarily involve cut and fill earthworks, new haul roads, installing new surface water drainage ditches, pipework, manholes, and headwalls",
      },
      {
        field_name: "quantity",
        value_text: "500mm thick clean aggregate drainage/protection layer over the landfill formation surface",
        confidence: "verified",
        source_span: "500mm thick, clean aggregate drainage / protection layer",
      },
    ],
    notes:
      "Strongest match in this ingestion sample: explicit earthworks, haul roads, and a stated aggregate layer specification. No tonnage figure or vehicle type is stated in the public notice, and the notice itself does not flag Shetland's island location as a logistics constraint — that is a real commercial factor, but it belongs in deterministic geography scoring (docs/research/06-system-design.md), not in an extracted claim with false verified-confidence.",
  },
  "068160-2026": {
    // Gourock Warehouse Demolition
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Demolition of the redundant Gourock Warehouse and associated post-demolition remedial works",
        confidence: "verified",
        source_span: "demolition of the redundant Gourock Warehouse, and the associated remedial works required post demolition",
      },
    ],
    notes: "Sole-supplier appointment notice with minimal public specification — no quantity, material, or vehicle detail stated.",
  },
  "079633-2026": {
    // Anti-Skid Road Surfacing PIN
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Supply and application of highway surfacing and road-marking services (anti-skid surfacing, thermoplastic line markings, road studs, cats eyes)",
        confidence: "verified",
        source_span:
          "supply and application of highway surfacing and road marking services, including but not limited to anti‑skid surfacing, thermoplastic line markings, road studs and cats eyes",
      },
      {
        field_name: "procurement_stage",
        value_text: "Prior Information Notice (PIN) — early market engagement, not yet a live tender",
        confidence: "verified",
        source_span: "The Council is publishing this Prior Information Notice to engage with the market and provide early visibility of potential future procurement activity",
      },
    ],
    notes:
      "Important distinction the extraction correctly captured: this is a PIN, not an open tender — there is nothing to bid on yet. The recommended action should reflect that (monitor, don't respond), which is a matching/commercial-layer decision informed by this field, not an extraction decision.",
  },
  "080896-2026": {
    // Surfacing works, LondonEnergy
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Dynamic Marker (dynamic purchasing system) membership for surfacing works at LondonEnergy's 8 sites",
        confidence: "verified",
        source_span: "For the provision to join Dynamic Marker membership fir surfacing works at LondonEnergy's 8 Sites",
      },
    ],
    notes:
      "The stated £100,000 value most likely represents a Dynamic Purchasing System threshold/estimate covering 8 sites over time, not a single job price — worth showing that caveat to a customer rather than presenting it as one contract's value. (Note: \"fir\" for \"for\" is a typo in the source notice itself, reproduced verbatim in the quote above, not introduced by extraction.)",
  },
  "081461-2026": {
    // Inner Moray Firth Housing & Property Maintenance Framework
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Housing & Property Maintenance Services framework for the Inner Moray Firth area, various trades, as-and-when basis",
        confidence: "verified",
        source_span: "Housing & Property Maintenance Services for various service users/requirements for the Inner Moray Firth Area, on an ‘as and when’ required basis",
      },
      {
        field_name: "key_risk_or_constraint",
        value_text: "No guaranteed volume of work under the framework",
        confidence: "verified",
        source_span: "The Council shall give no guarantee of the volume of work or orders, if any, to be undertaken in relation to the Framework.",
      },
      {
        field_name: "sub_lot_relevance",
        value_text: "Includes a 'Ground Works and Excavation' sub-lot (HR10) among roughly 20 listed trade sub-lots (electrical, plumbing, roofing, painting, etc.)",
        confidence: "verified",
        source_span: "HR10 – Ground Works and Excavation",
      },
    ],
    notes:
      "Weak match, and the extraction should say so plainly: this is a large multi-trade property-maintenance framework where earthworks/excavation is one line among ~20 unrelated trades, and the Council explicitly disclaims any guaranteed work volume. It was correctly caught by the ingestion keyword filter (the word 'excavation' appears once, in a sub-lot list) but a haulage/aggregates business should not expect this framework to be a meaningful revenue source — that judgement belongs in matching/commercial scoring, not in overstating what was extracted.",
  },
  "029088-2026": {
    // Fair Oak Cemetery Path Resurfacing
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Remove and dispose of an existing gravel path (165m x 3.2m) and replace with a fully-draining tarmac path",
        confidence: "verified",
        source_span: "To remove and dispose the current 165m x 3.2m gravel path and replace with a tarmac path that fully drains.",
      },
      {
        field_name: "quantity",
        value_text: "165m x 3.2m path (528 sq m) — a small physical footprint for the stated £80,000 value",
        confidence: "verified",
        source_span: "165m x 3.2m gravel path",
      },
    ],
    notes:
      "Genuine gravel-material removal/disposal job, but a small physical footprint (528 sq m) relative to the stated £80,000 value — the value likely includes drainage design/engineering and tarmac surfacing work beyond the haulage/removal element, not just material handling. Worth flagging to the customer rather than assuming the full £80,000 represents haulage-attributable revenue. No tonnage is stated, so the commercial calculation correctly falls back to the notice's own stated value rather than a calculated tonnage-based estimate.",
  },
  "017791-2026": {
    // Supply, Delivery & Collection of Roadstone Materials (Fife Council) —
    // the clearest explicit aggregate/quarry-material requirement in this sample.
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Supply of road stone materials and general quarry requirements — aggregates, dry and coated materials, ready mix concrete",
        confidence: "verified",
        source_span: "the supply of road stone materials and other general quarry requirements, which includes aggregates, dry and coated materials, as well as ready",
      },
      {
        field_name: "geographic_information",
        value_text: "Fife-wide — supplier access required across the whole of Fife, not a single site",
        confidence: "verified",
        source_span: "Roads Operations activities take place across Fife and cover a range of works, therefore access to a range of suppliers across",
      },
    ],
    notes:
      "Best real example of an explicit, unambiguous aggregate/quarry-material requirement in this ingestion sample — title and description both name aggregates and quarry materials directly, no incidental-keyword risk. £12.8m value is a multi-year term contract for a whole council area, not a single delivery — a customer should be told this is a framework-scale opportunity, not a one-off job.",
  },
  "064119-2025": {
    // Extension of the Kenn Hedge Footpath (North Somerset) — gravel material, real
    fields: [
      {
        field_name: "material_or_service",
        value_text: "Construct a new gravel footpath extension through Trendlewood Community Park",
        confidence: "verified",
        source_span: "The scope of work is to construct a new gravel footpath in Compartment 6 of Trendlewood Community Park, Nailsea",
      },
      {
        field_name: "key_risk_or_constraint",
        value_text: "Route crosses open grassland and 60 metres of woodland within a public community park",
        confidence: "verified",
        source_span: "the majority of the route being across open grassland, with 60 metres through woodland at the northern end",
      },
    ],
    notes:
      "Small parks-department gravel-path job. Real material match (gravel) but no tonnage stated and no vehicle/plant requirement specified — a genuine strong-fit-on-paper case where the actual deliverable is small in scale relative to a 25-vehicle fleet.",
  },
};

async function main() {
  const { rows: notices } = await servicePool.query(
    `select id, external_id, title from procurement where external_id = any($1::text[])`,
    [Object.keys(EXTRACTIONS)],
  );

  let written = 0;
  for (const notice of notices) {
    const seed = EXTRACTIONS[notice.external_id];
    if (!seed) continue;

    const { rowCount } = await servicePool.query(
      `select 1 from requirements where procurement_id = $1 limit 1`,
      [notice.id],
    );
    if (rowCount) {
      console.log(`Skipping ${notice.title} — requirements already exist`);
      continue;
    }

    for (const field of seed.fields) {
      await servicePool.query(
        `insert into requirements (procurement_id, field_name, value_text, confidence, source_span, extracted_by)
         values ($1, $2, $3, $4, $5, 'claude-code-manual-session')`,
        [notice.id, field.field_name, field.value_text, field.confidence, field.source_span],
      );
      written += 1;
    }
    console.log(`Extracted ${seed.fields.length} field(s) for: ${notice.title}`);
  }

  console.log(`Done. ${written} requirement row(s) written across ${notices.length} notice(s).`);
  await servicePool.end();
}

main();
