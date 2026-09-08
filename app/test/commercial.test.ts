import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCommercial } from "../src/commercial/calculate.js";

const RATES = { payload: 20, pricePerTonne: 8.5, pricePerMile: 3.2, fuelPerMile: 0.95, driverPerDay: 220, minMargin: 18 };

test("no tonnage and no value -> Unknown, nothing invented", () => {
  const result = calculateCommercial({ tonnes: null, distanceMiles: null, valueLow: null, valueHigh: null, rates: RATES });
  assert.equal(result.revenueBasis, "unknown");
  assert.equal(result.estimatedRevenue, null);
  assert.equal(result.estimatedLoads, null);
});

test("no tonnage but a stated contract value -> shows the verified value, not a fabricated calculation", () => {
  const result = calculateCommercial({ tonnes: null, distanceMiles: null, valueLow: 80000, valueHigh: 80000, rates: RATES });
  assert.equal(result.revenueBasis, "verified");
  assert.equal(result.estimatedRevenue, 80000);
  assert.equal(result.estimatedLoads, null, "must not invent a load count with no tonnage");
});

test("tonnage stated, full rates and distance available -> full calculated breakdown", () => {
  const result = calculateCommercial({ tonnes: 14000, distanceMiles: 18, valueLow: null, valueHigh: null, rates: RATES });
  assert.equal(result.revenueBasis, "calculated");
  assert.equal(result.estimatedLoads, 700); // 14000 / 20
  assert.equal(result.estimatedRevenue, 119000); // 700 * 20 * 8.5
  assert.ok(result.estimatedCost !== null);
  assert.ok(result.estimatedContribution !== null);
  assert.equal(result.estimatedContribution, result.estimatedRevenue! - result.estimatedCost!);
});

test("tonnage stated but no payload/price rate configured -> Unknown, not a guess", () => {
  const result = calculateCommercial({
    tonnes: 5000,
    distanceMiles: 10,
    valueLow: null,
    valueHigh: null,
    rates: { ...RATES, payload: 0, pricePerTonne: 0 },
  });
  assert.equal(result.revenueBasis, "unknown");
});

test("tonnage stated but no distance -> revenue calculated, cost stays null (not guessed)", () => {
  const result = calculateCommercial({ tonnes: 1000, distanceMiles: null, valueLow: null, valueHigh: null, rates: RATES });
  assert.equal(result.revenueBasis, "calculated");
  assert.ok(result.estimatedRevenue !== null);
  assert.equal(result.estimatedCost, null);
  assert.equal(result.estimatedContribution, null);
});
