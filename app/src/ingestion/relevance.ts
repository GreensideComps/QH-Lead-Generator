/**
 * Deterministic relevance filter for the haulage/aggregates/quarrying/
 * earthworks beachhead (docs/research/05-product-strategy.md). This is NOT
 * the Extraction Agent — it's a cheap, explainable pre-filter so the
 * (comparatively expensive) extraction step only runs on notices that could
 * plausibly matter, consistent with the cheap-triage step in
 * docs/architecture/03-ai-routing-strategy.md. No AI call here at all.
 */

// Specific CPV codes/prefixes relevant to the beachhead — deliberately NOT
// the whole "45" (construction) or "90" (sanitation) divisions, which are
// far too broad (they'd match electrical work, cleaning, asbestos removal,
// etc. — confirmed by an over-broad first pass during development). These
// are narrow, high-precision groups: earthmoving/excavation, road
// construction/maintenance, plant hire, quarrying/aggregate products, and
// waste collection/transport specifically.
const RELEVANT_CPV_PREFIXES = [
  "45111", // demolition, site clearance, earthmoving
  "45112", // excavating and earthmoving work
  "4523",  // construction/maintenance of roads and highways
  "4550",  // hire of construction/civil engineering machinery with operator
  "1421",  // gravel, sand, crushed stone, aggregates
  "9051",  // waste collection and transport services (90511*, 90512*)
];

// Deliberately excludes generic single words that false-positive in
// standard procurement-document English — confirmed against real live
// notices during development, not theoretical:
//   - "aggregate" alone: matches "the aggregate value of the contract"
//     (a routine financial phrase in almost every framework notice),
//     not construction aggregate. Real aggregate-material notices are
//     caught by CPV 1421 instead.
//   - "backfill" alone: matches "backfill staff" (a common HR/staffing
//     phrase in service frameworks), not soil backfill.
// Kept to compound/specific terms that don't have this ambiguity.
const RELEVANT_KEYWORDS = [
  "haulage", "tipper truck", "tipper lorry", "muck away", "muck-away",
  "quarry", "quarrying", "earthworks", "groundworks", "road resurfacing",
  "highway resurfacing", "excavation", "plant hire", "demolition",
  "waste transfer", "crushed stone", "site clearance", "spoil removal",
  "haul road", "cut and fill",
];

export interface RelevanceInput {
  title: string;
  description: string;
  cpvCodes: string[];
}

export function isRelevant(input: RelevanceInput): { relevant: boolean; matchedOn: string[] } {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const matchedOn: string[] = [];

  for (const kw of RELEVANT_KEYWORDS) {
    if (text.includes(kw)) matchedOn.push(`keyword:${kw}`);
  }
  for (const cpv of input.cpvCodes) {
    if (RELEVANT_CPV_PREFIXES.some((p) => cpv.startsWith(p))) matchedOn.push(`cpv:${cpv}`);
  }

  return { relevant: matchedOn.length > 0, matchedOn };
}
