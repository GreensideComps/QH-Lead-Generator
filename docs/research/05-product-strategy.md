# Phase 2 — Product Strategy

*This section explicitly challenges the original brief where the research doesn't support it. It does not exist to validate the idea as pitched.*

## What the research changes about the original brief

The original brief describes a very large end-state (a continuously-updated commercial graph spanning planning → funding → contractor → procurement → tender → award → supply-chain inference → match, across quarrying, aggregates, haulage, tipper, muck-away, waste, plant, and "adjacent construction supply-chain businesses"). Three research findings mean that vision needs to be narrowed, not built as specified:

1. **Planning data — the earliest and arguably most valuable signal in the chain — is the weakest data source available.** Only 73 of 311 UK local planning authorities publish through the national platform. Real UK-wide planning coverage requires either a from-scratch scraper build against 5+ incompatible council portal systems, or a paid commercial aggregator (Searchland, PlanNexus, LandHawk). This is not a "connect an API" task — it's either a significant engineering investment or a recurring data-licensing cost, before a single customer has validated they'll pay for the output. **The brief's implicit assumption that planning intelligence is a natural Phase-1-adjacent extension is not supported — it should be a deliberate, costed fast-follow decision, not an early milestone.**

2. **The "Stage 4 — Award → downstream supply-chain requirements" inference (a company wins a £5m contract → the AI infers haulage/tipper/driver/plant requirements) has no data source at all.** It is 100% AI inference with nothing to verify it against. This is exactly the kind of claim Section 7 of the brief (source-of-truth rule) warns against presenting as fact, and it's also the single riskiest thing to build first from a trust standpoint — a wrong inference here (inventing a haulage requirement that doesn't exist) is the fastest way to destroy customer trust in the whole product. **This belongs later, clearly labelled as speculative, once the verified-fact pipeline is proven — not in the MVP.**

3. **Willingness to pay is completely unvalidated.** No evidence was found of any UK haulage/aggregates/quarrying/muck-away SME currently paying for *any* dedicated commercial-intelligence subscription — as distinct from operational ERP software (Herbst, Access Weighsoft), which they demonstrably do pay for. The market research is encouraging on "is there a product gap" but silent on "will this specific customer segment pay a monthly SaaS fee for it." **This is the single largest unvalidated assumption in the whole brief and should be tested with real conversations before writing more code than a prototype.**

4. **The sector is in a 12-year demand trough**, which cuts against a straightforward "growing market" narrative — the pitch has to be "help you win a bigger share of less work," not "ride a wave," which is a harder but not fatal sell.

None of this means "don't build it." It means: **narrow the wedge, prove the core loop on the strongest data, and validate willingness-to-pay before investing in the hardest/most expensive data source (planning) or the highest-hallucination-risk feature (supply-chain inference).**

## Target customer (narrowed)

Not "quarrying + aggregates + haulage + tipper + muck-away + waste + plant + adjacent construction supply chain" as a single day-one target. Start with **one concrete beachhead**, matching the example profile already given in the brief:

> A regional haulage/aggregates operator with 15–40 vehicles (tippers, artics, grab vehicles), operating within a defined radius (e.g. Midlands, 100 miles), doing a mix of aggregate haulage, muck-away, and waste haulage, currently winning work through relationships, TipperLink-style load boards, and reactive quoting rather than any structured pipeline visibility.

This segment is: (a) large enough to have a real capacity-utilisation problem worth solving, (b) small enough to be priced out of Glenigan/Barbour ABI (£5k–10k/yr, sales-call-gated) but underserved by public-tender-only tools (PSIP/BidSkim/TenderLedger), which don't cover the private, non-tendered work that dominates this trade, and (c) concentrated enough (Midlands, a defined vertical) to run a real validation experiment against.

## Core problem (reframed, not restated)

The brief's framing — "businesses know what they can do, but don't know where the next opportunity is emerging" — holds up under research. What needs correcting: the problem is not lack of information (Glenigan/Barbour ABI/trade press already flood this market with volume), it's **lack of information filtered by physical operating capability and shown with enough evidence to act on**. The market gap analysis (`01-market-research.md`) confirms nobody does true fleet/capability matching — every competitor found matches against a "sector" or "CPV code," not a tipper fleet, a haul radius, or a licensed waste-carrier category.

## Unique value proposition

**"A commercial radar scoped to what your fleet can actually do — not another list of tenders."**

Three defensible differentiators, each grounded in a specific research finding:
1. **Fleet/capability-specific matching** (vehicle type, payload, haul radius, licensed material categories) — confirmed gap, no competitor does this.
2. **Provenance-first presentation** (verified / calculated / estimated / inferred / unknown on every claim) — a genuine trust differentiator against incumbents who present AI/researcher output without this discipline, and directly protects against the hallucination risk that would kill this specific product category fastest.
3. **Precision over volume** — actively filtering out irrelevant matches rather than maximising notification volume, which is the opposite instinct of most tender-alert tools (whose business model rewards more alerts, not better ones).

## Positioning against competitors

Not against Glenigan/Barbour ABI head-on (they have 160 researchers and a decade of relationship data — a defensible moat this product cannot match at MVP). Not against PSIP/BidSkim (public-tender-only, saturated, undifferentiated AI-scoring). Position **above TipperLink** in the funnel: TipperLink is where a load gets transacted once it exists; this product is where an operator learns a load is *about to* exist. These are complementary, not competitive — a credible story for a customer already using TipperLink.

## MVP scope

**In scope:**
- Business profile: services, fleet (vehicle types/counts), operating geography + radius, capacity, minimum attractive opportunity value, preferred sectors — customer-entered, not inferred.
- Data ingestion from **Tier 1 sources only**: Find a Tender Service (OCDS API) + Companies House (REST/streaming API) — see `02-data-sources.md`. No planning-signal ingestion in the MVP.
- AI extraction of stated requirements (tonnes, vehicle/service type, location, deadline, contract value) **only where explicitly present in the source text** — missing fields are labelled "not stated," never inferred and presented as fact.
- Deterministic matching engine (service/fleet/geography/capacity/commercial/sector fit) — see `06-system-design.md` for methodology.
- Deterministic commercial calculation engine using **customer-supplied rates only** (payload, price/tonne or /load or /mile, fuel cost, driver cost, margin target) — no invented industry rates.
- Opportunity dashboard with full evidence/provenance trail, fit-score breakdown, and status tracking (interested/contacted/won/lost/not relevant) with feedback capture.

**Explicitly NOT in MVP** (each is a deliberate scope cut, not an oversight):
- Planning-signal ingestion (Stage 1 of the brief's signal chain) — the data source research shows this needs either a real scraper-engineering investment or a recurring paid-aggregator cost; defer until the procurement-only loop is validated.
- Award → downstream supply-chain-requirement inference (the brief's "£5m contract → infers haulage/tipper/driver needs" example) — pure AI inference with no data to verify against; the highest hallucination-risk feature in the whole brief. Defer to a clearly-labelled "speculative" feature after the core trust model is proven.
- Autonomous outreach / contact scraping for sales purposes — gated on legal sign-off per `03-legal-compliance.md`; not attempted in MVP.
- Multi-agent AI architecture — see `06-system-design.md`; the MVP does not need 8 specialised agents.
- Billing, multi-seat accounts, CRM integrations, notifications beyond in-app.

## Business model & pricing hypothesis

**Recommendation: flat monthly subscription, tiered by fleet size / business-profile count — not credits, not per-opportunity pricing.** Per-opportunity or credit pricing directly contradicts the "precision over volume" positioning: charging per lead rewards showing more leads, not better ones. A flat subscription lets the product be judged on quality of matches, not quantity.

Pricing calibrated against real comparables found in research (not the enterprise Glenigan/Barbour ABI tier, which this product cannot match on data depth at MVP, and not the saturated £75–250/mo public-tender-scoring tier, which this product must clearly differentiate above on capability-matching):

| Tier | Target | Illustrative price (validate before committing) | Rationale |
|---|---|---|---|
| **Starter** | Small operator, single depot, 1 business profile | ~£99–149/mo | Priced near SiteLens/TenderLedger to be accessible to the SME segment Glenigan/Barbour ABI don't serve well |
| **Professional** | Established operator (the 20–40 vehicle example profile) | ~£299–399/mo | Core target tier — priced below Glenigan's £5k–10k/yr while well above the generic AI-tender-scoring tier, justified by fleet-matching depth |
| **Business** | Larger fleet operator, multiple sub-fleets/services | ~£699–999/mo | Multiple business-profile support, higher opportunity volume |
| **Enterprise** (future) | Multiple depots/business units | Custom | Not for MVP |

These figures are **a pricing hypothesis to validate, not a committed price list** — the brief's instruction not to assume the originally-discussed pricing is correct is honoured here; there is no strong external benchmark for this exact niche, only adjacent comparables.

## Key risks (explicit, not softened)

1. **Unvalidated willingness-to-pay** in the target niche — the single biggest risk; see validation plan in the executive summary.
2. **Planning-data dependency for the highest-value signal (early-stage opportunities)** — MVP deliberately excludes it, which may weaken the "commercial radar" pitch versus the brief's original vision until a paid aggregator is licensed.
3. **Hallucination/trust risk** if provenance discipline isn't enforced rigorously in the UI and the extraction pipeline — this is a product-killing risk in a professional B2B context, not a nice-to-have.
4. **Narrow, contracting market** — the aggregates/haulage niche is real but small and currently shrinking; expansion into adjacent trades (groundworks, demolition, plant hire) may be necessary sooner than the brief assumes to reach meaningful scale.
5. **Incumbent feature-add risk** — Glenigan/Barbour ABI could add a fleet-capability filter faster than this product can build a data moat; the defensible asset has to become customer-specific operational data and feedback loops (win/loss, fit-score accuracy) over time, not the raw signal itself.
