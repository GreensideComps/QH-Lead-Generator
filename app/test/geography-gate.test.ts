import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatch } from "../src/matching/scoring.js";
import type { BusinessProfileForMatching, MatchableCandidate } from "../src/matching/types.js";

/**
 * Real-geocoding regression tests (network + DB cache, not mocked) proving
 * the hard geography gate holds end-to-end — not just at the unit level
 * with baseLocation stubbed to null (see scoring.test.ts). This is the
 * specific failure mode found and fixed during development: a distant
 * opportunity with an otherwise-strong match could reach 66/100 before the
 * gate existed (docs/architecture/04-implementation-status.md).
 */

const RATES = { payload: 20, pricePerTonne: 8.5, pricePerMile: 3.2, fuelPerMile: 0.95, driverPerDay: 220, minMargin: 18 };

function midlandsProfile(): BusinessProfileForMatching {
  return {
    businessId: "test-business",
    services: ["Aggregate haulage", "Waste haulage", "Muck-away"],
    fleet: [{ type: "8-wheel tipper", count: 14 }],
    baseLocation: "Tamworth",
    operatingRadiusMiles: 100,
    capacityAvailable: 20,
    minOpportunityValue: 25000,
    preferredSectors: ["Construction", "Aggregates", "Earthworks"],
    rates: RATES,
  };
}

function strongContentCandidate(locationText: string): MatchableCandidate {
  // Deliberately excellent on every non-geography dimension — service,
  // fleet, commercial, sector all maxed out — so a passing test proves the
  // gate specifically, not a weak candidate that would score low anyway.
  return {
    title: "Aggregate haulage and tipper works — cut and fill earthworks",
    description: "Large quarry aggregate haulage contract requiring 8-wheel tipper fleet, cut and fill earthworks, crushed stone supply.",
    buyerName: "Test Council",
    valueLow: 500000,
    valueHigh: 500000,
    locationText,
    cpvCodes: ["45111000", "14210000"],
    sourceUrl: "https://example.invalid/notice/1",
    requirements: [],
  };
}

test("REGRESSION: an opportunity ~500 miles away never scores as a strong/medium fit, even with an otherwise-perfect content match", async () => {
  const result = await computeMatch(midlandsProfile(), strongContentCandidate("Lerwick, Shetland, UKM66"));
  assert.ok(result.geography.distanceMiles !== null, "expected real geocoding to succeed and produce a distance");
  assert.ok(result.geography.distanceMiles! > 400, `expected a genuinely large real distance, got ${result.geography.distanceMiles}`);
  assert.ok(result.totalScore <= 30, `expected the geography gate to cap total score low, got ${result.totalScore}`);
  assert.ok(result.negativeFactors.some((f) => f.toLowerCase().includes("not realistically serviceable")));
});

test("a genuinely nearby opportunity with the same strong content is NOT capped", async () => {
  const result = await computeMatch(midlandsProfile(), strongContentCandidate("Birmingham, UKG"));
  assert.ok(result.geography.distanceMiles !== null);
  assert.ok(result.geography.distanceMiles! < 100, `expected Birmingham to be within radius, got ${result.geography.distanceMiles}`);
  assert.ok(result.totalScore > 60, `expected a nearby strong match to score well, got ${result.totalScore}`);
});
