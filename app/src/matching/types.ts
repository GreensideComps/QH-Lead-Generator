export interface BusinessRates {
  payload: number;
  pricePerTonne: number;
  pricePerMile: number;
  fuelPerMile: number;
  driverPerDay: number;
  minMargin: number;
}

export interface FleetLine {
  type: string;
  count: number;
}

export interface BusinessProfileForMatching {
  businessId: string;
  services: string[];
  fleet: FleetLine[];
  baseLocation: string | null;
  operatingRadiusMiles: number | null;
  capacityAvailable: number | null;
  minOpportunityValue: number | null;
  preferredSectors: string[];
  rates: BusinessRates;
}

export interface RequirementRow {
  fieldName: string;
  valueText: string;
  confidence: "verified" | "calculated" | "customer_provided" | "estimated" | "inferred" | "unknown";
  sourceSpan: string | null;
}

/** Shared shape the deterministic scoring engine actually reads — either a
 *  procurement notice or a planning signal can satisfy this, so the same
 *  matching engine (not a second one) scores both, per the instruction not
 *  to build duplicate systems. */
export interface MatchableCandidate {
  title: string;
  description: string | null;
  buyerName: string | null;
  valueLow: number | null;
  valueHigh: number | null;
  locationText: string | null;
  cpvCodes: string[];
  sourceUrl: string;
  requirements: RequirementRow[];
}

export interface ProcurementCandidate extends MatchableCandidate {
  procurementId: string;
  deadline: string | null;
}

export interface PlanningCandidate extends MatchableCandidate {
  planningSignalId: string;
  dataset: string;
}

export interface ScoreComponent {
  score: number; // 0-100
  factors: string[]; // positive, human-readable
  negatives: string[];
  unknowns: string[];
}

export interface MatchResult {
  service: ScoreComponent;
  fleet: ScoreComponent;
  geography: ScoreComponent & { distanceMiles: number | null };
  capacity: ScoreComponent;
  commercial: ScoreComponent;
  sector: ScoreComponent;
  totalScore: number;
  weightsUsed: Record<string, number>;
  positiveFactors: string[];
  negativeFactors: string[];
  unknownFactors: string[];
}
