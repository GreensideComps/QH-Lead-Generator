-- Bug fix: 0001_init.sql never enforced that a business can only have ONE
-- opportunity per procurement notice / planning signal. Without this,
-- re-running the matching engine (src/matching/run-matching.ts) created a
-- fresh duplicate opportunity row on every run instead of upserting the
-- existing one, since its `on conflict do nothing` had nothing to conflict
-- on. Found via a real re-run during development, not theoretical.

create unique index if not exists uq_opportunities_business_procurement
  on opportunities (business_id, procurement_id)
  where procurement_id is not null;

create unique index if not exists uq_opportunities_business_planning_signal
  on opportunities (business_id, planning_signal_id)
  where planning_signal_id is not null;
