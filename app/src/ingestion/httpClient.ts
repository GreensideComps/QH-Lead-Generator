/**
 * Shared fetch helper for ingestion. Both Find a Tender and
 * planning.data.gov.uk are official, keyless, OGL-licensed public APIs
 * (docs/research/02-data-sources.md) — this is never used for scraping a
 * site whose terms forbid it. A browser-like User-Agent is set because
 * find-tender.service.gov.uk's edge blocks bare/no-UA requests (confirmed
 * during development); this is standard API etiquette, not evasion of any
 * access restriction — the API itself is public and unauthenticated.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimum gap between outbound requests. These are free public services and
 *  paging a year of notices is hundreds of calls — deliberately unhurried.
 *  Find a Tender returns 429 without it (observed during the density study). */
const MIN_REQUEST_GAP_MS = Number(process.env.INGEST_REQUEST_GAP_MS ?? 350);
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export async function fetchJson<T>(url: string, timeoutMs = 20000, maxRetries = 4): Promise<T> {
  let attempt = 0;
  for (;;) {
    await throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Groundline-Ingestion/0.1 (+https://github.com/GreensideComps/QH-Lead-Generator)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      // Back off and retry on rate limiting or a transient upstream fault,
      // honouring Retry-After when the server sends one.
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
        attempt += 1;
        clearTimeout(timer);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText} for ${url}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

import { createHash } from "node:crypto";

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
