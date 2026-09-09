-- Award notices as a first-class source.
--
-- The tender-centric hypothesis is disproven: a tipper/muck-away operator
-- does not bid for public contracts, it subcontracts to whoever won one.
-- A tender notice therefore names nobody the operator can approach, while an
-- award notice names the winning contractor, carries the scheme value, and
-- lands months before subcontract packages are let.
--
-- These columns are additive and nullable so every existing tender-stage row
-- stays valid without backfill.

alter table procurement
  add column if not exists notice_stage text not null default 'tender'
    check (notice_stage in ('tender', 'award')),
  -- The winning contractor. The whole point of the award stage: this is the
  -- party an operator actually rings. Null on tender-stage rows.
  add column if not exists supplier_name text,
  add column if not exists award_value numeric,
  add column if not exists award_date date,
  -- Which bulk-material demand a scheme creates (haulage / aggregate_supply /
  -- waste / muck_away / earthworks). Deterministic classification — see
  -- src/ingestion/demandCategory.ts. Not an AI judgement.
  add column if not exists demand_categories text[] not null default '{}',
  -- 'direct'  = the scheme is itself earthmoving/aggregate/waste work
  -- 'derived' = a construction scheme that will generate that demand downstream
  add column if not exists demand_basis text
    check (demand_basis is null or demand_basis in ('direct', 'derived'));

create index if not exists idx_procurement_stage on procurement (notice_stage);
create index if not exists idx_procurement_supplier on procurement (supplier_name);
create index if not exists idx_procurement_demand on procurement using gin (demand_categories);
