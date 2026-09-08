import { servicePool } from "../db/pool.js";
import { fetchJson } from "../ingestion/httpClient.js";

/**
 * Real UK place geocoding via postcodes.io — free, keyless, no account
 * needed, built on ONS Open Geography data (OGL-licensed). Results are
 * cached in `places` so repeated matching runs don't re-query the API.
 * This is deterministic infrastructure (a lookup + cache), not an AI call —
 * geography scoring must never be an LLM guess (docs/research/06-system-design.md).
 */

interface PostcodesIoPlacesResponse {
  status: number;
  result: Array<{ name_1: string; latitude: number; longitude: number }> | null;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export async function geocodePlace(rawName: string): Promise<LatLng | null> {
  const name = rawName.trim();
  if (!name) return null;

  const cached = await servicePool.query(
    `select latitude, longitude from places where name = $1`,
    [name],
  );
  if (cached.rowCount) {
    return { latitude: cached.rows[0].latitude, longitude: cached.rows[0].longitude };
  }

  const url = `https://api.postcodes.io/places?q=${encodeURIComponent(name)}&limit=1`;
  const res = await fetchJson<PostcodesIoPlacesResponse>(url);
  const match = res.result?.[0];
  if (!match) return null;

  const point = { latitude: match.latitude, longitude: match.longitude };
  await servicePool.query(
    `insert into places (name, latitude, longitude) values ($1, $2, $3)
     on conflict (name) do nothing`,
    [name, point.latitude, point.longitude],
  );
  return point;
}

/** Great-circle distance in miles — deterministic, no AI. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R_MILES = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R_MILES * c;
}

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/**
 * Best-effort extraction of a geocodable place name from a free-text
 * location string. Two real shapes appear in this codebase's actual data
 * and need different handling (found by inspecting real matching output,
 * not assumed):
 *   - Procurement notices: "Lerwick, Shetland, UKM66" — town first, then a
 *     NUTS/ONS region code. First comma-separated segment is the town.
 *   - Planning signals (full street addresses): "Rosemary Avenue, Newton
 *     Abbot TQ12 1SB" — the town sits just before a real UK postcode, not
 *     in the first segment (which is a street name). Taking the first
 *     segment here previously extracted "Rosemary Avenue" and failed to
 *     geocode, silently degrading every planning-signal match to "unknown"
 *     geography — regression-tested in test/geocode.test.ts.
 * Strategy: if a real UK postcode is present, use the text immediately
 * before it (minus any leading street/building fragment after the last
 * comma) as the place name; otherwise fall back to the first segment.
 * Documented heuristic, not a claim of perfect address parsing — good
 * enough for town/city-level precision (docs/architecture/04-implementation-status.md).
 */
export function primaryPlaceName(locationText: string | null): string | null {
  if (!locationText) return null;

  const postcodeMatch = locationText.match(UK_POSTCODE);
  if (postcodeMatch && postcodeMatch.index !== undefined) {
    const beforePostcode = locationText.slice(0, postcodeMatch.index).trim();
    const lastSegment = beforePostcode.split(",").pop()?.trim();
    if (lastSegment) return lastSegment;
  }

  const first = locationText.split(",")[0]?.trim();
  return first || null;
}
