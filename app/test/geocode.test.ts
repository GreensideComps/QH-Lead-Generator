import { test } from "node:test";
import assert from "node:assert/strict";
import { primaryPlaceName } from "../src/lib/geocode.js";

test("procurement-notice shape: town-first, region code — first segment", () => {
  assert.equal(primaryPlaceName("Lerwick, Shetland, UKM66"), "Lerwick");
  assert.equal(primaryPlaceName("Glasgow, UKM82"), "Glasgow");
});

test('REGRESSION: planning-signal shape (street address + real UK postcode) — was extracting the street name and silently failing to geocode', () => {
  assert.equal(primaryPlaceName("Rosemary Avenue, Newton Abbot TQ12 1SB"), "Newton Abbot");
  assert.equal(primaryPlaceName("14 Barton Villas, Dawlish EX7 9QJ"), "Dawlish");
  assert.equal(primaryPlaceName("Glendaragh, Barn Park Road, Teignmouth TQ14 8PN"), "Teignmouth");
});

test("null/empty input returns null, never throws", () => {
  assert.equal(primaryPlaceName(null), null);
  assert.equal(primaryPlaceName(""), null);
});

test("no postcode, no comma — whole string is the place name", () => {
  assert.equal(primaryPlaceName("Inverness"), "Inverness");
});
