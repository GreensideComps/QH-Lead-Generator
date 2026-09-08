import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatch } from "../src/matching/scoring.js";
import type { BusinessProfileForMatching, ProcurementCandidate } from "../src/matching/types.js";

const RATES = { payload: 20, pricePerTonne: 8.5, pricePerMile: 3.2, fuelPerMile: 0.95, driverPerDay: 220, minMargin: 18 };

function profile(overrides: Partial<BusinessProfileForMatching> = {}): BusinessProfileForMatching {
  return {
    businessId: "test-business",
    services: ["Aggregate haulage", "Waste haulage", "Muck-away"],
    fleet: [{ type: "8-wheel tipper", count: 14 }],
    baseLocation: null, // deliberately null so scoreGeography skips the network call in unit tests
    operatingRadiusMiles: 100,
    capacityAvailable: 20,
    minOpportunityValue: 25000,
    preferredSectors: ["Construction", "Aggregates"],
    rates: RATES,
    ...overrides,
  };
}

function candidate(overrides: Partial<ProcurementCandidate> = {}): ProcurementCandidate {
  return {
    procurementId: "test-procurement",
    title: "Test notice",
    description: "",
    buyerName: "Test Council",
    valueLow: null,
    valueHigh: null,
    locationText: null,
    deadline: null,
    cpvCodes: [],
    sourceUrl: "https://example.invalid/notice/1",
    requirements: [],
    ...overrides,
  };
}

test("scores are reproducible — same inputs always produce the same output", async () => {
  const p = profile();
  const c = candidate({ title: "Aggregate haulage for highway works", cpvCodes: ["45111000"], valueLow: 100000 });
  const a = await computeMatch(p, c);
  const b = await computeMatch(p, c);
  assert.deepEqual(a, b);
});

test("a clear service match scores well above a clear service mismatch", async () => {
  const p = profile();
  const good = await computeMatch(p, candidate({ title: "Aggregate haulage contract", description: "tipper haulage of quarry material" }));
  const bad = await computeMatch(p, candidate({ title: "IT support services", description: "helpdesk and software licensing" }));
  assert.ok(good.totalScore > bad.totalScore, `expected ${good.totalScore} > ${bad.totalScore}`);
});

test("no service overlap caps the total score regardless of other dimensions", async () => {
  const p = profile();
  // High value, in a preferred sector, but nothing haulage-related at all.
  const c = candidate({ title: "School building electrical rewiring", cpvCodes: ["45310000"], valueLow: 500000 });
  const result = await computeMatch(p, c);
  assert.ok(result.totalScore <= 25, `expected capped score, got ${result.totalScore}`);
  assert.ok(result.negativeFactors.some((f) => f.includes("Capped")));
});

test("value below the business's stated minimum scores low on commercial fit", async () => {
  const p = profile({ minOpportunityValue: 25000 });
  const c = candidate({ title: "Aggregate haulage small job", valueLow: 5000, valueHigh: 5000 });
  const result = await computeMatch(p, c);
  assert.ok(result.commercial.score < 30);
  assert.ok(result.commercial.negatives.length > 0);
});

test("unstated fields are reported as unknown, never silently scored as if verified", async () => {
  const p = profile();
  const c = candidate({ title: "Aggregate haulage works", description: "no further detail" });
  const result = await computeMatch(p, c);
  assert.ok(result.unknownFactors.length > 0);
});

test("weights actually used are returned alongside the score, for auditability", async () => {
  const p = profile();
  const result = await computeMatch(p, candidate());
  assert.ok(result.weightsUsed.service === 0.25);
  const weightedSum = Object.values(result.weightsUsed).reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(weightedSum - 1) < 1e-9, "weights should sum to 1");
});
