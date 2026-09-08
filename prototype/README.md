# Fleet Radar — interactive prototype

Phase 6 of `docs/EXECUTIVE_SUMMARY.md`: the interactive prototype built after the Go/No-Go review, following the UX spec in `docs/research/07-ux-design.md` and the data/scoring/provenance model in `docs/research/06-system-design.md`.

**Published as a Claude Artifact:** https://claude.ai/code/artifact/02d9866d-d2ce-46db-9f11-cdda21f23f06

`fleet-radar.html` is a single-file static prototype (no build step, no backend) — open it directly in a browser, or use the published Artifact link. All business logic (scoring, commercial calculations) is pre-computed demo data, not live code, since no real ingestion pipeline exists yet; see `docs/ENVIRONMENT_SETUP.md` for what a production build would need.

## What it demonstrates

- Onboarding/business profile (screen doubles as the editable Profile page, per the IA)
- Dashboard with stat tiles, an alert strip, and top matches
- Opportunity feed with fit-score filtering and empty states
- Opportunity detail: what's known vs. estimated, score breakdown, commercial analysis, full evidence table, status + feedback capture
- Pipeline (kanban by status)
- Data & Evidence page, disclosing exactly which sources are connected (Find a Tender, Companies House) vs. deliberately deferred (planning data, Environment Agency)

## What it is not

Not connected to any live data source, Supabase project, or Claude API. Every opportunity is clearly-labelled demonstration data modelled on real UK public procurement notice formats (Find a Tender / Contracts Finder), styled to be realistic, not sourced from live ingestion. Editing the business profile persists to the browser's local storage but does not re-run the matching/scoring engine — that logic is documented, not yet implemented as running code. See `docs/EXECUTIVE_SUMMARY.md` §15–17 for what happens next (the validation experiment) before any of this becomes production infrastructure.
