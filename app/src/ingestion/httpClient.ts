/**
 * Shared fetch helper for ingestion. Both Find a Tender and
 * planning.data.gov.uk are official, keyless, OGL-licensed public APIs
 * (docs/research/02-data-sources.md) — this is never used for scraping a
 * site whose terms forbid it. A browser-like User-Agent is set because
 * find-tender.service.gov.uk's edge blocks bare/no-UA requests (confirmed
 * during development); this is standard API etiquette, not evasion of any
 * access restriction — the API itself is public and unauthenticated.
 */
export async function fetchJson<T>(url: string, timeoutMs = 20000): Promise<T> {
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
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

import { createHash } from "node:crypto";

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
