import type { BusinessRates } from "../matching/types.js";

export interface CommercialInputs {
  tonnes: number | null; // extracted from requirements, if stated
  distanceMiles: number | null; // from the geography scorer
  valueLow: number | null; // stated contract value, if any
  valueHigh: number | null;
  rates: BusinessRates;
}

export interface CommercialResult {
  estimatedLoads: number | null;
  estimatedRevenue: number | null;
  estimatedCost: number | null;
  estimatedContribution: number | null;
  estimatedMarginPct: number | null;
  revenueBasis: "verified" | "calculated" | "estimated" | "unknown";
  note: string;
}

/**
 * Deterministic commercial calculation — no model call, per
 * docs/research/06-system-design.md and docs/architecture/03-ai-routing-strategy.md.
 * Never invents a rate: every input either comes from the notice
 * (verified) or the business's own configured rates (customer-provided).
 * If tonnage isn't stated, this returns "unknown" rather than guessing.
 */
export function calculateCommercial(inputs: CommercialInputs): CommercialResult {
  const { tonnes, distanceMiles, valueLow, valueHigh, rates } = inputs;

  if (tonnes === null) {
    // No stated tonnage to calculate from. If the notice itself states a
    // value, surface that as 'verified' with no derived loads/cost — better
    // than pretending we can compute a load count from nothing.
    if (valueLow !== null || valueHigh !== null) {
      return {
        estimatedLoads: null,
        estimatedRevenue: valueLow ?? valueHigh,
        estimatedCost: null,
        estimatedContribution: null,
        estimatedMarginPct: null,
        revenueBasis: "verified",
        note: "Contract value is stated in the notice; no tonnage is stated, so loads/cost/margin can't be calculated — shown as Unknown rather than estimated.",
      };
    }
    return {
      estimatedLoads: null,
      estimatedRevenue: null,
      estimatedCost: null,
      estimatedContribution: null,
      estimatedMarginPct: null,
      revenueBasis: "unknown",
      note: "No tonnage or contract value is stated in this notice. Commercial value is Unknown, not estimated.",
    };
  }

  if (!rates.payload || !rates.pricePerTonne) {
    return {
      estimatedLoads: null,
      estimatedRevenue: null,
      estimatedCost: null,
      estimatedContribution: null,
      estimatedMarginPct: null,
      revenueBasis: "unknown",
      note: "Tonnage is stated, but your business profile is missing a payload or price-per-tonne rate — configure rates to calculate an estimate.",
    };
  }

  const loads = tonnes / rates.payload;
  const revenue = loads * rates.payload * rates.pricePerTonne;

  let cost: number | null = null;
  if (distanceMiles !== null && rates.fuelPerMile && rates.driverPerDay) {
    const roundTripMiles = distanceMiles * 2;
    const totalMiles = loads * roundTripMiles;
    const fuelCost = totalMiles * rates.fuelPerMile;
    const vehicleDays = loads / 8; // assume 8 loads/vehicle/day, documented assumption
    const driverCost = vehicleDays * rates.driverPerDay;
    cost = fuelCost + driverCost;
  }

  const contribution = cost !== null ? revenue - cost : null;
  const marginPct = contribution !== null && revenue > 0 ? Math.round((contribution / revenue) * 1000) / 10 : null;

  return {
    estimatedLoads: Math.round(loads),
    estimatedRevenue: Math.round(revenue),
    estimatedCost: cost !== null ? Math.round(cost) : null,
    estimatedContribution: contribution !== null ? Math.round(contribution) : null,
    estimatedMarginPct: marginPct,
    revenueBasis: "calculated",
    note:
      cost !== null
        ? `Calculated from your configured rates: £${rates.pricePerTonne}/t, ${rates.payload}t payload, £${rates.fuelPerMile}/mi fuel, £${rates.driverPerDay}/day driver, assuming 8 loads/vehicle/day.`
        : "Revenue calculated from your rates; cost could not be calculated (distance or fuel/driver rate unavailable).",
  };
}
