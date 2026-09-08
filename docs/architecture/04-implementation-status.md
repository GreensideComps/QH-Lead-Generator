# Implementation Status — Commercial Vertical Slice

*Written at the end of the build described in this document. Read alongside `docs/EXECUTIVE_SUMMARY.md` (which this build does not supersede — the validation experiment there still hasn't run) and `docs/architecture/00-groundline-architecture.md` (the longer-term plan this is the first real slice of).*

## What this is

A real, working backend + web app proving the commercial loop:

```
PUBLIC DATA → COMMERCIAL SIGNAL → VERIFIED OPPORTUNITY →
CUSTOMER-SPECIFIC MATCH → ACTIONABLE INTELLIGENCE → CUSTOMER VALUE
```

Code lives in `app/`. Local Postgres 16 stands in for a Supabase project (identical schema — see "Path to production" below); everything else runs as documented.

## Final acceptance test — actually run, not simulated

All 12 steps were executed against the running app via a real browser (Playwright), driven at the local dev server (`npm run dev`, `app/.env`), against real ingested data. Concrete evidence for each step:

1. **Real source data enters Groundline.** `npm run ingest:fts` fetched 1,524 live notices from the Find a Tender OCDS API (`find-tender.service.gov.uk`) across a 270-day window; `npm run ingest:planning` fetched 100 live brownfield-land entities from `planning.data.gov.uk`. Both are official, keyless UK government APIs — see `docs/research/02-data-sources.md`. Ingestion run log: `select * from ingestion_runs` (real timestamps, real fetch/insert counts, one row per run).
2. **Groundline identifies a commercial signal.** The deterministic relevance filter (`src/ingestion/relevance.ts`) reduced 1,524 fetched notices to 34 relevant ones — e.g. **"Fair Oak Cemetery Path Resurfacing"** (Find a Tender notice `029088-2026`, Fair Oak & Horton Heath Parish Council, £80,000, real live notice: https://www.find-tender.service.gov.uk/Notice/029088-2026).
3. **The signal becomes a structured opportunity.** `opportunities` row `6d8decca-f812-4819-943b-4a9e40b838e9` links that notice to the seeded demonstration business.
4. **Evidence is attached.** 4 `evidence` rows for that opportunity (material/service claim, quantity claim, contract value, calculated distance), each with a `confidence` label and, where applicable, an exact quoted `source_span` — verified against source text by `npm test` (`verifyAllSourceSpans`).
5. **A realistic business profile exists.** Seeded via `npm run seed:profile` — NRS Services Ltd (explicitly labelled "demonstration profile — not a real customer"), the same fleet/rates profile used in the earlier static prototype, now a real row the matching engine actually reads.
6. **The matching engine scores the opportunity.** `npm run match:run` computed a **total score of 60** ("Medium fit") via 6 deterministic dimensions (service 85, fleet 50, geography 17, capacity 50, commercial 82, sector 100) — reproducibility confirmed by `test/scoring.test.ts` ("same inputs always produce the same output").
7. **Groundline explains why it matches.** Positive factors ("Matches your stated service: Aggregate haulage", "Value (£80,000) is above your stated minimum of £25000", "In one of your preferred sectors: Construction, Infrastructure"), negative factors ("116 miles from your base — outside your 100-mile operating radius"), and unknowns (fleet/capacity not stated) are all stored and rendered.
8. **The user can open the opportunity.** `GET /opportunities/6d8decca-...` rendered the full detail page (screenshot captured during testing) — recorded `opportunity_viewed` and `match_viewed` analytics events.
9. **The user can unlock deeper intelligence.** `POST /opportunities/6d8decca-.../unlock` debited 1 credit (balance 10 → 9, `credit_transactions` row written), and generated synthesis content.
10. **The intelligence contains provenance and confidence.** The unlocked content's `method` field honestly records `deterministic-template` (no `ANTHROPIC_API_KEY` in this environment — see below), not `claude-api-production`; the underlying facts it summarises are the same sourced/labelled evidence from step 4.
11. **Groundline recommends an action.** "Review the full evidence below and, if it holds up, make contact before the deadline." — generated from the same deterministic template, honestly reflecting a medium-confidence, borderline-geography opportunity rather than oversimplifying to a generic "contact now."
12. **The event is recorded for validation/analytics.** `analytics_events` contains real rows: `opportunity_viewed` ×2, `match_viewed` ×2, `opportunity_unlocked`, `intelligence_consumed`, `recommended_action_viewed`, plus (on a second opportunity) `opportunity_saved` and `customer_returned` — all with real timestamps from the actual browser session, not inserted directly.

**All 12 steps demonstrated end-to-end. The phase is complete by the brief's own acceptance bar.**

## What uses real data vs. what's mocked

| Component | Real or mocked | Detail |
|---|---|---|
| Procurement ingestion (Find a Tender) | **Real** | Live API, live data, 34 genuinely relevant notices out of 1,524 fetched |
| Planning signal ingestion | **Real** | Live `planning.data.gov.uk` brownfield-land dataset, 100 entities |
| Relevance filtering | **Real, deterministic** | Found and fixed two real false-positive bugs during development (see below) |
| Extraction (structured fields from notice text) | **Real text, manually performed** | `src/extraction/extractionAgent.ts` is a real, callable Claude integration that **refuses to run** without `ANTHROPIC_API_KEY` (not configured in this sandbox). `src/extraction/seed-manual-extraction.ts` performed the same extraction manually, in this session, on real notice text, following the identical prompt rules — every claim is checked against the source text programmatically (`npm test`). Explicitly labelled `extracted_by: 'claude-code-manual-session'`, never presented as automated. |
| Verification | **Mechanical check real; AI check not run** | `verifySourceSpans.ts` mechanically confirms every "verified" claim's quote exists in source text (this ran, for real, and passed). The AI Verification Agent's semantic check (does the quote *support* the claim, not just appear in the text) requires the same missing API key — code is written and correct, not exercised live. |
| Geocoding / distance | **Real** | `postcodes.io` (free, keyless, ONS-derived), real haversine distance, cached in `places` |
| Matching & scoring | **Real, deterministic, fully exercised** | Ran against all 34 real opportunities × 1 seeded business |
| Commercial calculation | **Real, deterministic** | Correctly returns "Unknown" for notices with no stated tonnage — this is the honest common case in the current real sample, not a bug |
| Credits ledger | **Real** | Live debit/balance/transaction rows from real unlock actions |
| Intelligence synthesis | **Real logic, deterministic-template fallback** | Same key-required/graceful-fallback pattern as extraction |
| Stripe billing | **Real code, not live-tested** | No Stripe account in this sandbox; `/billing/checkout` correctly returns 501 rather than faking success. Credit-granting logic (the part that matters most) has DB-level test coverage independent of Stripe. |
| Business profile | **One real seeded row, explicitly labelled** | Not a real customer — labelled as such everywhere it's displayed |
| Analytics events | **Real** | Written by real user actions in a real browser session, not inserted as fixtures |

## Real bugs found and fixed during this build (not theoretical)

1. **Relevance filter false positives**: bare CPV divisions "45"/"90" were far too broad (matched electrical work, cleaning, asbestos removal) — narrowed to specific sub-codes. Bare keywords "aggregate" and "backfill" matched routine procurement phrasing ("the aggregate value of the contract", "backfill staff") unrelated to construction materials — removed, regression-tested in `test/relevance.test.ts`.
2. **Missing uniqueness constraint**: `opportunities` had no unique constraint on `(business_id, procurement_id)`, so re-running the matching engine created duplicate rows instead of upserting. Found by actually re-running it. Fixed in `0003_opportunity_uniqueness.sql`, regression-tested in `test/db-integration.test.ts`.
3. **Geography as a soft-only score**: initially a 520-mile-away Shetland notice could still reach a 66/100 total score because geography was only 20% of the weighted sum. Fixed by implementing the hard gate documented (but not yet implemented) in `docs/research/06-system-design.md` — distance well beyond radius now caps the total score regardless of other dimensions.
4. **Missing font fallbacks**: `font-family:'Archivo'` with no fallback stack meant the whole UI silently fell back to serif default fonts if the Google Fonts request failed (it does, in this sandboxed environment) — fixed across all render files.
5. **`analytics_events` missed from the RLS pass**: every other tenant-scoped table got a Row Level Security policy in `0001_init.sql`; this one was missed. Fixed in `0005_analytics_rls.sql` when writing the analytics tracking module.

None of these were found by inspection alone — all five surfaced by actually running the ingestion, the matching engine, and the app against real data and a real browser, which is the reason this was worth doing as real code rather than description.

## Known limitations (honest, not hidden)

- **Extraction/Verification agents are not running live.** No `ANTHROPIC_API_KEY` in this sandbox. Code is real and correct (typechecked, structured, tested for its fallback behaviour); a production deployment needs this key to run the automated pipeline instead of the manual-seed path.
- **Companies House enrichment is not implemented.** No API key configured; `companies` table exists in the schema but is currently empty. Buyer names come from the FTS notice itself (`procurement.buyer_name`), not company-register enrichment.
- **Relevance filtering is simple keyword/CPV matching**, not semantic — demonstrably imprecise (see bugs above), and the false-positive/false-negative rate on a larger corpus is unmeasured. This is a documented v1 simplification, not a claim of high recall/precision.
- **Geocoding is town/city-level**, not exact site address — `primaryPlaceName()` takes the first comma-separated segment of a free-text location string, a documented heuristic.
- **Tonnage extraction from requirement text is a single regex pattern** (`\d+\s*tonnes?`) — works for the cases in this sample, will miss other phrasings (e.g. "500 cubic metres", "20t loads") without extension.
- **No planning-application-derived opportunities are matched yet** — `planning_signals` ingestion is real and working, but the matching engine currently only scores `procurement`-sourced opportunities. Wiring planning signals into `opportunities`/`matches` is straightforward (same pattern) but not done in this phase, to keep the slice small.
- **Single business profile.** Multi-tenant RLS is real and tested (`db-integration.test.ts` inserts a second business and confirms isolation of the credit ledger), but only one demonstration business has been exercised through the full app.
- **No `npm run extract:run` (automated path) has ever executed successfully end-to-end** — only its graceful no-key fallback has been exercised. This is the single most important thing to verify first once a production Anthropic key exists.

## Security findings from this build

- No secrets are committed (`app/.env` confirmed git-ignored, checked with `git check-ignore`).
- `npm audit` reports 2 moderate-severity advisories in `qs` (a transitive dependency of `express`), with no fix currently available upstream — low real-world risk at this scale (no untrusted multipart/query parsing of the vulnerable shape is in use), but worth tracking for an `express` upgrade later.
- Row Level Security is real and enforced at the database layer for every tenant-scoped table (10 tables, `0001_init.sql` + `0005_analytics_rls.sql`), not just applied in application code — verified by the two-connection-pool design (`servicePool` bypasses RLS as the table owner; `appPool` is a separate, lower-privilege role that cannot).
- Stripe webhook handling correctly requires signature verification (`STRIPE_WEBHOOK_SECRET`) before touching the credit ledger — untested live (no Stripe account) but structurally correct against the current SDK.
- The Extraction/Verification prompts (`src/extraction/prompts.ts`) explicitly instruct the model to treat ingested notice text as data, never instructions — mitigating prompt injection from a malicious or compromised source notice, per `docs/security/00-security-architecture.md`. Not exercised live (no API key), so this is a design-time control, not yet a tested one.

## Path to production (what changes, what doesn't)

Swapping the local Postgres for a real Supabase project requires no schema changes — every migration in `app/src/db/migrations/` is plain, portable SQL (the only Supabase-specific step is provisioning `pgvector`, already anticipated and unused so far). Concretely: create a Supabase project, run the 5 migration files against it in order, point `DATABASE_URL`/`DATABASE_URL_APP` at it (service-role and a scoped role respectively), set `ANTHROPIC_API_KEY`, and re-run `npm run ingest:fts && npm run ingest:planning && npm run extract:run && npm run match:run` — at which point extraction runs on the real automated path instead of the manual-seed one, for the first time.

## Recommended next build phase

Not a bigger build — the validation experiment from `docs/EXECUTIVE_SUMMARY.md` §15 that this whole effort has been building toward: provision production infrastructure only after (or in parallel with) the 8–12 real operator conversations, so real Groundline usage data exists before more engineering investment. See the final report for the specific evidence to collect from those first conversations.
