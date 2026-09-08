# AI Model Routing Strategy

No routing layer/gateway (OpenRouter, OmniRoute, or otherwise) — see `docs/architecture/01-tool-and-mcp-audit.md` for why both were evaluated and rejected. Routing is done in application code by simply choosing which Claude model tier to call for a given task. This is the "routing strategy" in full — it doesn't need to be more complex than that at this scale.

## Task → tier mapping

| Task | Tier | Why |
|---|---|---|
| Triage: is a new notice even in-scope for any active customer's sector/CPV? | Cheap (Haiku-class) | High volume, low complexity, binary-ish decision. |
| Extraction Agent: pull structured fields from notice text | Mid (Sonnet-class) | Needs real language understanding and structured output reliability; volume is per-notice, not per-customer (see `docs/architecture/02-data-and-intelligence-reuse.md`), so cost scales with data, not customers. |
| Verification Agent: re-check extracted claims against source span | Mid (Sonnet-class) | Same reasoning as extraction — an independent second pass, not a cheaper rubber stamp, because its whole job is to catch what a cheaper/same-tier pass might miss. |
| Escalation: ambiguous extraction, or high opportunity value | Premium (Opus-class) | Reserved for the minority of cases where the mid tier's confidence is low or the commercial stakes are high enough to justify the cost — not the default path. |
| Matching, scoring, commercial calculation | **No model call** | Deterministic code (`docs/research/06-system-design.md`) — this is the single biggest cost lever: the tasks that happen most often (once per customer per opportunity) never touch an LLM at all. |
| Natural-language explanation of a match/recommendation | Mid (Sonnet-class) | Light generation task once the deterministic score already exists — summarising a known result, not reasoning from scratch. |

## Cost control mechanisms, in priority order

1. **Don't call a model at all where deterministic code suffices** — already the largest lever, per the extraction-once/match-many-times architecture.
2. **Prompt caching** on the (large, mostly-static) system prompts for Extraction/Verification agents — cuts repeated-context cost sharply for high-volume ingestion.
3. **Batch API** for non-latency-sensitive ingestion (overnight/scheduled notice processing doesn't need synchronous response) — roughly half the per-token cost of synchronous calls.
4. **Tier selection per task**, not a blanket "use the best model for everything" default — the brief's own instruction, already the design.

## Logging (needed before this goes live, not yet built)

A single `ai_call_log` table (already specified in `docs/research/06-system-design.md`): model, task, tokens in/out, cost, latency, confidence, whether escalation occurred. This is the observability foundation for the "AI costs, model usage" visibility the CTO brief asks for — see `docs/operations/00-background-jobs.md` for how it plugs into background processing, and revisit PostHog/Sentry (both DEFERRED, `docs/architecture/01-tool-and-mcp-audit.md`) once there's real traffic to visualise this against.

## What this deliberately does not include yet

Non-Claude models (GPT/Gemini/DeepSeek) for any task — no current task has been shown to need them, and introducing a second provider multiplies the prompt-injection/reliability/observability surface for a benefit that hasn't been demonstrated. If a specific future task (e.g. very high-volume cheap classification) is shown to be meaningfully cheaper on another provider, evaluate it as a single-task decision with its own cost/quality comparison — not as a platform-wide routing overhaul.
