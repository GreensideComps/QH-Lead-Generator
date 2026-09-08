# Development Environment — Inspection & Setup Report

*Companion to `docs/EXECUTIVE_SUMMARY.md`. This covers the infrastructure/tooling side of the brief. Per that brief's own instruction, this stops short of installing anything requiring credentials, and does not build the product.*

## Environment inspected (before anything was changed)

- Repository: `GreensideComps/qh-lead-generator`, branch `claude/ai-commercial-opportunity-platform-s1j0kc`, **no prior commits** — genuinely greenfield, nothing to preserve or accidentally overwrite.
- Node v22.22.2, npm 10.9.7, git 2.43.0, Claude Code CLI 2.1.263.
- No existing `.claude/` directory, no `CLAUDE.md`, no `.env`, no existing app framework, no existing Supabase/Playwright/OpenRouter configuration.
- No `gh` CLI in this environment — GitHub operations here go through the GitHub MCP server tools instead, per this session's own configuration.

## A. Installed this session

Nothing requiring installation was added yet, by design — see "Not installed" below. What exists now is documentation only:
- `docs/research/01–07-*.md` — Phase 1–4 research and design deliverables.
- `docs/EXECUTIVE_SUMMARY.md` — Go/No-Go decision.
- `docs/ENVIRONMENT_SETUP.md` — this file.
- `CLAUDE.md` — project context for future Claude Code sessions (added alongside this report).

## B. Connected

Nothing yet. This session has GitHub repository access (via the GitHub MCP server, already configured in this environment) and web research access (used for Phase 1). No Supabase, Stripe, or OpenRouter connection exists.

## C. Requires your action

These cannot be completed autonomously — each needs an account, OAuth approval, or a credential only you can provide:

1. **Supabase** — create a project at supabase.com, then either (a) authorize the official Supabase Claude connector (OAuth, from Claude's connectors menu), or (b) run `supabase login` / `claude mcp add` with a project-scoped API key for CI/background workers. Recommend project-scoped keys over an account-wide Personal Access Token.
2. **Anthropic API key** — for production Claude usage beyond this interactive session (the ingestion pipeline's Extraction/Verification agents will need this).
3. **Stripe** — account creation + API keys, only needed once billing is actually being built (not required for the prototype/validation phase recommended in the executive summary).
4. **(Optional, only if the OpenRouter recommendation in `04-technical-architecture.md` is later overridden)** OpenRouter OAuth authorization.
5. **A decision from you**: whether to proceed to build the Artifact prototype now, per the Go/No-Go recommendation in `docs/EXECUTIVE_SUMMARY.md`. Nothing further should be built until you've reviewed that document.

## D. Not installed, and why

- **Playwright MCP / CLI / test agents** — not installed yet. There is no application code in this repository yet to browser-test; installing a testing toolchain ahead of any UI existing would be premature. Install this when the prototype/production UI build actually begins (it's a plain `npm install` + `npx @playwright/mcp@latest` with no account/credential requirement, so this is low-friction to add later).
- **Supabase MCP / project** — requires your account (see "Requires your action"); not something this session can create on your behalf.
- **OpenRouter MCP** — deliberately not recommended for this project's architecture (see `04-technical-architecture.md`); Claude's own model tiers are the better fit for a Claude-first cost strategy. Not installed unless that recommendation is later overridden.
- **Stripe** — not needed until billing is actually being built, which is explicitly out of MVP scope.
- **`.claude/agents/`, `.claude/skills/` scaffolding** — not created yet. The brief's suggested 8–10 agent architecture was evaluated and found oversized for the MVP (`06-system-design.md` recommends 2 agents: Extraction and Verification, with matching/commercial-calculation kept as deterministic code, not agents). Building placeholder agent files now, before there's any actual ingestion/extraction code for them to operate on, would create exactly the "pointless placeholder agents" the brief warns against. These should be created when the MVP build begins, scoped to the 2-agent architecture actually justified by the research.
- **Application framework, database schema, ingestion workers** — none of this is "environment setup," it's the product build itself, explicitly out of scope until the Go/No-Go in `docs/EXECUTIVE_SUMMARY.md` is reviewed and the prototype/validation step is approved.

## E. Architecture (target, once approved — nothing below is provisioned yet)

```
        FTS (OCDS API)         Companies House API
             |                         |
             +----------+  +-----------+
                        v  v
                Ingestion workers (scheduled)
                        |
                        v
              Extraction Agent (Claude)
                        |
                        v
             Verification Agent (Claude)
                        |
                        v
        Supabase (Postgres + pgvector + Auth + RLS)
                        |
          +-------------+-------------+
          v                           v
   Matching engine              Commercial calc engine
   (deterministic)               (deterministic)
          |                           |
          +-------------+-------------+
                        v
                Opportunity dashboard
              (customer-facing web app)
                        |
                        v
                 Stripe Billing (later)
```

Full reasoning for each component: `docs/research/04-technical-architecture.md` and `docs/research/06-system-design.md`.

## F. Security

No secrets exist in this repository yet — there is nothing to leak. Once real credentials are introduced (Supabase keys, Anthropic API key, Stripe keys), they must go in a `.env` file that is git-ignored from the first commit that introduces it, never committed, and never placed in `CLAUDE.md` or any file under `docs/`. A `.gitignore` covering `.env`, `.env.*`, and common secret-file patterns should be added at the same time the first `.env` file is created — not left until after.

## G. Cost

Nothing in this session incurred cost beyond this Claude Code session itself. Future costs, once approved: Supabase (free tier available, paid tiers scale with usage), Anthropic API usage (the two-agent extraction/verification pipeline, plus prompt caching/Batch API to control cost per `04-technical-architecture.md`), Stripe (transaction fees, only once billing exists), and optionally a commercial planning-data aggregator (Searchland/PlanNexus/LandHawk — bespoke pricing, only if/when planning-signal ingestion is greenlit as a fast-follow).

## H. Recommended next step

Review `docs/EXECUTIVE_SUMMARY.md`. If you approve proceeding: the single best next step is building the interactive Artifact prototype (per `docs/research/07-ux-design.md`) using clearly-labelled demonstration data reflecting the real scoring/provenance model in `docs/research/06-system-design.md` — not real ingested data yet, since no Supabase project or Anthropic production key exists. In parallel, start the 8–12 operator discovery conversations from the validation plan in `docs/EXECUTIVE_SUMMARY.md` §15 — that's the part of the validation experiment this session cannot run for you, and it's the fastest way to de-risk the single biggest open question (willingness to pay) before any production infrastructure is provisioned.
