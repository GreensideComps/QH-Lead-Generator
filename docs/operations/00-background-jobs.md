# Background Work & Scheduling

The customer should never need to manually trigger ingestion, matching, or re-scoring — this is a CTO-brief requirement and it's straightforward to satisfy at Groundline's current scale without adding a workflow-orchestration platform.

## What runs in the background, once the backend exists

| Job | Frequency | What it does | Trigger for building it |
|---|---|---|---|
| FTS/OCDS ingestion | Hourly (matches FTS's near-real-time update cadence, `docs/research/02-data-sources.md`) | Fetch new/changed notices, dedupe against existing `Procurement` rows by external ID, hash-check amended notices for re-extraction | Backend exists |
| Companies House sync | Daily, or event-driven via the Streaming API | Enrich `Company` rows referenced by ingested notices | Backend exists |
| Extraction + Verification pass | Triggered per new/changed `Procurement` row | Run the two-agent pipeline (`docs/architecture/03-ai-routing-strategy.md`), via the Batch API where latency doesn't matter | Ingestion exists |
| Re-matching | Triggered when a `Business` profile changes, or on the same schedule as ingestion for existing open opportunities | Re-run the deterministic matching engine against the current shared `Procurement`/`Requirement` data | Matching engine exists |
| Deadline alerts | Daily | Flag opportunities with an approaching deadline (already in the prototype's dashboard concept) | Matching engine + a real notification channel exist |

## How, technically — no new platform needed yet

Supabase supports **scheduled Edge Functions** (or `pg_cron` directly in Postgres) natively. At Groundline's current and near-term scale (a handful of data sources, low-thousands of notices/month per `docs/research/06-system-design.md`), this covers every job above without adding n8n or any other orchestration platform — consistent with the `REJECT (for now)` verdict on n8n in `docs/architecture/01-tool-and-mcp-audit.md`.

**Revisit n8n (or similar) only if**: the number of distinct external systems needing to be wired together grows past what's sensible to hand-code (this becomes a real question once the AI Growth Department phase begins — coordinating outreach across email/LinkedIn/CRM-equivalent tools is a more natural n8n use case than the current ingestion pipeline).

## Observability for background work

Every job writes to the `ai_call_log` (for AI-involving jobs, `docs/architecture/03-ai-routing-strategy.md`) or an equivalent `job_run_log` (for deterministic jobs): started/finished timestamps, success/failure, rows processed, errors. This is the minimum needed before Sentry (`ADOPT SOON`, `docs/architecture/01-tool-and-mcp-audit.md`) is wired in — Sentry catches unhandled errors; the job log is the source of truth for "did the scheduled work actually run and what did it do," which Sentry alone doesn't give you.

## Groundline Operating System (deferred)

The CTO brief's "AI-assisted company management" is the eventual home for background jobs like prospect discovery, sales follow-ups, and customer-success monitoring — deliberately not listed above, because none of it is justified before Groundline has customers and a support/sales workload to automate. See `docs/product/00-product-scope.md` for sequencing and `docs/marketing/00-growth-department-roadmap.md` / `docs/sales/00-sales-motion.md` for what those specific deferred workflows look like when their trigger conditions are met.
