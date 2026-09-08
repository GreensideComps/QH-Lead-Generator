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

export interface ProcurementCandidate {
  procurementId: string;
  title: string;
  description: string | null;
  buyerName: string | null;
  valueLow: number | null;
  valueHigh: number | null;
  locationText: string | null;
  deadline: string | null;
  cpvCodes: string[];
  sourceUrl: string;
  requirements: RequirementRow[];
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
  geography: ScoreComponent;
  capacity: ScoreComponent;
  commercial: ScoreComponent;
  sector: ScoreComponent;
  totalScore: number;
  weightsUsed: Record<string, number>;
  positiveFactors: string[];
  negativeFactors: string[];
  unknownFactors: string[];
}
