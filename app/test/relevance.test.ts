import { test } from "node:test";
import assert from "node:assert/strict";
import { isRelevant } from "../src/ingestion/relevance.js";

test("matches a genuine earthworks/aggregate notice", () => {
  const res = isRelevant({
    title: "Gremista Landfill Phase 3",
    description: "cut and fill earthworks, new haul roads, clean aggregate drainage layer",
    cpvCodes: ["45111000"],
  });
  assert.equal(res.relevant, true);
});

test("matches on the narrow aggregates CPV code even with generic text", () => {
  const res = isRelevant({ title: "Materials supply", description: "annual contract", cpvCodes: ["14210000"] });
  assert.equal(res.relevant, true);
  assert.ok(res.matchedOn.some((m) => m.startsWith("cpv:")));
});

test('REGRESSION: "aggregate value of the contract" is NOT a construction-aggregate match', () => {
  // Real false positive found during development (WorkWell Service for NHS
  // Essex ICB) — "aggregate" alone matches routine financial phrasing in
  // procurement notices. Bare "aggregate" was removed from the keyword list
  // specifically because of this case.
  const res = isRelevant({
    title: "Framework Agreement",
    description: "The aggregate value of the Proposed Contract across all five LOTS is £5,163,141.",
    cpvCodes: ["85323000"],
  });
  assert.equal(res.relevant, false);
});

test('REGRESSION: "backfill staff" is NOT a soil-backfill match', () => {
  // Real false positive found during development (Social Program Management
  // Framework) — "backfill" alone matches HR/staffing phrasing.
  const res = isRelevant({
    title: "Framework Agreement",
    description: "resources deployed to either backfill staff or fulfil a role",
    cpvCodes: ["72000000"],
  });
  assert.equal(res.relevant, false);
});

test("does not match an unrelated services notice", () => {
  const res = isRelevant({
    title: "Cleaning Services",
    description: "office cleaning and janitorial services",
    cpvCodes: ["90910000"],
  });
  assert.equal(res.relevant, false);
});

test("bare CPV division (45, 90) is deliberately too broad and NOT included", () => {
  // Confirmed during development: matching the whole "45" division pulled in
  // electrical work, asbestos removal, cleaning. Only narrow sub-codes are used.
  const res = isRelevant({ title: "Electrical rewiring", description: "rewire of school building", cpvCodes: ["45310000"] });
  assert.equal(res.relevant, false);
});
