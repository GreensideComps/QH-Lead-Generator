-- requirements.procurement_id was NOT NULL and FK'd only to procurement —
-- fine while only procurement notices were extracted, but planning_signals
-- need the same "known facts with provenance" shape (see
-- src/matching/planningNormalize.ts). Mirrors the same either/or pattern
-- already used for opportunities in 0001_init.sql, rather than a second
-- table for the same concept.
alter table requirements alter column procurement_id drop not null;
alter table requirements add column if not exists planning_signal_id uuid references planning_signals(id) on delete cascade;
alter table requirements add constraint requirements_source_check
  check (procurement_id is not null or planning_signal_id is not null);

create index if not exists idx_requirements_planning_signal on requirements (planning_signal_id);
