# Tool & MCP Audit

Every tool named in the CTO brief, audited against one question: **does Groundline have a real, current need for this, or would adopting it now be paying (in money, complexity, or risk) for a problem that doesn't exist yet?** Verdicts are `ADOPT NOW`, `ADOPT SOON` (clear, near-term trigger), `DEFER` (real future value, no current trigger), or `REJECT` (evaluated and ruled out).

## Development infrastructure

| Tool | Verdict | Why |
|---|---|---|
| **GitHub + GitHub MCP** | ADOPT NOW | Already in use this session (`github/github-mcp-server`, official, actively maintained). No change needed. |
| **Supabase (+ MCP/connector)** | ADOPT NOW | Already the chosen backend (`docs/research/04-technical-architecture.md`). Requires the user to create a project — see `docs/ENVIRONMENT_SETUP.md` §C. Not yet provisioned. |
| **PostgreSQL** | ADOPT NOW (via Supabase) | Not a standalone choice — Supabase *is* Postgres. No separate database needed. |
| **Playwright (+ MCP)** | ADOPT SOON | Justified once real UI exists to test (`docs/research/04-technical-architecture.md`). Chromium/Playwright are pre-installed in this dev environment already; no account needed. Trigger: first real backend-connected page. |
| **Firecrawl (+ MCP)** | DEFER | Confirmed (fresh research, Sept 2026) as a paid, official, well-built scraping service — genuinely better than hand-rolled scraping for JS-heavy/anti-bot sites. But Groundline's MVP data sources (Find a Tender OCDS API, Companies House API) are both clean official APIs with no scraping need. Trigger to revisit: adding a data source with no API (e.g. a council planning portal, per `docs/research/02-data-sources.md` Tier 3) — and even then, evaluate against a paid planning-data aggregator first, since that was already the research's preferred route. |
| **Filesystem MCP** | ADOPT NOW | Already covered natively by this session's Read/Write/Glob/Grep tools — no separate MCP server needed on top. |
| **Context7 MCP (docs)** | ADOPT NOW | Free, no API key required for basic use (optional key raises rate limits), low risk, directly useful for accurate library/framework documentation while building Groundline's real backend. Added to `.mcp.json` in this commit. |
| **Exa / other paid search MCP** | DEFER | Paid beyond a small free allowance; this session's own `WebSearch`/`WebFetch` already cover ad hoc research needs. Revisit only if a recurring, high-volume semantic-search need emerges. |

## AI / model routing

| Tool | Verdict | Why |
|---|---|---|
| **Anthropic / Claude (direct API)** | ADOPT NOW | Already the chosen approach (`docs/research/04-technical-architecture.md`) — native model tiers (cheap/mid/premium) + prompt caching + Batch API cover the cost-control need without a routing layer. |
| **OpenRouter (+ MCP)** | REJECT (for now) | Already evaluated and rejected in `docs/research/04-technical-architecture.md`: adds a routing hop, extra billing relationship, loses first-party Anthropic features. Nothing in this phase changes that. Would only become relevant if Groundline needed genuine multi-provider redundancy or non-Anthropic model A/B testing — not a current need. |
| **OmniRoute** | REJECT | Freshly researched (Sept 2026): a real, MIT-licensed self-hosted AI gateway (`diegosouzapw/OmniRoute`, ~60k GitHub stars, ~7 months old), but it solves "route across 300+ providers," a problem Groundline doesn't have — the architecture already committed to Claude's own tiers. It also has an **unresolved supply-chain security flag**: Socket.dev flagged the `omniroute@3.8.5` npm package for malware-like patterns in May 2026 ([issue #2863](https://github.com/diegosouzapw/OmniRoute/issues/2863)); reviewers advise against production use pending independent verification. Do not run this in front of real provider API keys. |
| **GPT / Gemini / DeepSeek models** | DEFER | No current task in the researched architecture (`docs/research/06-system-design.md`) needs a non-Claude model — extraction, verification, and all reasoning tasks are scoped to Claude's own tiers. Revisit only if a specific task is demonstrably cheaper/better on another provider, decided per-task, not as a platform-wide routing change. |
| **Embeddings / pgvector** | ADOPT SOON | Supabase ships pgvector by default at no extra cost — genuinely useful once there's a real corpus of `Procurement` records to search semantically (see `docs/architecture/02-data-and-intelligence-reuse.md`). Not needed before real ingestion exists. |

## Product infrastructure

| Tool | Verdict | Why |
|---|---|---|
| **Stripe (+ MCP)** | DEFER | Already the chosen billing provider (Shopify rejected — `docs/research/04-technical-architecture.md`), but only needed once billing is actually being built, which is explicitly out of MVP scope (`docs/research/05-product-strategy.md`). When integrated: use a **restricted API key** (`rk_live_`/`rk_test_`), scoped to only the resources any agent touching it needs — this is Stripe's own documented, server-enforced guardrail, confirmed current in this session's research. |
| **PostHog (+ MCP)** | DEFER | Free/generous tiers, official MCP confirmed current — but genuinely useful only once there are real users generating real usage events. Premature pre-launch. |
| **Sentry (+ MCP)** | ADOPT SOON | Free tier, official MCP confirmed current, low-risk (investigate-oriented). Trigger: the first real backend deployment — bring it in *with* that deployment, not after. |
| **n8n (+ MCP)** | DEFER | Confirmed to now have an official MCP server (Sept 2026) and a free self-hosted community edition. But Groundline's current workflow need (2 AI agents + deterministic ingestion workers) is fully covered by application code — n8n would add a second orchestration surface for no current benefit. Revisit only if cross-system glue work (e.g. connecting many third-party SaaS tools once the AI Growth Department phase begins) outgrows what's sensible to hand-code. |
| **Email infrastructure** | DEFER | No transactional or marketing email need yet (no live customers, no outreach — see `docs/marketing/00-growth-department-roadmap.md`). Add a transactional provider (e.g. Postmark/Resend-class tool — not yet evaluated) when Supabase Auth needs real transactional email (password reset, invites) for real users. |
| **CRM** | DEFER | No sales motion exists yet. See `docs/sales/00-sales-motion.md`. |
| **Scheduling / cron** | ADOPT SOON | Needed as soon as ingestion workers exist (Supabase supports scheduled Edge Functions / pg_cron natively — no separate service needed at this scale). See `docs/operations/00-background-jobs.md`. |
| **Agent orchestration framework** (LangGraph/CrewAI/etc.) | REJECT (for now) | The researched agent architecture is deliberately 2 stateless, independent Claude calls (Extraction, Verification) plus deterministic code — not a multi-agent workflow graph. Adding an orchestration framework for 2 agents is unjustified complexity. Revisit only if the agent count and inter-agent state genuinely grow past what a simple function-call pipeline can express cleanly. |

## Research/data sources

Unchanged from `docs/research/02-data-sources.md` — Tier 1 (Find a Tender/OCDS, Companies House) now; planning data via a paid aggregator or scraper is a deliberate later decision, not a default. Browser automation (Playwright) is for testing the app, not for data ingestion — ingestion should always prefer the official APIs already identified over scraping.

## Summary: what actually changes right now

Nothing paid or credentialed. The only concrete addition from this audit is the free, keyless **Context7 MCP** (`.mcp.json`, this commit) for documentation lookup during development. Everything else marked ADOPT SOON has a named trigger (first backend deployment, first ingestion worker) that hasn't happened yet — they're sequenced, not forgotten.
