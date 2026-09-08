# Phase 3 — System Design

Scoped to the MVP defined in `05-product-strategy.md`: procurement (FTS/OCDS) + Companies House ingestion, deterministic matching and commercial calculation, AI used only for extraction and verification.

## Architecture overview

```
   FTS (OCDS API)          Companies House API
        |                          |
        v                          v
   +----------------- Ingestion workers -----------------+
   |   (scheduled, deterministic: fetch, dedupe, store)   |
   +-------------------------+-----------------------------+
                              |
                              v
                 +---------------------------+
                 |   Extraction Agent (AI)    |  <- reads notice text,
                 |   Claude, per-field        |     pulls tonnes/vehicles/
                 |   confidence + source span |     duration/location/deadline/
                 +-------------+--------------+     value ONLY where stated
                              |
                              v
                 +---------------------------+
                 | Verification Agent (AI)    |  <- checks extracted claims
                 |   against source text,     |     against source span,
                 |   flags unsupported claims |     rejects/downgrades unsupported
                 +-------------+--------------+
                              |
                              v
                    Postgres (Supabase)
              Procurement / Company / Requirement /
                  Evidence tables (see data model)
                              |
              +---------------+----------------+
              |                                |
              v                                v
   +-------------------+           +--------------------------+
   | Matching engine    |           | Commercial calc engine    |
   | (deterministic     |           | (deterministic, uses      |
   |  code, scoring      |           |  customer-supplied rates  |
   |  weights below)     |           |  only — never invented)   |
   +---------+-----------+           +-------------+--------------+
             |                                     |
             +------------------+------------------+
                                |
                                v
                       Opportunity record
                    (score + commercial estimate
                     + evidence + confidence labels)
                                |
                                v
                     Dashboard (customer-facing)
```

**Why this shape**: deterministic code owns math, filtering, scoring, and business rules (per the brief's own Section 13 principle); AI owns extraction, classification, and natural-language interpretation only. The matching and commercial engines never call an LLM — they're pure functions over structured data, which makes them testable, auditable, and cheap to run at volume.

## AI agent design — how many agents are actually justified

The brief sketches 7 potential agents (Data Analyst, Opportunity Analyst, Requirements Analyst, Business Matcher, Commercial Analyst, Research Agent, QA Agent). **Research does not support building all 7 for the MVP.** Justification, one by one:

| Brief's proposed agent | MVP decision | Why |
|---|---|---|
| Requirements/Data Analyst (extraction) | **Build — Extraction Agent** | Genuinely needs an LLM: unstructured notice text → structured fields (tonnes, vehicles, duration, location, deadline, value), each tagged with a source span and a confidence label. This is the core "AI understands the signal" capability the brief's success criteria depend on. |
| Quality Control / QA Agent | **Build — Verification Agent** | Directly implements the brief's Section 7/23 source-of-truth rule: re-checks each extracted claim against the source text, downgrades or rejects anything unsupported. This is not optional — it's the mechanism that prevents hallucinated facts reaching the customer, which the brief calls "a critical product requirement." Worth a dedicated pass rather than folding into extraction, because self-checking in the same call that generated the claim is a weaker check than an independent second pass. |
| Business Matcher | **Not an agent — deterministic code** | Comparing structured requirements against a structured business profile is arithmetic and rule evaluation, not language understanding. An LLM here adds cost, latency, and non-determinism to something that must be explainable and reproducible (the brief explicitly requires the customer to "understand why a match received its score"). |
| Commercial Analyst | **Not an agent — deterministic code** | Loads, revenue, cost, margin are formulas over customer-supplied rates. Using an LLM for arithmetic risks silent calculation errors dressed up as confident prose — exactly the "estimates presented as facts" failure mode the brief prohibits. |
| Opportunity Analyst ("does this event create an opportunity") | **Folded into Extraction Agent** | A separate agent judging "opportunity or not" duplicates the extraction step's job at MVP scale (Tier 1 sources are already opportunity-shaped — live tenders and company records). Worth splitting out later if the funnel widens to noisier, less-obviously-relevant sources (e.g. news announcements, planning applications) where a genuine relevance triage step earns its keep. |
| Research Agent (developer/contractor/buyer lookups) | **Deferred, not MVP** | Companies House enrichment for the MVP's Tier 1 sources is a structured API call, not a research task. A genuine research agent (chasing down a developer's website, a contractor's news mentions) is a real fast-follow feature once the core loop is proven, not an MVP requirement. |

**MVP agent count: 2** (Extraction, Verification) — both Claude, both stateless per-document calls, both able to run on a cheaper model tier for routine notices and escalate to a stronger tier only for ambiguous/high-value cases (see cost control below). This directly follows the brief's own instruction not to add agents because it sounds impressive, and its instruction to use deterministic software wherever deterministic software can do the job better.

## Model cost control (routing, not OpenRouter — see `04-technical-architecture.md`)

```
  All new FTS/Companies House records
              |
              v
     Cheap-tier model: cheap triage
     (is this notice even in-scope for
      any active customer sector/CPV?)
              |
              v (in-scope only)
     Mid-tier model: Extraction Agent
     (structured field extraction,
      confidence + source span per field)
              |
              v
     Mid-tier model: Verification Agent
     (re-check claims against source text)
              |
              v (only if Verification flags
                 ambiguity, or opportunity
                 value is high)
     Premium-tier model: escalation pass
              |
              v
        Opportunity record
```

Track per-call: model, task, tokens, cost, latency, confidence, and whether escalation occurred — a small `ai_call_log` table, not a separate service, is sufficient at MVP scale.

## Matching & scoring methodology

The brief proposes illustrative weights (Service 25% / Fleet 20% / Geography 20% / Capacity 15% / Timing 10% / Commercial 10%) but explicitly says not to assume they're correct, and no external research source validates a "correct" weighting for this exact niche — none exists, because no competitor does capability-based fleet matching (`01-market-research.md`). **Recommendation: treat the weights as configurable parameters, not hardcoded constants, and set an initial hypothesis rather than a researched fact:**

| Dimension | Initial weight (hypothesis, tune from real feedback) | What it measures | Data required |
|---|---|---|---|
| Service fit | 25% | Can the business perform the required service at all (binary/near-binary gate — a haulier can't bid a demolition contract) | Customer services list vs. extracted service/CPV type |
| Fleet fit | 20% | Does vehicle/plant type match what's needed | Customer fleet list vs. extracted vehicle/material requirement |
| Geography fit | 20% | Is the opportunity within the customer's economical radius | Customer operating area/radius vs. opportunity location (deterministic distance calculation, never AI) |
| Capacity fit | 15% | Can the customer realistically service the volume given current available capacity | Customer capacity input vs. extracted volume/duration |
| Commercial fit | 10% | Is the opportunity large enough to be worth pursuing (vs. the customer's stated minimum) | Customer minimum value vs. calculated/extracted value |
| Sector/strategic fit | 10% | Is it in a preferred sector | Customer preferred sectors vs. opportunity sector |

Service and Geography should function partly as **gates, not just weighted inputs** — an opportunity 300 miles outside a 100-mile radius, or requiring a service the customer doesn't offer, should not merely score low, it should be filtered out entirely by default (this is what "precision over volume" requires in practice). Timing fit is deliberately dropped from the MVP weighting: at Tier-1-data scale, "does the customer have capacity during the required period" isn't reliably knowable without a live capacity calendar the customer maintains, which is a v2 feature, not MVP.

**Every score must show its component breakdown in the UI** — not just a single "94% fit" number — per the brief's requirement that the customer understand why a match scored the way it did.

## Provenance architecture

Every fact the product surfaces carries one of five labels, enforced at the data-model level (not just a UI convention):

| Label | Meaning | Example |
|---|---|---|
| **Verified** | Directly stated in a cited source, with a source URL and (where practical) the exact source span | "Contract value: £340,000" — from the FTS notice's value field |
| **Calculated** | Deterministically computed from verified inputs | "Estimated 480 loads" — from verified tonnage ÷ customer-supplied payload |
| **Customer-specific** | Provided by the customer, not derived from public data | "25 available vehicles" — from the business profile |
| **Estimated/Inferred** | AI-derived from indirect evidence, not directly stated | "Likely requires tipper haulage" — inferred from project type where not explicit |
| **Unknown** | Insufficient information | Deadline not stated in the source notice |

The `Evidence` table (see data model below) is the mechanism, not a UI nicety: every `Opportunity` field that isn't raw customer input must resolve to at least one `Evidence` row carrying its label and source. The Verification Agent's job is specifically to catch cases where extraction has produced a claim with no defensible Evidence row, and downgrade it before it reaches the customer.

## Data model

```
Business
  id, name, services[], fleet[] (vehicle_type, count),
  operating_geography, operating_radius_miles,
  capacity_available, min_opportunity_value,
  preferred_sectors[], commercial_rates (payload, price_per_tonne,
  price_per_load, price_per_mile, fuel_cost, driver_cost,
  min_margin), created_at

Procurement  (raw ingested notice, Tier 1 source)
  id, source ('fts' | 'contracts_finder'), external_id,
  title, description, buyer_name, buyer_id -> Company,
  value_low, value_high, location, deadline, published_date,
  contract_period, cpv_codes[], source_url, raw_payload, ingested_at

Company  (from Companies House)
  id, company_number, name, sector, registered_address,
  status, source_url, last_synced_at

Requirement  (Extraction Agent output, one row per extracted field)
  id, procurement_id -> Procurement, field_name
  ('tonnes' | 'vehicle_type' | 'duration' | 'location' | 'deadline' | 'value' | ...),
  value, confidence ('verified' | 'estimated' | 'inferred' | 'unknown'),
  source_span, extracted_by_model, extracted_at

Opportunity
  id, business_id -> Business, procurement_id -> Procurement,
  status ('new' | 'interested' | 'contacted' | 'won' | 'lost' | 'not_relevant'),
  total_score, recommendation_text, created_at

Match  (score breakdown, one row per opportunity)
  opportunity_id -> Opportunity, service_score, fleet_score,
  geography_score, capacity_score, commercial_score, sector_score,
  total_score, weights_used (json snapshot — weights are configurable,
  so the exact weights used must be stored per match, not assumed)

CommercialEstimate
  opportunity_id -> Opportunity, estimated_loads, estimated_vehicle_requirement,
  estimated_revenue, estimated_cost, estimated_contribution, estimated_margin,
  rate_inputs_used (json snapshot of the customer rates applied),
  calculation_basis ('customer_rate' — never 'assumed_industry_rate')

Evidence
  id, opportunity_id -> Opportunity, claim_field, claim_value,
  confidence_label ('verified' | 'calculated' | 'customer_specific' |
  'estimated' | 'inferred' | 'unknown'), source_type, source_url,
  source_span, created_at

Feedback
  opportunity_id -> Opportunity, business_id -> Business,
  match_was_correct (bool), notes, created_at
```

This is deliberately smaller than the brief's full entity list (Project, Contact, Framework, Contractor, Developer as separate first-class entities are dropped) because the MVP data sources don't populate those entities with real, sourced data yet — adding empty/speculative entities now would violate the brief's own "don't invent" principle at the schema level. `Company` covers what Companies House actually gives; a `Contact`/`Developer`/`Contractor` entity should be added when a real data source for it (the deferred Research Agent, or a licensed planning aggregator) is actually wired in.

## Security & scalability notes (brief, not exhaustive — this is not the build phase)

- **Row Level Security** in Supabase scopes every `Business`/`Opportunity`/`Match` row to its owning customer at the database layer, not just the application layer.
- Ingestion workers use a service-role key with write access only to `Procurement`/`Company`/`Requirement`; customer-facing API paths use RLS-scoped keys.
- No personal/named-individual data enters the MVP schema at all (Tier 1 sources are entity/company-level, not individual-level) — sidesteps the highest-risk GDPR questions in `03-legal-compliance.md` entirely for v1, by design.
- Scaling path: ingestion workers and the Extraction/Verification agents are the natural horizontal-scale points (stateless, queue-driven); the matching/commercial engines are cheap enough to run synchronously per new opportunity at MVP volumes (low thousands of notices/month from Tier 1 sources).
