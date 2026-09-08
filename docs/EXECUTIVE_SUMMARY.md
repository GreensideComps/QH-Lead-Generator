# Executive Recommendation — AI Commercial Opportunity Intelligence Platform

*Phase 1–5 complete (research, product strategy, system design, UX design). This document is the Phase 6 stop point: a Go/No-Go decision for review before any building begins, per the brief's own instruction not to let Claude proceed straight to a build.*

Full supporting research is in `docs/research/01` through `07`. Nothing below is asserted without a source in those documents.

## 1. Is this business worth pursuing?

**MODIFY.** Not a clean yes (the full vision as written is not buildable or fundable as an MVP) and not a no (a real, evidenced, narrower version of it is worth testing). Proceed with a deliberately narrowed beachhead and a validation step before committing to a production build.

## 2. Why?

The core insight — that existing tools match by sector/CPV code, not by physical fleet capability — is real and confirmed by research; no competitor found does true fleet/capability matching. But three things the original brief treats as natural extensions are not: planning data (the earliest, most valuable signal) is confirmed fragmented at only 73/311 UK local authorities on the official platform; award→downstream-supply-chain inference has zero data to verify against, making it the highest hallucination-risk feature in the brief; and willingness-to-pay in this specific niche is completely unvalidated — no evidence any haulage/aggregates/quarrying SME currently pays for commercial intelligence (as opposed to operational software, which they clearly do pay for). See `05-product-strategy.md`.

## 3. Closest competitors

- **PSIP / BidSkim** — public-tender-only AI relevance scoring against a stored profile; the closest *mechanic* to what's proposed, but no planning data, no fleet-level matching, saturated sub-market.
- **Glenigan / Barbour ABI** (Hubexo/Byggfakta) — the incumbent planning/project-leads platforms; comprehensive, researcher-verified, but generic and enterprise-priced (£5k–10k/yr).
- **TipperLink** — the closest haulage-specific *product*, but reactive/transactional (a load marketplace), not predictive — sits downstream of, and is complementary to, what's proposed.
- **SiteLens** — a useful pricing/GTM comparator: proof that cheap, self-serve, AI-classified planning-data products can undercut Glenigan/Barbour ABI successfully.

Full detail and evidence: `01-market-research.md`.

## 4. What do they do better?

Glenigan/Barbour ABI have data depth this product cannot match at MVP (160 human researchers, a decade of relationships) — their moat is verification effort, not just data access. PSIP/BidSkim are live, already have paying customers, and have complete public-procurement coverage today. TipperLink has a real, working transactional network of hauliers already using it. None of this is a reason not to proceed — it's a reason not to compete head-on with any of them on their own ground.

## 5. Where is the market gap?

Fleet/capability-specific matching for haulage/aggregates/quarrying/muck-away, combined with a provenance-first trust model, positioned upstream of TipperLink-style transactional tools. See `01-market-research.md` §4 for the full structural argument and its countervailing risks (incumbents could add this as a feature; the niche is narrow and currently contracting).

## 6. What data can we actually access?

**Tier 1 (strong, MVP-ready today):** Find a Tender Service / OCDS API (procurement notices, OGL-licensed, bulk + API), Companies House API (company data, OGL-licensed, explicit commercial-use confirmation, REST + streaming + bulk snapshots).

## 7. What data is difficult?

**Planning applications** — official national coverage is only 73/311 LPAs; full UK coverage requires either building scrapers against 5+ incompatible council portal systems or licensing a paid commercial aggregator (Searchland, PlanNexus, LandHawk). **Local authority capital programmes/committee papers** — genuinely unstructured PDFs, no aggregator exists. **Award→supply-chain inference** — no data source exists at all; this would be pure AI speculation. Full detail: `02-data-sources.md`.

## 8. What can Claude reliably do?

Extract structured fields (tonnes, vehicle type, duration, location, deadline, value) from unstructured notice text, each tagged with a source span and confidence; independently re-verify extracted claims against source text to catch unsupported assertions; produce natural-language explanations of why a match scored the way it did. Full design: `06-system-design.md`.

## 9. What should deterministic software do?

Matching/scoring (six weighted dimensions), all commercial calculations (loads, revenue, cost, margin), geography/distance, deduplication, filtering, and every business rule and threshold. No LLM call should ever be in the critical path of a number the customer relies on financially. Full design: `06-system-design.md`.

## 10. What should the MVP include?

Business profile (customer-entered, not inferred) → Tier 1 data ingestion (FTS + Companies House) → AI extraction with source-span confidence → deterministic matching engine → deterministic commercial calculation engine using customer-supplied rates only → opportunity dashboard with full evidence/provenance trail and status/feedback tracking. Full scope: `05-product-strategy.md`.

## 11. What should NOT be built yet?

Planning-signal ingestion (defer to a costed decision once the procurement-only loop is validated), award→downstream-supply-chain inference (defer until the trust model is proven on verifiable claims), autonomous outreach/contact scraping (legally gated per `03-legal-compliance.md`), an 8-agent AI architecture (2 agents — Extraction, Verification — are justified at MVP; the rest is deterministic code), billing, multi-seat accounts, CRM integrations, Shopify (research does not support it for this product shape).

## 12. Recommended architecture

Supabase (Postgres + pgvector + Auth + Row Level Security) as the primary backend; Claude's own model tiers (cheap→mid→premium) rather than OpenRouter for cost-controlled AI orchestration; Stripe Billing (not Shopify) for eventual subscriptions — Shopify's billing model is commerce/checkout-shaped and does not fit a seat/tier-based B2B data product; Playwright (official Microsoft MCP + CLI + its built-in AI test agents) for browser research and eventual E2E testing. Full detail and reasoning: `04-technical-architecture.md`.

## 13. Recommended pricing hypothesis

Flat monthly subscription, tiered by fleet size/business-profile count — not credits or per-opportunity pricing, which would contradict the "precision over volume" positioning. Illustrative tiers: Starter ~£99–149/mo, Professional ~£299–399/mo (core target — the 20–40 vehicle operator), Business ~£699–999/mo. **These are a hypothesis to validate against real target customers, not a committed price list** — no external benchmark exists for this exact niche. Full detail: `05-product-strategy.md`.

## 14. Biggest risks

1. Unvalidated willingness-to-pay — the single largest risk.
2. Planning-data dependency for the highest-value (earliest-stage) signal — deliberately excluded from MVP, which weakens the full "commercial radar" pitch until a paid aggregator is licensed.
3. Hallucination/trust risk if provenance discipline isn't enforced rigorously — product-killing in a professional B2B context.
4. Narrow, currently-contracting market (aggregates demand at a 12-year low).
5. Incumbent feature-add risk — Glenigan/Barbour ABI could add fleet-capability filtering faster than this product can build a data moat.

## 15. Validation experiment

Two parts, run together, not sequentially:

**A. Technical/data validation** — Ingest 100–500 real, live UK opportunities from FTS/OCDS (supplement with Companies House enrichment). Build one realistic customer profile matching the brief's own example (20–30 vehicle Midlands haulage/aggregate/muck-away operator). Run the matching + commercial engines against it. Manually evaluate:
- **Precision** — of the opportunities the system surfaces, how many would a real operator actually consider relevant?
- **Recall** — of the genuinely relevant opportunities in the sample, how many did the system surface?
- **Commercial hit rate** — how many surfaced opportunities would a real operator actually pursue (not just find plausible)?
- **Estimated-value accuracy** — how close are calculated estimates to what an experienced operator would independently estimate?
- **False-positive rate** — how many surfaced opportunities are clearly wrong on inspection?

**B. Commercial validation (the part the original brief under-weights)** — Before any production build investment, run 8–12 direct discovery conversations with real UK haulage/aggregates/muck-away/quarrying operators matching the target profile. Test directly: do they currently pay for anything like this; what would they pay; would they act on a "94% fit, £150k–£240k opportunity" card if shown one; what would make them trust or distrust it. This is not optional given that no existing evidence of willingness-to-pay in this niche was found anywhere in the market research.

## 16. Success criteria

- **Technical success**: the system reliably ingests FTS/Companies House data, extracts requirements with source-span provenance, matches against a real business profile, and explains every score component — verified against the 100–500-opportunity test set.
- **Product success**: at least 3 of the 8–12 interviewed operators say, unprompted, some version of "I would actually use this."
- **Commercial success**: at least 2 of those operators name a specific monthly price they'd pay that's within range of the Professional-tier hypothesis (~£299–399/mo).
- **Strong validation**: at least one surfaced opportunity from the 100–500-item test set leads a real interviewed operator to say they would make contact, request a quote, or seriously consider bidding — i.e. the output changes a real commercial decision, not just "this looks plausible."

## 17. Go / No-Go recommendation

**Conditional GO — on the prototype and validation step only, not yet on a funded production build.**

Build the interactive Artifact prototype next (with clearly-labelled demonstration data, following the UX spec in `07-ux-design.md` and the data/scoring model in `06-system-design.md`), and in parallel run the validation experiment above (real ingested data against a realistic profile, plus real operator conversations). Use those two things together — not enthusiasm for the idea — to decide whether to invest in the full production build (Supabase, Claude API in production, ingestion workers, billing). If the validation experiment doesn't clear the success criteria above, the right move is to revisit the customer segment or the product shape, not to keep building on the current assumptions.

---

**This is the point the brief itself says to stop at.** No Artifact has been built yet and no credentialed infrastructure (Supabase project, Stripe account, production Claude API usage) has been provisioned. See `docs/ENVIRONMENT_SETUP.md` for the separate environment-setup findings. Both are ready to proceed on your explicit go-ahead.
