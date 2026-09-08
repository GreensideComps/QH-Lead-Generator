# Agent Architecture

Two distinct classes of "agent" appear in the CTO brief, and conflating them is the easiest way to over-build. This document separates them, then specifies each agent actually justified right now, plus what's deliberately deferred.

## Class 1 — Dev-tooling Claude Code subagents

Help build Groundline. Live in `.claude/agents/`, run inside Claude Code sessions, cost nothing beyond normal Claude Code usage, need no third-party accounts. Four are justified today and created in this commit:

| Agent | Responsibility | Inputs | Outputs | Tools | Model | Escalates to human when |
|---|---|---|---|---|---|---|
| `research-analyst` | Multi-step web research for market/competitor/data-source questions (formalises the ad hoc pattern already used for Phase 1 research) | A research question | A sourced, structured findings report, explicit about what's unverified | WebSearch, WebFetch, Read, Grep | Default (inherits session model) | A claim can't be sourced, or sources conflict materially |
| `qa-reviewer` | Reviews code changes against Groundline's own rules — provenance never fabricated, deterministic/AI boundary respected, no invented rates/contacts | A diff or PR | Findings ranked by severity | Read, Grep, Glob, Bash (read-only checks only) | Default | A finding suggests a security or data-fabrication risk, not just a style issue |
| `playwright-tester` | Drives Playwright against the prototype/app to check flows, screenshots, regressions | A page/flow to test | Pass/fail report + screenshots | Bash (Playwright only), Read | Default | A real backend exists and a test needs live data it shouldn't fabricate |
| `security-auditor` | Reviews secrets handling, MCP/agent permission scope, RLS policy correctness before a significant infra change ships | A diff, a schema change, or a new integration | Findings against `docs/security/00-security-architecture.md` | Read, Grep, Glob | Default | Any finding involving an actual exposed credential — stop and report immediately, don't attempt to fix by committing further changes |

Defined in `.claude/agents/*.md` in this commit. None of these have `Write`/`Edit` by default except where explicitly useful (qa-reviewer and security-auditor are intentionally read-only — they report, they don't fix, so a flawed review can't silently rewrite code).

## Class 2 — Product-embedded agents

Part of Groundline's own backend, called from application code, run against real customer/public data. **Not yet built — no backend exists.** Each still gets a full spec now so implementation has a contract to build against.

### Justified for the Discover MVP (build when the backend is built)

| Agent | Responsibility | Inputs | Outputs | Model tier | Permissions | Cost control | Escalates when |
|---|---|---|---|---|---|---|---|
| **Extraction Agent** | Pull structured fields (tonnes, vehicle type, duration, location, deadline, value) from a procurement notice, each tagged with confidence + source span | Raw notice text (`Procurement.raw_payload`) | `Requirement` rows | Mid, escalate to Premium on low confidence | Write access to `Requirement` only | Prompt caching on system prompt; Batch API for scheduled runs; never called per-customer (see `docs/architecture/02-data-and-intelligence-reuse.md`) | A field can't be extracted with reasonable confidence — writes `unknown`, never guesses |
| **Verification Agent** | Independently re-check each `Requirement` claim against the source span, downgrade/reject unsupported claims | `Requirement` rows + source text | Confirmed/downgraded `Requirement`/`Evidence` rows | Mid | Write access to `Requirement`/`Evidence` only | Same as above | A claim looks plausible but the source span doesn't actually support it — reject, don't soften |

Full design already in `docs/research/06-system-design.md` — this table restates it in the permission/escalation format the CTO brief asks for, it doesn't change the design.

### Explicitly NOT built yet, and why

| Agent (from the brief) | Status | Trigger to build |
|---|---|---|
| Matching Agent, Commercial Analyst | **Not an AI agent at all** — deterministic code, per `docs/research/06-system-design.md`. Renaming these "agents" in the CTO brief doesn't change that conclusion; the reasoning (auditability, no hallucinated arithmetic) still holds. | N/A — permanent decision, not a sequencing one |
| CTO / Technical Agent, Product Manager Agent | Not a product-embedded agent — this is what a human (or this Claude Code session, as a dev-tooling agent) does | N/A |
| Sales Agent, Marketing Agent, SEO Agent, Growth Director, Customer Success Agent | **Deferred** — see `docs/marketing/00-growth-department-roadmap.md` and `docs/sales/00-sales-motion.md` | A working product, real usage data, and legal sign-off on any outreach mechanism (`docs/research/03-legal-compliance.md`) |
| Research Agent (developer/contractor/buyer lookups) | **Deferred** — MVP's Companies House enrichment is a structured API call, not a research task | Once planning-data or richer company research is in scope |
| Finance / Business Operations Agent | **Deferred** | Real revenue and enough operational surface area to justify automating it |
| DevOps Agent (as a product-embedded agent) | **Not applicable as described** — DevOps for Groundline itself is handled by this session's own tooling (CI, Claude Code), not a product feature | N/A |

## Permission model, in one rule

**No agent's permission scope is inherited from convenience — it's derived from its table above, per agent, at design time.** A dev-tooling agent never gets write access to production data. A product-embedded agent never gets access to another customer's data (enforced at the RLS layer regardless of agent-level bugs, per `docs/security/00-security-architecture.md`) and never writes to a table outside its documented scope (e.g. Extraction/Verification can never write to `Opportunity`, `Match`, or anything billing-related).
