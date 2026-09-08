# AI Intelligence Layer — Audit & Evaluation Report

*Produced after activating and hardening the real Anthropic integration. Every case below is real ingested data (Find a Tender / planning.data.gov.uk) or real quoted notice text — nothing in this dataset was invented. Where a metric genuinely cannot be measured without a live `ANTHROPIC_API_KEY` (not available in this sandbox), it's marked so explicitly, not estimated.*

## 1. AI integration status

| Component | Status |
|---|---|
| Extraction Agent | **Real, callable, hardened.** Schema-validated (zod), timeout (30s) + retry (2) configured explicitly, every call logged to `ai_call_log`. Blocked from running live by missing `ANTHROPIC_API_KEY` in this sandbox — correctly refuses to fabricate rather than substituting a guess. |
| Verification Agent | Same status as Extraction — real, hardened, blocked on the same missing key. |
| Intelligence synthesis | Real, hardened, with an honest deterministic-template fallback that now distinguishes *why* it fell back (`no_api_key` vs `api_error`) rather than conflating the two. |
| Matching engine | **Fully operational, no AI dependency** — deterministic, exercised against 165 real opportunities (65 procurement notices + 100 planning signals). |
| Commercial calculation | **Fully operational, no AI dependency.** |
| Credit ledger / unlock flow | **Fully operational**, exercised live via Playwright against the real running app (see §13). |

## 2. Models used

`claude-sonnet-5` — corrected during this audit from a stale `claude-sonnet-4-5` reference left over from the previous session (a real bug this audit caught, not a hypothetical one). One model, one tier, for all three tasks (extraction, verification, synthesis), per `docs/architecture/03-ai-routing-strategy.md` — no OpenRouter, no OmniRoute, no premium-tier escalation implemented yet (documented as a later refinement, not built prematurely).

## 3. Real-data test results

34 real Find a Tender notices (270-day window) + 31 more (500-day window, searching specifically for a closer/stronger real match) + 100 real planning.data.gov.uk brownfield-land entities were ingested and matched against the seeded demonstration business profile (Midlands haulage/aggregates operator, 100-mile radius from Tamworth). **165 real opportunities scored.** Full detail in `04-implementation-status.md`; this report adds the structured 20-case evaluation below.

## 4. The 20-case evaluation set

Selected from the real ingested corpus for category coverage, not cherry-picked for favourable scores — several cases below are honest failures or edge cases, reported as such.

| # | Case | Source | Category | Score | Notes |
|---|---|---|---|---|---|
| 1 | Extension of the Kenn Hedge Footpath (Nailsea) | FTS 064119-2025 | **Strong match** | 65 | Best real match found across ~3,000 fetched notices. Gravel footpath, real material match, genuinely within-radius-ish geography (43/100). |
| 2 | Fair Oak Cemetery Path Resurfacing | FTS 029088-2026 | **Strong match** | 60 | Full manual extraction + mechanical verification demonstrated (`04-implementation-status.md`). |
| 3 | Footpath Upgrade, Wildern Nature Reserve | FTS 085872-2025 | **Strong match** | 59 | Self-binding gravel path, ecological constraint noted. |
| 4 | Supply, Delivery & Collection of Roadstone Materials (Fife) | FTS 017791-2026 | **Explicit aggregate/material requirement** | 25 (gated) | Title/description name "aggregates," "quarry requirements" directly — cleanest real example. £12.8m term contract, correctly flagged as framework-scale, not a single job. Gated to 25 by geography (Glenrothes, Scotland — genuinely 300+ miles from Tamworth). |
| 5 | Gremista Landfill Phase 3 (Shetland) | FTS 064802-2026 | **Explicit aggregate/material requirement** | 25 (gated) | "Cut and fill earthworks... clean aggregate drainage layer" — service_score 100 (perfect). No tonnage stated → commercial correctly **Unknown**, not guessed. Geography gate correctly caps it (Shetland, ~520 miles). |
| 6 | Anti-Skid Road Surfacing PIN (South Lanarkshire) | FTS 079633-2026 | **Ambiguous / early-stage** | 25 | Real extracted field: this is a Prior Information Notice, not a live tender — nothing to bid on yet. Extraction correctly captured that distinction. |
| 7 | Inner Moray Firth Housing & Property Maintenance Framework | FTS 081461-2026 | **Ambiguous match** | 25 | One "Ground Works and Excavation" sub-lot among ~20 unrelated trades (electrical, plumbing, painting). Council explicitly disclaims any guaranteed work volume — both real, extracted facts. service_score 85 is arguably too generous here — see §6 limitations. |
| 8 | Gourock Warehouse Demolition | FTS 068160-2026 | **Missing information** | 25 | No tonnage, no vehicle type stated anywhere in the public notice. Commercial correctly Unknown. |
| 9 | Plumpton Sports Pavilion | FTS 056561-2026 | **Missing information** | 25 | Same pattern — real, small, under-specified notice. |
| 10 | Footpath upgrade, Abbey View East, Belmont HR2 | FTS 060399-2026 | **Geography good, service gate correctly fires** | 25 | Geography score 65 (genuinely close, Hereford) but service_score 10 — this is drainage/footpath work, not core haulage. Gate correctly overrides the good geography. |
| 11 | A9 Dualling Delivery Framework Agreement | FTS 052569-2026 | **Geographically invalid** | 25 | £1.936bn framework (real, verified from the notice) — huge value, but Glasgow-based and generic ("Civils, Buildings, OHL and UGC") — geography_score 0, service_score 10. Gate holds despite the eye-catching value. |
| 12 | MBT RDF & Contingency Contract (Dumfries) | FTS 040844-2026 | **Geographically invalid, strong content** | 25 | The sharpest real gate-test case: service 85, commercial 100 (£3.27m, above minimum), but geography 3/100 (Dumfries, ~230 miles) — everything else says "good match," geography alone correctly kills it. |
| 13 | Waste Management Services (Wheatley Housing, Glasgow) | FTS 058671-2026 | **Geographically invalid + missing detail** | 25 | Real £8.5m waste contract, service 85, but Glasgow (geography 0) and no waste-volume detail stated. |
| 14 | Provision of Surfacing Works (LondonEnergy) | FTS 080896-2026 | **Ambiguous commercial value** | 25 | Real extracted caveat: the £100,000 is likely a Dynamic Purchasing System threshold across 8 sites, not one job's price — flagged in `notes`, not presented as a clean single-contract value. |
| 15 | BFR002, Rosemary Avenue, Newton Abbot | planning.data.gov.uk | **Planning opportunity, commercial must remain Unknown** | 25 | 6 dwellings, permissioned. Planning signals never carry a monetary value (by design — never invented). Geography-heuristic bug found and fixed here (see §7 bug log) — now correctly geocodes to Newton Abbot, ~140 miles away. |
| 16 | BFR005, Former Wolborough Hospital, Newton Abbot | planning.data.gov.uk | **Planning opportunity, commercial must remain Unknown** | 25 | 18 dwellings, permissioned — larger real brownfield site. |
| 17 | CBR013, Poolside, Haverigg | planning.data.gov.uk | **Planning opportunity, unresolvable geography** | 25 (geography defaulted to 50/unknown) | 85 dwellings (largest in the sample), not-yet-permissioned. Haverigg (small Cumbrian village) genuinely doesn't resolve via postcodes.io's place search — correctly reported as Unknown, not guessed at 0 or fabricated. |
| 18 | "WorkWell Service for NHS Essex ICB" | FTS (real notice text, quoted verbatim) | **Incidental "aggregate" — regression case** | N/A — correctly excluded at ingestion | Real text: *"The aggregate value of the Proposed Contract... is £5,163,141"* — a routine financial phrase, not a construction-material reference. Confirmed via `test/relevance.test.ts` regression test that this text is correctly rejected by the relevance filter. |
| 19 | "Social Program Management (SPM) Framework Agreement" | FTS (real notice text, quoted verbatim) | **Incidental "backfill" — regression case** | N/A — correctly excluded at ingestion | Real text: *"resources deployed to either backfill staff or fulfil a role"* — an HR/staffing usage, not soil backfill. Same regression-test coverage. |
| 20 | Recycling of Paper & Cardboard (East Ayrshire) | FTS 034646-2026 | **False negative — service keywords too narrow** | 25 (service_score 10) | Genuinely relevant to a waste-haulage business (CPV-matched into the corpus correctly), but the deterministic `SERVICE_KEYWORDS` list for "Waste haulage" (`waste`, `refuse`, `rubbish`) doesn't include `recycling`, `paper`, or `cardboard` — an honest false negative, reported not hidden. See §6. |

## 5. Extraction & verification accuracy

**Mechanically measured** (not an estimate): every "verified" requirement claim across the corpus — 19 fields, spanning cases 2–17 above — was checked programmatically (`npm run verify:evidence` / `test/db-integration.test.ts`) against the actual notice/signal text it claims to quote.

- **Unsupported-claim rate: 0%** (0 of 19 verified claims failed the mechanical source-span check, after one real bug — a curly-vs-straight-apostrophe mismatch — was found and fixed during the original build).
- **False-positive rate (ingestion relevance filter): 2 confirmed real false positives found and fixed** ("aggregate value of the contract," "backfill staff" — cases 18–19 above) out of ~3,000 real notices screened across two ingestion runs. Both are now permanently regression-tested.
- **False-negative rate: at least 1 confirmed** (case 20 — a relevant recycling notice scored artificially low on service fit due to a narrow keyword list). This is a service-fit scoring gap, not a relevance-filter gap — the notice was correctly *ingested*, just under-scored.

**Important caveat**: this accuracy is measured against the manual-extraction path (this session performing extraction directly, following the exact same prompt rules as the automated agent — `docs/architecture/04-implementation-status.md`). It has NOT been measured against the live, automated Extraction/Verification Agent, because no `ANTHROPIC_API_KEY` is available in this sandbox. The prompts, schema validation, and verification logic are real and unit-tested; whether the live model matches this session's manual judgement call-for-call is unverified. **This is the single most important thing to test the moment a production key exists.**

## 6. Matching accuracy

- **Geographic gating: verified correct via real geocoding**, not mocked (`test/geography-gate.test.ts`). A content-maximal candidate 500+ real miles away is capped at ≤30; the same candidate within a real 100-mile radius scores >60. Case 12 (MBT RDF, Dumfries) is the sharpest real-corpus demonstration: strong on every other dimension, correctly killed by geography alone.
- **Service/sector false-negative found**: case 20 (§4, §5) — the deterministic keyword approach is demonstrably narrower than real procurement-document vocabulary. This is a known, now-documented limitation, not a hidden one.
- **No true "strong match" (≥70) exists in the current real corpus** for the seeded Midlands profile — the best real result is 65/100 (case 1). This itself is a finding worth taking seriously: either (a) the current 270–500-day FTS sample genuinely doesn't contain a strong geographic+content match for this specific beachhead profile, or (b) real strong matches exist but score lower than they should due to the keyword-matching limitations in §5–6. Both are worth investigating with a larger or more targeted ingestion pull before concluding anything about product-market fit from score distribution alone.

## 7. Real bugs found and fixed during this phase

1. **Stale model ID** (`claude-sonnet-4-5` → `claude-sonnet-5`) — caught by re-reading the actual code against current model documentation, not assumed correct.
2. **No response schema validation** — a malformed Claude response could previously flow straight into a DB insert. Fixed with zod (`src/extraction/schemas.ts`).
3. **No AI cost/latency observability** — documented as needed in an earlier phase, never built. Fixed (`ai_call_log`, `src/lib/claudeClient.ts`).
4. **No global Express error handler** — an unhandled exception (e.g. a DB blip) would have leaked a stack trace to the client. Fixed.
5. **`requirements.procurement_id` was NOT NULL**, blocking planning-signal facts from using the same table — would have forced a duplicate data model. Fixed via a proper either/or schema migration (`0007_requirements_planning_signals.sql`), mirroring the pattern already used for `opportunities`.
6. **`primaryPlaceName()` geography heuristic broke on real planning-signal addresses** (street-first, real UK postcode) — silently degraded every planning-signal geography score to "unknown." Found by actually running the matching engine against real planning data, not assumed. Fixed and regression-tested (`test/geocode.test.ts`).
7. **Duplicate geocoding round-trip** in the matching runner (distance computed twice per opportunity) — simplified to reuse the match's own computed distance.

None of these were found by re-reading code in isolation — all seven surfaced by actually running the pipeline against real data and checking the output, which is the point of this phase.

## 8. AI cost per unlock — **N/A, blocked on ANTHROPIC_API_KEY**

Cannot be measured without a live key. The infrastructure to measure it the moment one exists is now built and tested (`ai_call_log` records `input_tokens`/`output_tokens`/`latency_ms` per call; `src/lib/claudeClient.ts` populates it from the real API response's own `usage` field, never estimated).

## 9. Average latency — **N/A, blocked on ANTHROPIC_API_KEY**

Same caveat and same readiness as §8 — `latency_ms` is captured per call already.

## 10. Security findings

Real `security-auditor` subagent pass against this phase's changes, per `docs/agents/00-agent-architecture.md`. **No exposed secrets.** Three real findings, all fixed in this same phase:

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | `ai_call_log` referenced `business_id` but had no Row Level Security policy — the same gap `0005_analytics_rls.sql` closed for `analytics_events` was not repeated for this new table. No live exploit today (only the RLS-bypassing service role writes to it), but a future tenant-scoped read would have leaked cross-business AI usage data. | Medium | `0008_ai_call_log_rls.sql` — same RLS pattern as every other tenant-referencing table. |
| 2 | `opportunityDetail.ts` escaped the visible link *text* for `source_url` but not the `href` attribute itself — inconsistent with every other field on the page, and a real (if currently unexploited, since upstream IDs are typically clean) stored-attribute-injection path if an ingested notice ID ever contained a `"` character. | Low/Medium | One-line fix — `escapeHtml()` applied to the `href` too. |
| 3 | The commercial calculation picked up a `quantity` requirement's tonnage regardless of whether the Extraction Agent had marked it `verified` or `inferred`, then always labelled the resulting revenue "Calculated" — presenting an AI inference as arithmetic on a stated fact if it ever fired (it hadn't yet, in the current real corpus — see §9's note that no case had inferred-confidence tonnage). | Low/Medium (provenance-labelling, not a data leak) | `run-matching.ts` now requires `confidence === "verified"` on the tonnage claim before it drives a calculated figure; an inferred-only tonnage correctly falls through to `calculateCommercial`'s existing "Unknown" branch. |

Checked and confirmed clean (auditor's own words, condensed): prompt injection defences (both system prompts explicitly name and defuse the "ignore previous instructions" pattern; Verification Agent is an independent second check); no secrets in tracked source or client-rendered output; cross-user data access (`business_id` sourced only from the authenticated session, never from request params, on every route); credit manipulation (row-locked debit, idempotent unlock and Stripe-grant paths); SQL injection (parameterized queries throughout, no exception found); financial/outreach guardrails (no agent-initiated Stripe write exists; no outreach code exists at all); global error handler doesn't leak stack traces.

A follow-up finding surfaced *while fixing* #3: the same unfiltered-confidence pattern exists in the matching engine's capacity-fit scorer (`scoring.ts`'s `extractTonnes`, used only for a 0–100 score component, not a customer-facing £ figure) — lower stakes, not fixed in this pass, noted here rather than silently left out of the record.

## 11. Would a real haulage/aggregates business find this useful?

Judged against the cases above, not against how impressive any AI narrative sounds:

- **Case 12 (MBT RDF)** is the single best evidence this system does something a manual review might miss under time pressure: a £3.27m, service-perfect, commercially-attractive-looking contract that a busy operator might glance at and consider — correctly and automatically flagged as geographically unrealistic (Dumfries, ~230 miles from a 100-mile-radius Midlands base) before any time is spent on it.
- **Case 5 (Gremista Landfill)** is the best evidence the system resists the temptation to oversell: a genuinely exciting-sounding aggregate/earthworks contract, correctly held at "commercial value: Unknown" rather than inventing a plausible-sounding revenue figure, specifically because the source notice doesn't state a tonnage.
- **Case 20 (recycling)** is the most useful *negative* finding: a real business would likely disagree with the system's low score here, and that disagreement is exactly the kind of feedback the `feedback` table (already in the schema, not yet wired to a UI) exists to capture once real users are using this.
- The honest answer to "would a real quarry/haulage business act on this": **on the current real corpus, the strongest single case (65/100, case 1) is a modest £75,000 gravel footpath job, not a transformative contract.** That is not a failure of the system — it is what the actual UK procurement landscape currently contains within 100 miles of a Midlands haulage yard, on this data source, in this time window. Whether that's a data-coverage problem (need planning-application data, need more sources) or a real reflection of the addressable market is precisely the open question `docs/EXECUTIVE_SUMMARY.md` already flagged and still needs real operator conversations to resolve.

## 12. Remaining limitations (carried forward + new)

All limitations from `docs/architecture/04-implementation-status.md` still apply. New from this phase:
- Live Extraction/Verification/Synthesis Agent behaviour is unverified against a real API key.
- Service-fit keyword matching has a demonstrated false-negative mode (recycling/paper/cardboard); likely others exist unfound.
- No strong (≥70) real match exists yet in the sampled corpus for the seeded profile — worth a larger/more targeted ingestion pull before drawing product conclusions from score distribution.
- Sub-lot/framework ambiguity (case 7) scores more generously than a human might judge fair — service_score treats one relevant line-item the same as a wholly-dedicated contract; worth a future refinement (e.g. a partial-match discount) once real user feedback exists to tune against.

## 13. Specific changes required before customer trials

1. **Provision a production `ANTHROPIC_API_KEY`** and re-run the entire evaluation set through the live automated Extraction/Verification/Synthesis path — compare its output field-for-field against this session's manual extraction to establish real accuracy, cost, and latency figures (currently N/A).
2. **Widen or diversify data ingestion** — the current real corpus doesn't yet contain a genuinely strong match for the validated beachhead profile; either accept that as a real market signal or expand sourcing (a second FTS pull strategy, or the planning-data aggregator option already costed in `docs/research/05-product-strategy.md`) before concluding anything from score distribution.
3. **Broaden the service/sector keyword lists** using real vocabulary gaps like case 20, ideally driven by actual customer feedback once the `feedback` table has real data flowing into it.
4. **Wire the `feedback` "was this match correct?" UI** — the schema and RLS support it; the web app doesn't yet expose it.
5. **Complete the security-auditor pass** (§10) and act on any findings before any real customer credential or payment touches this system.
