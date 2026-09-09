/**
 * Classifies a procurement notice by the BULK-MATERIAL DEMAND the scheme
 * creates — not by whether the notice is itself a haulage contract.
 *
 * This is the central change behind the award-notice hypothesis. The older
 * `relevance.ts` filter answers "is this a tender a haulier could bid for?",
 * which is the wrong question: hauliers almost never bid for public work.
 * This module answers "if this scheme goes ahead, will someone need muck
 * moved, stone delivered, or spoil taken away?" — which is how demand
 * actually reaches an operator, via subcontract from the winning contractor.
 *
 * Deterministic and explainable by design (no AI call), consistent with the
 * deterministic/AI boundary in CLAUDE.md: classification rules are business
 * logic, and must be auditable and reproducible for the density study.
 */

export type DemandCategory = "haulage" | "aggregate_supply" | "waste" | "muck_away" | "earthworks";

export type DemandBasis = "direct" | "derived";

export interface DemandInput {
  title: string;
  description?: string;
  cpvCodes?: string[];
}

export interface DemandResult {
  categories: DemandCategory[];
  /** 'direct'  — the scheme IS earthmoving/aggregate/waste work.
   *  'derived' — a construction scheme that generates that demand downstream. */
  basis: DemandBasis | null;
  matchedOn: string[];
}

/** Keyword → categories. Compound terms only; single ambiguous words such as
 *  "aggregate" are deliberately excluded because they collide with routine
 *  procurement English ("the aggregate value of the contract"). */
const KEYWORD_RULES: Array<{ kw: string; cats: DemandCategory[]; basis: DemandBasis }> = [
  // — direct earthmoving / spoil generation —
  { kw: "demolition", cats: ["muck_away", "haulage", "earthworks"], basis: "direct" },
  { kw: "site clearance", cats: ["muck_away", "haulage"], basis: "direct" },
  { kw: "excavation", cats: ["earthworks", "muck_away", "haulage"], basis: "direct" },
  { kw: "earthworks", cats: ["earthworks", "haulage"], basis: "direct" },
  { kw: "groundworks", cats: ["earthworks", "haulage"], basis: "direct" },
  { kw: "muck away", cats: ["muck_away", "haulage"], basis: "direct" },
  { kw: "muck-away", cats: ["muck_away", "haulage"], basis: "direct" },
  { kw: "spoil removal", cats: ["muck_away", "haulage"], basis: "direct" },
  { kw: "cut and fill", cats: ["earthworks", "haulage"], basis: "direct" },
  { kw: "land reclamation", cats: ["earthworks", "muck_away", "haulage"], basis: "direct" },
  { kw: "remediation", cats: ["muck_away", "earthworks", "haulage"], basis: "direct" },
  { kw: "contaminated land", cats: ["muck_away", "haulage"], basis: "direct" },
  { kw: "piling", cats: ["earthworks", "haulage"], basis: "direct" },
  { kw: "embankment", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "direct" },
  { kw: "site preparation", cats: ["earthworks", "muck_away", "haulage"], basis: "direct" },

  // — direct aggregate / surfacing —
  { kw: "resurfacing", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "surfacing", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "carriageway", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "footway", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "footpath", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "highway maintenance", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "highways maintenance", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "road maintenance", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "crushed stone", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "ready-mixed concrete", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "quarry", cats: ["aggregate_supply", "haulage"], basis: "direct" },
  { kw: "quarrying", cats: ["aggregate_supply", "haulage"], basis: "direct" },

  // — direct haulage / plant —
  { kw: "haulage", cats: ["haulage"], basis: "direct" },
  { kw: "tipper", cats: ["haulage"], basis: "direct" },
  { kw: "plant hire", cats: ["haulage", "earthworks"], basis: "direct" },
  { kw: "grab lorry", cats: ["haulage", "muck_away"], basis: "direct" },

  // — direct waste —
  { kw: "waste transfer", cats: ["waste", "haulage"], basis: "direct" },
  { kw: "waste management", cats: ["waste", "haulage"], basis: "direct" },
  { kw: "waste collection", cats: ["waste", "haulage"], basis: "direct" },
  { kw: "skip hire", cats: ["waste", "haulage"], basis: "direct" },
  { kw: "landfill", cats: ["waste", "haulage", "earthworks"], basis: "direct" },

  // — derived: a build that will need foundations dug and stone delivered —
  { kw: "new build", cats: ["earthworks", "muck_away", "aggregate_supply", "haulage"], basis: "derived" },
  { kw: "housing development", cats: ["earthworks", "muck_away", "aggregate_supply", "haulage"], basis: "derived" },
  { kw: "construction of", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived" },
  { kw: "redevelopment", cats: ["earthworks", "muck_away", "haulage"], basis: "derived" },
  { kw: "infrastructure works", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived" },
  { kw: "civil engineering", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived" },
  { kw: "drainage", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived" },
  { kw: "flood defence", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived" },
  { kw: "car park", cats: ["aggregate_supply", "haulage"], basis: "derived" },
];

/** CPV prefix → categories. High-precision groups only; deliberately NOT the
 *  whole 45 division, which would sweep in electrical, glazing and fit-out. */
const CPV_RULES: Array<{ prefix: string; cats: DemandCategory[]; basis: DemandBasis; label: string }> = [
  { prefix: "45111", cats: ["muck_away", "earthworks", "haulage"], basis: "direct", label: "demolition/site clearance/earthmoving" },
  { prefix: "45112", cats: ["earthworks", "muck_away", "haulage"], basis: "direct", label: "excavating and earthmoving" },
  { prefix: "1421", cats: ["aggregate_supply", "haulage"], basis: "direct", label: "gravel/sand/crushed stone" },
  { prefix: "4523", cats: ["aggregate_supply", "haulage", "earthworks"], basis: "direct", label: "roads and highways" },
  { prefix: "4550", cats: ["haulage", "earthworks"], basis: "direct", label: "plant hire with operator" },
  { prefix: "9051", cats: ["waste", "haulage"], basis: "direct", label: "waste collection and transport" },
  { prefix: "9053", cats: ["waste", "haulage"], basis: "direct", label: "waste treatment/disposal" },
  { prefix: "45262", cats: ["earthworks", "haulage"], basis: "direct", label: "special trade — piling/concrete" },
  // derived — real building work that generates spoil and needs stone
  { prefix: "45211", cats: ["earthworks", "muck_away", "aggregate_supply", "haulage"], basis: "derived", label: "residential construction" },
  { prefix: "45213", cats: ["earthworks", "muck_away", "aggregate_supply", "haulage"], basis: "derived", label: "commercial building construction" },
  { prefix: "45214", cats: ["earthworks", "muck_away", "aggregate_supply", "haulage"], basis: "derived", label: "education building construction" },
  { prefix: "45215", cats: ["earthworks", "muck_away", "aggregate_supply", "haulage"], basis: "derived", label: "health building construction" },
  { prefix: "45221", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived", label: "bridges/tunnels/shafts" },
  { prefix: "45231", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived", label: "pipelines/cabling" },
  { prefix: "45232", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived", label: "sewerage/water works" },
  { prefix: "45247", cats: ["earthworks", "aggregate_supply", "haulage"], basis: "derived", label: "dams/reservoirs" },
];

/**
 * Notices that mention construction words but commission no physical work.
 *
 * Found empirically in the density study, not theorised: a single Falkirk
 * framework for "provision of Civil Engineering services" produced 18 award
 * notices for quantity surveyors, cost consultants and CDM advisers — all
 * matching the "civil engineering" rule, none of them moving a single tonne
 * of anything. Professional-services and consumables frameworks are the
 * dominant false-positive class and are excluded outright.
 *
 * Deliberately specific: "supply of" is NOT excluded, because "supply and
 * delivery of aggregates" is exactly the work we want to find.
 */
const EXCLUSION_PATTERNS: RegExp[] = [
  // professional and design services
  /quantity survey|cost consultan|\bconsultancy\b|\bconsultants?\b|surveying services|\bcdm\b|principal designer|employer'?s agent|feasibility stud|design team|architectural services|professional services|pre-?qualification questionnaire/i,
  // goods and non-works services that happen to mention haulage/waste words
  /cleaning|hygiene|furniture|stationery|catering|uniform|workwear|\bppe\b|software|\bict\b|insurance|legal services|recruitment|training services|removals? and storage|move management|managed service/i,
  // licensed specialist waste — real work, but not tipper/muck-away work
  /asbestos/i,
];

function isExcluded(text: string): string | null {
  for (const re of EXCLUSION_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

export function categoriseDemand(input: DemandInput): DemandResult {
  const text = `${input.title} ${input.description ?? ""}`.toLowerCase();

  const excluded = isExcluded(text);
  if (excluded) {
    return { categories: [], basis: null, matchedOn: [`excluded:${excluded.trim()}`] };
  }

  const cats = new Set<DemandCategory>();
  const matchedOn: string[] = [];
  let sawDirect = false;
  let sawDerived = false;

  for (const rule of KEYWORD_RULES) {
    if (text.includes(rule.kw)) {
      rule.cats.forEach((c) => cats.add(c));
      matchedOn.push(`keyword:${rule.kw}`);
      rule.basis === "direct" ? (sawDirect = true) : (sawDerived = true);
    }
  }

  for (const cpv of input.cpvCodes ?? []) {
    const rule = CPV_RULES.find((r) => cpv.startsWith(r.prefix));
    if (rule) {
      rule.cats.forEach((c) => cats.add(c));
      matchedOn.push(`cpv:${cpv} (${rule.label})`);
      rule.basis === "direct" ? (sawDirect = true) : (sawDerived = true);
    }
  }

  return {
    categories: [...cats],
    // A scheme that matched anything direct is reported as direct even if it
    // also matched a derived rule — the stronger evidence wins.
    basis: sawDirect ? "direct" : sawDerived ? "derived" : null,
    matchedOn,
  };
}

export function generatesDemand(input: DemandInput): boolean {
  return categoriseDemand(input).categories.length > 0;
}
