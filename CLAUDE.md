# Groundline — AI Commercial Opportunity Intelligence Platform

*Working name at the start of this project was "QH Lead Generator" (still the repo/GitHub name) — "Groundline" is the current product identity going forward. Nothing about the underlying research or decisions changed with the rename; see below.*

## What this project is

An AI-powered commercial opportunity intelligence platform for UK quarrying, aggregates, haulage, tipper/muck-away, and construction-supply-chain businesses. It ingests public procurement and company data, uses Claude to extract structured requirements, matches opportunities against a specific customer's fleet/capability profile, and presents commercially useful, fully-sourced recommendations — never presenting an AI estimate as a verified fact.

The longer-term vision (see `docs/product/00-product-scope.md`) extends this into six modules — Discover, My Opportunities, Contracts Exchange, Commercial Intelligence, an AI Growth Department, and a Groundline Operating System — but only the first two are researched and in active development. The rest are deliberately sequenced later; **do not build them ahead of their documented trigger condition.**

## Current status

**Research and product strategy complete; one static demonstration prototype exists; no backend, database, or production code has been built yet.** Read these in order before doing anything else:

1. `docs/EXECUTIVE_SUMMARY.md` — the Go/No-Go decision and 17-point recommendation. Start here. Status: **conditional GO on the prototype + validation experiment, not yet on a funded production build.**
2. `docs/research/01-market-research.md` through `07-ux-design.md` — the full supporting research (market/competitors, UK data sources, legal/compliance, technical architecture, product strategy, system design, UX spec).
3. `docs/architecture/00-groundline-architecture.md` — the infrastructure/tooling/agent architecture plan for operating Groundline as an AI-native company over time, and exactly what's adopted now vs. deferred and why.
4. `docs/product/00-product-scope.md` — how the six-module vision sequences on top of the validated MVP.
5. `docs/ENVIRONMENT_SETUP.md` — infrastructure/tooling decisions and what still requires the user's own credentials.
6. `prototype/fleet-radar.html` — the interactive demonstration prototype (clearly-labelled demo data, no live backend).

## Key decisions already made by research (don't re-litigate without new evidence)

- **MVP data sources**: Find a Tender Service (OCDS API) + Companies House API only. Planning-application data is confirmed fragmented (73/311 UK local authorities on the official platform) and is deliberately deferred, not part of the MVP.
- **Architecture**: Supabase (Postgres + pgvector + Auth + RLS), Claude's own model tiers for AI cost control (not OpenRouter, not OmniRoute — both evaluated and rejected, see `docs/architecture/01-tool-and-mcp-audit.md`), Stripe Billing when billing is needed (not Shopify — research found Shopify's commerce/checkout-shaped billing model doesn't fit this product).
- **AI agents**: 2 justified for the product itself — Extraction Agent and Verification Agent (both Claude), not yet built (no backend exists). Matching and commercial calculations are deterministic code, not agents. A separate, small set of Claude Code *dev-tooling* subagents (`.claude/agents/`) exist to help build Groundline — see `docs/agents/00-agent-architecture.md` for why these two categories are kept distinct and why every other agent named in later planning (Sales, Marketing, SEO, Growth Director, Customer Success) is deferred, not built.
- **Provenance is a hard requirement, not a UI nicety**: every fact shown to a customer must resolve to one of Verified / Calculated / Customer-specific / Estimated-Inferred / Unknown, backed by an `Evidence` row. Never present an AI inference as a fact.
- **No named-individual personal data in the MVP schema** — Tier 1 sources are entity/company-level only, which sidesteps the harder GDPR/PECR questions in `docs/research/03-legal-compliance.md` by design for v1.
- **No autonomous outreach/marketing/sales automation** until Groundline has a validated product, real usage data, and solicitor sign-off on the legal basis for outreach — see `docs/marketing/00-growth-department-roadmap.md` and `docs/sales/00-sales-motion.md`. This is a hard gate, not a default that gets relaxed for convenience.

## Working conventions

- Deterministic software owns math, filtering, scoring, and business rules. AI (Claude) owns extraction, classification, and natural-language interpretation only. Don't blur this line.
- Never invent industry rates, contacts, contract values, or project dates. Customer-supplied rates only for commercial calculations; "Unknown" is a valid and expected UI state, not a bug.
- Don't build the planning-data ingestion or award→supply-chain-inference features without revisiting `docs/EXECUTIVE_SUMMARY.md` first — both were deliberately scoped out of the MVP for specific, researched reasons.
- Don't add a new paid tool, MCP server, or model provider without checking `docs/architecture/01-tool-and-mcp-audit.md` first — most things asked for in later planning already have a verdict (adopt now / adopt soon with a named trigger / defer / reject with reasoning) recorded there.
- Don't build Contracts Exchange, AI Growth Department, or Groundline Operating System features ahead of their trigger conditions in `docs/product/00-product-scope.md` — each depends on the modules before it being live with real customers first.
- Every new agent (dev-tooling or product-embedded) needs the same spec as the existing ones before it ships: responsibility, inputs, outputs, tools, model tier, permission scope, and a human-escalation rule — see `docs/agents/00-agent-architecture.md`.
