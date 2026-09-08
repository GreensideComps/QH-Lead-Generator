# Groundline — app

The real backend + web app for the commercial vertical slice described in `docs/architecture/04-implementation-status.md`. Node 22, TypeScript, Express, Postgres (`pg`), no framework magic.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL / DATABASE_URL_APP at minimum
npm run migrate         # applies app/src/db/migrations/*.sql, idempotent
npm run seed:profile    # seeds one demonstration business profile
```

Local dev used a real Postgres 16 server as a stand-in for Supabase (identical schema, portable SQL) — see `.env.example` for the two roles this expects (`groundline`, a superuser/table-owner used by `DATABASE_URL`; `groundline_app`, a lower-privilege role subject to Row Level Security, used by `DATABASE_URL_APP`). Provisioning both against a real Postgres/Supabase instance is a few `CREATE ROLE`/`GRANT` statements — see `docs/architecture/05-database-schema.md`.

## Ingest real data and run the pipeline

```bash
npm run ingest:fts        # live Find a Tender OCDS API — no key needed
npm run ingest:planning   # live planning.data.gov.uk — no key needed
npm run extract:run       # real Extraction+Verification agents — needs ANTHROPIC_API_KEY
                           # (without it: logs what would run and exits, never fabricates)
npm run seed:extraction   # transparent manual-extraction fallback used when no key is set —
                           # see the file's own header comment before trusting its output
npm run verify:evidence   # mechanically checks every 'verified' claim's quote against source text
npm run match:run         # deterministic matching + commercial calc — idempotent, safe to re-run
```

## Run the app

```bash
npm run dev   # http://localhost:3000 — demo login pre-filled on /login
```

## Test

```bash
npm test   # unit tests (pure logic) + integration tests against the real DB configured above
```

## What's real vs. not yet live

See `docs/architecture/04-implementation-status.md` — short version: ingestion, matching, commercial calculation, credits, and the web app are real and exercised against real live UK procurement data. Extraction/Verification and intelligence synthesis are real, tested code with an honest no-fabrication fallback when `ANTHROPIC_API_KEY` isn't set (true in this sandbox). Stripe billing is real, correct code that has never run against a live Stripe account.
