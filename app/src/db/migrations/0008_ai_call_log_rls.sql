-- Security audit finding (docs/architecture/08-evaluation-report.md §10):
-- ai_call_log references business_id but, unlike every other tenant-
-- referencing table, never got a Row Level Security policy — the same gap
-- 0005_analytics_rls.sql closed for analytics_events. No live exploit
-- exists today (only servicePool, which bypasses RLS, writes to it), but
-- the security architecture's own principle is isolation enforced at the
-- database layer, not contingent on every future code path remembering to
-- filter by business_id manually.
alter table ai_call_log enable row level security;

create policy tenant_isolation_ai_call_log on ai_call_log
  using (business_id = current_setting('app.business_id', true)::uuid);
