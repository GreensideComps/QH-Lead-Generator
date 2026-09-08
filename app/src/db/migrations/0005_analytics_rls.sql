-- analytics_events is customer-scoped (business_id) and was missed from
-- the RLS pass in 0001_init.sql — every other tenant-scoped table has this;
-- analytics data is exactly the kind of thing that should never leak
-- cross-tenant through an application bug. Caught during web-layer
-- implementation when writing src/analytics/track.ts through withTenant.
alter table analytics_events enable row level security;

create policy tenant_isolation_analytics_events on analytics_events
  using (business_id = current_setting('app.business_id', true)::uuid);
