# Database Schema Reference

Source of truth is the SQL itself: `app/src/db/migrations/*.sql`, applied in order by `npm run migrate` (tracked in `schema_migrations`, safe to re-run). This document is a narrative index, not a duplicate — read the migration files for exact types/constraints.

| Table | Scope | Purpose |
|---|---|---|
| `businesses`, `users`, `user_businesses` | Account | Tenants and their login users (many-to-many via role) |
| `business_profiles` | Account | Services, fleet, geography, capacity, rates — the matching engine's customer-side input |
| `companies` | Shared | Companies House-style enrichment (schema ready, not yet populated — no API key configured, see `04-implementation-status.md`) |
| `procurement` | Shared | Ingested Find a Tender / Contracts Finder notices — one row per notice, reused across every business (`02-data-and-intelligence-reuse.md`) |
| `planning_signals` | Shared | Ingested planning.data.gov.uk reference entities (currently brownfield-land) — explicitly NOT full planning-application coverage, see the scope note in `0001_init.sql` |
| `requirements` | Shared | Extraction Agent output — one row per extracted field per notice, each with its own `confidence` and `source_span` |
| `opportunities` | Tenant-scoped (RLS) | Links a business to a notice/signal; unique per `(business_id, procurement_id)` and `(business_id, planning_signal_id)` |
| `matches` | Tenant-scoped (RLS) | The deterministic score breakdown for one opportunity — 6 dimensions, weights used, positive/negative/unknown factors |
| `commercial_estimates` | Tenant-scoped (RLS) | Deterministic revenue/cost/contribution/margin, or an honest "unknown" |
| `evidence` | Tenant-scoped (RLS) | Every claim shown to that business about that opportunity, with provenance |
| `feedback` | Tenant-scoped (RLS) | "Was this match correct?" — captured in the schema, not yet wired into a UI in this phase |
| `credits`, `credit_transactions`, `intelligence_unlocks` | Tenant-scoped (RLS) | Credit balance, ledger, and unlocked deep-intelligence content |
| `analytics_events` | Tenant-scoped (RLS) | Validation instrumentation — see `06-validation-plan.md` |
| `ingestion_runs` | Operational | One row per ingestion run — status, counts, errors, for observability |
| `places` | Cache | Geocoding cache (postcodes.io results) |
| `schema_migrations` | Operational | Tracks which migration files have been applied |

## Row Level Security

Every tenant-scoped table has an RLS policy keyed on `current_setting('app.business_id', true)`, set per-transaction by `src/db/withTenant.ts`. Two Postgres roles enforce this at the connection level, not just in application code:

- `groundline` (table owner) — bypasses RLS. Used only by ingestion workers, migrations, and batch jobs (the matching engine, extraction pipeline) via `servicePool`.
- `groundline_app` — subject to RLS, no bypass privilege. Used by every live web-app request via `appPool` + `withTenant()`.

See `docs/security/00-security-architecture.md` for the reasoning, and `test/db-integration.test.ts` for a live isolation check.
