# Groundline — Architecture & Infrastructure Plan

*The CTO-level report requested for this phase. Written by inspecting the actual repository state, not assumption — see "Repository structure: now" below for exactly what exists today. Every sub-topic has its own detailed doc; this ties them together and gives the 14 outputs requested.*

**Status update — this doc originally described Phase 1 (the real backend) as "not started yet." That's no longer true.** A real, working commercial vertical slice now exists in `app/` — live ingestion, deterministic matching/commercial engines, a credit-based unlock flow, and a web app, all exercised end-to-end against real UK procurement data. See `docs/architecture/04-implementation-status.md` for exactly what's real, what's tested, and what still needs a production Anthropic/Stripe/Supabase account to go further. The plan below is otherwise unchanged and still governs what comes after.

## 1. Recommended architecture

```
                    UK PUBLIC DATA (Tier 1 today)
              Find a Tender (OCDS API)   Companies House API
                          |                    |
                          +---------+----------+
                                    v
                    Ingestion workers (Supabase scheduled
                        functions / pg_cron — no n8n needed yet)
                                    |
                                    v
                     Extraction Agent (Claude, mid tier)
                                    |
                                    v
                    Verification Agent (Claude, mid tier)
                                    |
                                    v
        Supabase (Postgres + pgvector + Auth + Row Level Security)
        Shared: Procurement / Company / Requirement / Evidence
        Per-customer (RLS-scoped): Business / Opportunity / Match /
                                    CommercialEstimate / Feedback
                          |                          |
                          v                          v
              Matching engine                Commercial calc engine
              (deterministic)                 (deterministic)
                          |                          |
                          +------------+-------------+
                                       v
                        Opportunity (customer-facing,
                       full provenance + evidence trail)
                                       |
                                       v
                    Groundline web app (customer dashboard)
                                       |
                                       v
                      Stripe Billing (deferred until needed)

  ───────────────────────────────────────────────────────────
  Dev-tooling layer (this Claude Code environment, not the product):
  GitHub MCP · Context7 MCP · Playwright · 4 dev-tooling subagents
  (research-analyst, qa-reviewer, playwright-tester, security-auditor)

  Deferred layers (built only once their trigger condition is met —
  see docs/product/00-product-scope.md):
  AI Growth Department · Contracts Exchange · Groundline Operating System
```

This is the same architecture already designed in `docs/research/06-system-design.md`, extended with the reuse layer (`docs/architecture/02-data-and-intelligence-reuse.md`) and the explicit sequencing of the newer modules (`docs/product/00-product-scope.md`). Nothing about the core design changed — it's being built out, not replaced.

## 2. Tool audit

Full table in `docs/architecture/01-tool-and-mcp-audit.md`. Headline: **nothing paid or credentialed changes right now.** The only new adoption is the free, keyless Context7 MCP server. Everything else requested in the CTO brief is either already decided (and unchanged), or has a named trigger condition that hasn't been met yet, or was actively evaluated and rejected (OpenRouter, OmniRoute, Shopify).

## 3. MCP audit

Also in `docs/architecture/01-tool-and-mcp-audit.md`, with September 2026 research behind every verdict (not assumption): GitHub MCP (already in use, confirmed current), Context7 MCP (added), Firecrawl/PostHog/Stripe/n8n MCPs (all confirmed to officially exist and be current, all deferred to a specific trigger), Sentry MCP (confirmed current, adopt with first deployment), OmniRoute (confirmed real but security-flagged and solving a problem Groundline doesn't have — rejected).

## 4. Installation plan

| Phase | What | Depends on |
|---|---|---|
| **Now (this commit)** | Context7 MCP, 4 dev-tooling subagents, `.env.example`, docs structure | Nothing — done |
| **Phase 1 — backend exists** | Supabase project provisioned, schema from `docs/research/06-system-design.md` implemented, ingestion workers, Extraction/Verification agents as real code, Sentry wired in with first deployment | User creates Supabase project + Anthropic production key (`docs/ENVIRONMENT_SETUP.md` §C) |
| **Phase 2 — real users** | PostHog, pgvector search over the real corpus | Phase 1 live with real customer usage |
| **Phase 3 — billing needed** | Stripe Billing + Stripe MCP with a restricted key | A priced, validated product |
| **Phase 4 — AI Growth Department** | Sales/marketing agents, CRM, outreach automation | Real usage data + legal sign-off (`docs/marketing/00-growth-department-roadmap.md`) |
| **Phase 5 — Contracts Exchange, Operating System** | Researched separately, not yet scoped | Enough engaged customers / enough operational surface area (`docs/product/00-product-scope.md`) |

## 5–7. Required accounts, API keys, environment variables

All three are one list — see `.env.example` (this commit) for the authoritative, current version, grouped by phase. Summary: **Supabase project + Anthropic API key + Companies House API key** are the only accounts needed to start Phase 1. Everything else (Stripe, Sentry, PostHog, Firecrawl) is listed but commented out until its phase is reached. None of these can be provisioned by this session autonomously — they need the user's own accounts, per `docs/ENVIRONMENT_SETUP.md`.

## 8. Agent architecture

Full detail in `docs/agents/00-agent-architecture.md`. Two classes, not conflated: 4 dev-tooling Claude Code subagents (built now, in `.claude/agents/`) vs. 2 justified product-embedded agents (Extraction, Verification — specified, not yet built since there's no backend). Every other agent named in the CTO brief (Sales, Marketing, SEO, Growth Director, Customer Success, Finance/Ops, "CTO Agent") is either not actually an AI-agent problem (matching/commercial analysis stay deterministic) or explicitly deferred with a named trigger.

## 9. AI routing strategy

Full detail in `docs/architecture/03-ai-routing-strategy.md`. No routing gateway (OpenRouter/OmniRoute both rejected) — routing is a simple per-task model-tier choice in application code: cheap tier for triage, mid tier for extraction/verification/explanation, premium tier reserved for low-confidence escalation and high-stakes cases. Deterministic code handles matching/scoring/commercial calculation with zero model calls — the single biggest cost lever, and the reason Groundline's AI cost scales with data volume, not customer count (`docs/architecture/02-data-and-intelligence-reuse.md`).

## 10. Repository structure

**Now** (Phase 1's vertical slice is real — see `docs/architecture/04-implementation-status.md`):
```
CLAUDE.md
.env.example
.mcp.json
.claude/agents/          4 dev-tooling subagents
docs/
  EXECUTIVE_SUMMARY.md
  ENVIRONMENT_SETUP.md
  research/              7 files — Phase 1-4 research
  business/, product/    vision and module sequencing
  architecture/          this doc + 6 supporting docs (tooling audit, AI
                          routing, data reuse, implementation status,
                          schema reference, validation plan)
  agents/, operations/, security/, marketing/, sales/
prototype/
  fleet-radar.html        static demo prototype (superseded by app/ for
                           real data, kept for its UX reference design)
app/                       the real Groundline backend + web app
  src/db/                 migrations (plain SQL, Supabase-portable),
                           connection pools (service-role + RLS-scoped),
                           tenant isolation helper
  src/ingestion/           Find a Tender (OCDS) + planning.data.gov.uk,
                           deterministic relevance filter, dedup/hashing
  src/extraction/          real Claude-backed Extraction/Verification
                           agents + honest manual-seed fallback + a
                           mechanical source-span integrity checker
  src/matching/            deterministic scoring engine (6 dimensions,
                           gating, reproducible)
  src/commercial/          deterministic revenue/cost/margin calculation
  src/credits/             credit ledger (atomic debit, idempotent grants)
  src/billing/             Stripe checkout + webhook (code-complete,
                           untested live — no Stripe account)
  src/intelligence/        deep-intelligence synthesis (Claude-backed +
                           deterministic-template fallback)
  src/analytics/           validation event tracking
  src/web/                 Express app: auth, Discover, My Opportunities,
                           opportunity detail, unlock, billing
  test/                    20 tests (unit + real-DB integration), all passing
```

This is real code, not a target — `npm test` and the ingestion/matching commands in `04-implementation-status.md` actually run against it.

## 11. Cost estimates

Deliberately conservative — nothing here should be provisioned before its trigger, so these are "when you get there" figures, not a bill due now:

| Item | Cost when adopted | When |
|---|---|---|
| Supabase | Free tier covers Phase 1 development; paid tier (~$25/mo+) once real usage/storage grows | Phase 1 |
| Anthropic API (Extraction/Verification, low-thousands of notices/month) | Low — dominated by prompt-cached, batch-discounted mid-tier calls; realistically tens of £/month at MVP ingestion volume, not hundreds | Phase 1 |
| Companies House API | Free | Phase 1 |
| Sentry | Free developer tier | Phase 1 (with first deployment) |
| PostHog | Free tier covers early usage | Phase 2 |
| Stripe | No platform fee; ~1.5–2.9%+20p per transaction once billing exists | Phase 3 |
| Firecrawl | £16–83+/mo if/when adopted | Only if a non-API data source is added |
| Planning-data aggregator (Searchland/PlanNexus/LandHawk) | Bespoke pricing, likely the single largest recurring cost if adopted | Only if planning-signal ingestion is greenlit, per `docs/research/05-product-strategy.md` |

The largest realistic cost in this whole plan is not any dev tool — it's the planning-data aggregator, if and when that's greenlit. Everything audited in this phase is cheap by comparison.

## 12. Risks

1. **Scope creep ahead of validation** — the single biggest risk this phase introduces. The CTO brief's six-module vision is coherent, but building modules 3, 5, 6 before 1–2 are validated and generating revenue would mean building automation and marketplaces for a business that doesn't have customers yet. Mitigated by the explicit sequencing in `docs/product/00-product-scope.md`.
2. **OmniRoute or similar "impressive-sounding" tools getting adopted on momentum rather than need** — mitigated by the audit in `docs/architecture/01-tool-and-mcp-audit.md`, but worth re-running this kind of audit before any future tool is added, not just this once.
3. **Outreach automation shipping ahead of legal review** — the CTO brief explicitly asks for growth automation; the temptation to build it "since we're already in an infra-upgrade mindset" is real. Mitigated by making the trigger conditions explicit in `docs/marketing/00-growth-department-roadmap.md` and `docs/sales/00-sales-motion.md`.
4. **Agent permission scope drifting wider over time** ("just give it the service-role key, it's easier") — mitigated by the per-agent tables in `docs/agents/00-agent-architecture.md` and the `security-auditor` subagent existing specifically to catch this before it ships.
5. **Naming/scope mismatch** — this repository, its git remote, and `CLAUDE.md` were built under "QH Lead Generator"; "Groundline" is now the working identity. Low risk technically (just naming), but worth the user confirming this is the intended permanent rename before it propagates further (e.g. into a real company name, domain, or trademark search) — not something this session can verify.

## 13. Future scalability plan

- **Data volume**: Postgres + pgvector comfortably covers low-thousands-to-low-millions of `Procurement`/`Requirement` rows; revisit only if query patterns genuinely need graph traversal (Contracts Exchange-era problem, not now).
- **AI cost**: scales with ingestion volume, not customer count, by design (`docs/architecture/02-data-and-intelligence-reuse.md`) — adding customers is cheap; adding data sources is the real cost driver, and each new source should go through the same Tier 1/2/3 evaluation as `docs/research/02-data-sources.md`.
- **Agent count**: grows only when a new capability genuinely can't be expressed as deterministic code or an existing agent's scope — not by default. Each new agent gets the same permission/escalation spec as the existing ones before it ships.
- **Team scaling**: the CTO brief's "AI-native company" ambition is a Phase 4–5 concern (Growth Department, Operating System) — the right sequencing question to keep asking is "does this remove real human labour that currently exists," not "does this sound autonomous."

## 14. Final recommended setup

Ship what's in this commit (Context7 MCP, 4 dev-tooling subagents, docs structure, `.env.example`) as the environment upgrade for this phase. Do not provision Stripe, Sentry, PostHog, Firecrawl, or any AI Growth Department infrastructure yet. The single next real engineering step is Phase 1 in the installation plan above — and per `docs/EXECUTIVE_SUMMARY.md`, that itself should follow, not precede, the validation experiment (real ingested data + 8–12 operator conversations) that hasn't happened yet.
