# Groundline — Product Scope

*This document reconciles the "Groundline" vision with the validated research in `docs/research/` and the Go/No-Go in `docs/EXECUTIVE_SUMMARY.md`. It does not re-litigate that research — it sequences a larger vision on top of it.*

## Naming note

This project was researched and specified under the working name "QH Lead Generator," targeting a single beachhead customer (a Midlands haulage/aggregates/muck-away operator). "Groundline" is treated here as the product's real, ongoing identity — the company-scale vision the validated MVP is the first slice of. Nothing in the prior research changes: the beachhead, the Tier 1 data strategy, the provenance rules, and the technology choices already made all still apply. `CLAUDE.md` has been updated to use the Groundline name.

## The six modules, and what stage each is actually at

| Module | What it is | Status | Depends on |
|---|---|---|---|
| **1. Discover** | Commercial opportunity discovery (procurement + eventually planning signals) | **Researched, not built.** This is the MVP core described in `docs/research/06-system-design.md` — FTS/OCDS + Companies House ingestion, Extraction/Verification agents, deterministic matching. | Supabase project, Anthropic production API key |
| **2. My Opportunities** | AI-powered matching and recommendations, customer-facing | **Prototyped** (`prototype/fleet-radar.html`) with demo data. Real version needs Discover's data pipeline behind it. | Discover |
| **3. Contracts Exchange** | Capacity marketplace / subcontract opportunities between customers | **Not researched, not built.** This is a materially different product shape (two-sided marketplace, transaction/trust mechanics) from the intelligence-matching MVP. Closest precedent found in research is TipperLink (`docs/research/01-market-research.md`) — a working example this could eventually feed into or compete with. Needs its own research pass before design. | A working Discover + a base of engaged customers to seed liquidity |
| **4. Commercial Intelligence** | Research, analysis, forecasting beyond single-opportunity matching | **Partially covered** by the Discover data model (Evidence, provenance) but the "forecasting" and cross-customer research-reuse layer described in the CTO brief's Data Architecture section is new scope — see `docs/architecture/02-data-and-intelligence-reuse.md`. | Discover, a populated opportunity graph |
| **5. AI Growth Department** | Groundline's own AI-run marketing/sales/customer success | **Deliberately deferred.** See `docs/marketing/00-growth-department-roadmap.md` and `docs/sales/00-sales-motion.md` — this is infrastructure for acquiring *Groundline's own* customers, not something to build before Groundline has a validated product or its first customers. Building outreach automation now, before the legal review flagged in `docs/research/03-legal-compliance.md` and before any real usage data exists to target against, is the highest-risk, lowest-value thing on this list to build first. | A working product, real usage data, legal sign-off on outreach |
| **6. Groundline Operating System** | AI-assisted company management (finance, ops, reporting) | **Deliberately deferred.** Genuinely useful only once there's a company to run — real customers, real revenue, real support load. Documented as future infrastructure in `docs/operations/00-background-jobs.md`. | Revenue, a support/ops workload worth automating |

## Sequencing (the actual build order)

1. **Validate** — run the validation experiment in `docs/EXECUTIVE_SUMMARY.md` §15 (real ingested data + 8–12 operator conversations). This has not happened yet and nothing below should jump ahead of it in priority.
2. **Build Discover + My Opportunities for real** — Supabase schema, FTS/Companies House ingestion workers, the two-agent extraction/verification pipeline, matching and commercial engines as deterministic code, and turn the prototype into a real customer-facing app against real data.
3. **Commercial Intelligence layer** — once Discover is ingesting continuously, invest in the reuse architecture (one researched project serving many customers) described in `docs/architecture/02-data-and-intelligence-reuse.md`.
4. **Contracts Exchange** — only once Discover has enough engaged customers to seed a two-sided market; research this properly first, it is not a natural extension of the matching engine, it's a different product with different trust/liability considerations.
5. **AI Growth Department** — only once Groundline has a real product and real usage data to build ideal-customer-profiles and triggers from, and only after legal sign-off on any outreach mechanism.
6. **Groundline Operating System** — only once there's enough operational surface area (paying customers, support volume, multiple team members or agents acting on the business) to justify automating company operations.

This is the single most important scoping decision in this document: **the CTO brief's full six-module vision is the right long-term shape, but building modules 5 and 6 before modules 1–2 exist in production would be building automation for a business that doesn't have customers yet.**
