# QH Lead Generator — AI Commercial Opportunity Intelligence Platform

## What this project is

An AI-powered commercial opportunity intelligence platform for UK quarrying, aggregates, haulage, tipper/muck-away, and construction-supply-chain businesses. It ingests public procurement and company data, uses Claude to extract structured requirements, matches opportunities against a specific customer's fleet/capability profile, and presents commercially useful, fully-sourced recommendations — never presenting an AI estimate as a verified fact.

## Current status

**Research and product strategy complete; no product code has been built yet.** Read these in order before doing anything else:

1. `docs/EXECUTIVE_SUMMARY.md` — the Go/No-Go decision and 17-point recommendation. Start here.
2. `docs/research/01-market-research.md` through `07-ux-design.md` — the full supporting research (market/competitors, UK data sources, legal/compliance, technical architecture, product strategy, system design, UX spec).
3. `docs/ENVIRONMENT_SETUP.md` — infrastructure/tooling decisions and what still requires the user's own credentials.

## Key decisions already made by research (don't re-litigate without new evidence)

- **MVP data sources**: Find a Tender Service (OCDS API) + Companies House API only. Planning-application data is confirmed fragmented (73/311 UK local authorities on the official platform) and is deliberately deferred, not part of the MVP.
- **Architecture**: Supabase (Postgres + pgvector + Auth + RLS), Claude's own model tiers for AI cost control (not OpenRouter), Stripe Billing when billing is needed (not Shopify — research found Shopify's commerce/checkout-shaped billing model doesn't fit this product).
- **AI agents**: 2 justified for the MVP — Extraction Agent and Verification Agent (both Claude). Matching and commercial calculations are deterministic code, not agents — see `docs/research/06-system-design.md` for why each of the brief's originally-proposed 7 agents was or wasn't kept.
- **Provenance is a hard requirement, not a UI nicety**: every fact shown to a customer must resolve to one of Verified / Calculated / Customer-specific / Estimated-Inferred / Unknown, backed by an `Evidence` row. Never present an AI inference as a fact.
- **No named-individual personal data in the MVP schema** — Tier 1 sources are entity/company-level only, which sidesteps the harder GDPR/PECR questions in `docs/research/03-legal-compliance.md` by design for v1.

## Working conventions

- Deterministic software owns math, filtering, scoring, and business rules. AI (Claude) owns extraction, classification, and natural-language interpretation only. Don't blur this line.
- Never invent industry rates, contacts, contract values, or project dates. Customer-supplied rates only for commercial calculations; "Unknown" is a valid and expected UI state, not a bug.
- Don't build the planning-data ingestion or award→supply-chain-inference features without revisiting `docs/EXECUTIVE_SUMMARY.md` first — both were deliberately scoped out of the MVP for specific, researched reasons.
