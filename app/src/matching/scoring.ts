import { geocodePlace, haversineMiles, primaryPlaceName } from "../lib/geocode.js";
import type {
  BusinessProfileForMatching,
  MatchResult,
  MatchableCandidate,
  ScoreComponent,
} from "./types.js";

/**
 * Deterministic matching engine. NO model call anywhere in this file —
 * per docs/architecture/03-ai-routing-strategy.md and the brief's own
 * instruction, an LLM never decides a score. Every number here is
 * reproducible from its inputs; re-running produces the same result.
 *
 * Weights match the hypothesis in docs/research/06-system-design.md —
 * explicitly a starting hypothesis to tune from real feedback, not a
 * researched constant, which is why they're passed through and stored
 * per-match (matches.weights_used) rather than hardcoded silently.
 */
export const DEFAULT_WEIGHTS = {
  service: 0.25,
  fleet: 0.2,
  geography: 0.2,
  capacity: 0.15,
  commercial: 0.1,
  sector: 0.1,
} as const;

// Keyword -> service mapping. Deliberately simple substring matching, not
// an embedding/semantic model — see docs/architecture/04-implementation-status.md
// known limitations for why this is a documented v1 simplification.
const SERVICE_KEYWORDS: Record<string, string[]> = {
  "Aggregate haulage": ["aggregate", "haulage", "tipper", "gravel", "quarry", "quarrying", "crushed stone", "haul road"],
  "Waste haulage": ["waste", "refuse", "rubbish"],
  "Muck-away": ["muck", "spoil", "excavation", "earthworks", "cut and fill", "groundworks"],
};

const FLEET_KEYWORDS: Record<string, string[]> = {
  "8-wheel tipper": ["tipper", "8-wheel", "eight-wheel", "haul road", "aggregate"],
  "Articulated tipper": ["tipper", "articulated", "artic"],
  "Grab vehicle": ["grab"],
};

const SECTOR_SIGNALS: Record<string, { cpvPrefixes: string[]; keywords: string[] }> = {
  Construction: { cpvPrefixes: ["45"], keywords: ["construction", "demolition"] },
  Infrastructure: { cpvPrefixes: ["4523"], keywords: ["highway", "road", "landfill"] },
  Aggregates: { cpvPrefixes: ["1421"], keywords: ["aggregate", "quarry"] },
  Quarrying: { cpvPrefixes: ["1421"], keywords: ["quarry", "quarrying"] },
  Waste: { cpvPrefixes: ["9051"], keywords: ["waste", "refuse"] },
  Earthworks: { cpvPrefixes: ["45111", "45112"], keywords: ["earthworks", "groundworks", "excavation", "cut and fill"] },
};

function textOf(candidate: MatchableCandidate): string {
  const reqText = candidate.requirements.map((r) => r.valueText).join(" ");
  return `${candidate.title} ${candidate.description ?? ""} ${reqText}`.toLowerCase();
}

function scoreService(profile: BusinessProfileForMatching, candidate: MatchableCandidate): ScoreComponent {
  const text = textOf(candidate);
  const matched: string[] = [];
  for (const service of profile.services) {
    const kws = SERVICE_KEYWORDS[service] ?? [service.toLowerCase()];
    if (kws.some((kw) => text.includes(kw))) matched.push(service);
  }

  if (matched.length > 0) {
    return {
      score: matched.length > 1 ? 100 : 85,
      factors: matched.map((s) => `Matches your stated service: ${s}`),
      negatives: [],
      unknowns: [],
    };
  }
  return {
    score: 10,
    factors: [],
    negatives: ["No overlap found between this notice's text and any of your stated services"],
    unknowns: [],
  };
}

function scoreFleet(profile: BusinessProfileForMatching, candidate: MatchableCandidate): ScoreComponent {
  const text = textOf(candidate);
  const matched: string[] = [];
  for (const line of profile.fleet) {
    const kws = FLEET_KEYWORDS[line.type] ?? [line.type.toLowerCase()];
    if (kws.some((kw) => text.includes(kw))) matched.push(line.type);
  }

  if (matched.length > 0) {
    return {
      score: 90,
      factors: matched.map((t) => `Notice references work consistent with your ${t}`),
      negatives: [],
      unknowns: [],
    };
  }
  return {
    score: 50,
    factors: [],
    negatives: [],
    unknowns: ["No specific vehicle/plant type is stated in this notice — fleet fit can't be confirmed from public text alone"],
  };
}

async function scoreGeography(profile: BusinessProfileForMatching, candidate: MatchableCandidate): Promise<ScoreComponent & { distanceMiles: number | null }> {
  if (!profile.baseLocation || !profile.operatingRadiusMiles) {
    return { score: 50, factors: [], negatives: [], unknowns: ["Business base location or operating radius not set"], distanceMiles: null };
  }
  const placeName = primaryPlaceName(candidate.locationText);
  if (!placeName) {
    return { score: 50, factors: [], negatives: [], unknowns: ["Notice does not state a specific location"], distanceMiles: null };
  }

  const [basePoint, oppPoint] = await Promise.all([geocodePlace(profile.baseLocation), geocodePlace(placeName)]);
  if (!basePoint || !oppPoint) {
    return { score: 50, factors: [], negatives: [], unknowns: [`Could not geocode location "${placeName}" against a free UK place-lookup service`], distanceMiles: null };
  }

  const distance = haversineMiles(basePoint, oppPoint);
  const radius = profile.operatingRadiusMiles;

  if (distance > radius) {
    return {
      score: Math.max(0, Math.round(20 * (1 - (distance - radius) / radius))),
      factors: [],
      negatives: [`${Math.round(distance)} miles from your base — outside your ${radius}-mile operating radius`],
      unknowns: [],
      distanceMiles: Math.round(distance),
    };
  }

  const proportion = distance / radius;
  const score = Math.round(100 - proportion * 60); // 100 at 0mi, 40 at the radius edge
  return {
    score,
    factors: [`${Math.round(distance)} miles from your base — within your ${radius}-mile operating radius`],
    negatives: [],
    unknowns: [],
    distanceMiles: Math.round(distance),
  };
}

function extractTonnes(candidate: MatchableCandidate): number | null {
  const text = textOf(candidate);
  const match = text.match(/([\d,]+(?:\.\d+)?)\s*(?:tonnes|tonne|t\b)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function scoreCapacity(profile: BusinessProfileForMatching, candidate: MatchableCandidate): ScoreComponent {
  const tonnes = extractTonnes(candidate);
  if (tonnes === null || !profile.capacityAvailable || !profile.rates.payload) {
    return { score: 50, factors: [], negatives: [], unknowns: ["No stated tonnage/scale to compare against your available capacity"] };
  }
  const estimatedVehicleDays = tonnes / profile.rates.payload / 8; // assume 8 loads/vehicle/day
  if (estimatedVehicleDays <= profile.capacityAvailable) {
    return { score: 90, factors: [`Estimated vehicle requirement fits comfortably within your ${profile.capacityAvailable} available vehicles`], negatives: [], unknowns: [] };
  }
  return { score: 40, factors: [], negatives: [`Estimated vehicle requirement (~${Math.ceil(estimatedVehicleDays)} vehicle-days) exceeds your currently available capacity`], unknowns: [] };
}

function scoreCommercial(profile: BusinessProfileForMatching, candidate: MatchableCandidate): ScoreComponent {
  const value = candidate.valueLow ?? candidate.valueHigh;
  if (value === null || !profile.minOpportunityValue) {
    return { score: 50, factors: [], negatives: [], unknowns: ["No contract value stated in this notice"] };
  }
  if (value < profile.minOpportunityValue) {
    return { score: 15, factors: [], negatives: [`Value (£${value.toLocaleString()}) is below your stated minimum of £${profile.minOpportunityValue.toLocaleString()}`], unknowns: [] };
  }
  const ratio = value / profile.minOpportunityValue;
  const score = Math.min(100, Math.round(50 + ratio * 10));
  return { score, factors: [`Value (£${value.toLocaleString()}) is above your stated minimum of £${profile.minOpportunityValue.toLocaleString()}`], negatives: [], unknowns: [] };
}

function scoreSector(profile: BusinessProfileForMatching, candidate: MatchableCandidate): ScoreComponent {
  const text = textOf(candidate);
  const matched: string[] = [];
  for (const sector of profile.preferredSectors) {
    const signal = SECTOR_SIGNALS[sector];
    if (!signal) continue;
    const cpvMatch = candidate.cpvCodes.some((cpv) => signal.cpvPrefixes.some((p) => cpv.startsWith(p)));
    const kwMatch = signal.keywords.some((kw) => text.includes(kw));
    if (cpvMatch || kwMatch) matched.push(sector);
  }
  if (matched.length > 0) {
    return { score: 100, factors: [`In one of your preferred sectors: ${matched.join(", ")}`], negatives: [], unknowns: [] };
  }
  return { score: 30, factors: [], negatives: [], unknowns: ["Could not confirm this notice is in one of your preferred sectors"] };
}

export async function computeMatch(
  profile: BusinessProfileForMatching,
  candidate: MatchableCandidate,
  weights: Record<string, number> = DEFAULT_WEIGHTS,
): Promise<MatchResult> {
  const service = scoreService(profile, candidate);
  const fleet = scoreFleet(profile, candidate);
  const geography = await scoreGeography(profile, candidate);
  const capacity = scoreCapacity(profile, candidate);
  const commercial = scoreCommercial(profile, candidate);
  const sector = scoreSector(profile, candidate);

  const totalScore = Math.round(
    weights.service * service.score +
      weights.fleet * fleet.score +
      weights.geography * geography.score +
      weights.capacity * capacity.score +
      weights.commercial * commercial.score +
      weights.sector * sector.score,
  );

  const all = [service, fleet, geography, capacity, commercial, sector];

  // Geography and service act partly as GATES, not just weighted inputs
  // (docs/research/06-system-design.md: "an opportunity 300 miles outside
  // a 100-mile radius... should not merely score low, it should be
  // filtered out entirely by default"). A high score on every other
  // dimension shouldn't be able to paper over "you cannot realistically
  // get there" or "you don't offer this service at all".
  let gatedScore = totalScore;
  const gateReasons: string[] = [];
  if (geography.distanceMiles !== null && profile.operatingRadiusMiles && geography.distanceMiles > profile.operatingRadiusMiles * 1.5) {
    gatedScore = Math.min(gatedScore, 25);
    gateReasons.push(`Capped: ${geography.distanceMiles} miles is well beyond your ${profile.operatingRadiusMiles}-mile radius — not realistically serviceable regardless of other factors`);
  }
  if (service.score <= 20) {
    gatedScore = Math.min(gatedScore, 25);
    gateReasons.push("Capped: no evidence this notice needs a service you actually offer");
  }

  return {
    service,
    fleet,
    geography,
    capacity,
    commercial,
    sector,
    totalScore: gatedScore,
    weightsUsed: weights,
    positiveFactors: all.flatMap((c) => c.factors),
    negativeFactors: [...all.flatMap((c) => c.negatives), ...gateReasons],
    unknownFactors: all.flatMap((c) => c.unknowns),
  };
}
