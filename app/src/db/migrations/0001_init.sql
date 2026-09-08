-- Groundline — initial schema
-- Postgres-compatible; written for local dev Postgres, designed to run
-- unmodified against a Supabase project (Supabase IS Postgres).
-- See docs/architecture/05-database-schema.md for the narrative version.

create extension if not exists pgcrypto;

-- ============================================================
-- Accounts
-- ============================================================

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists user_businesses (
  user_id uuid not null references users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  primary key (user_id, business_id)
);

-- One profile per business. Fleet and rates kept as jsonb: this is a single-
-- tenant-authored, low-cardinality structure (a handful of vehicle types, a
-- handful of rate fields) — a normalised fleet table is unjustified complexity
-- at this scale; revisit only if fleet data needs independent querying.
create table if not exists business_profiles (
  business_id uuid primary key references businesses(id) on delete cascade,
  services text[] not null default '{}',
  fleet jsonb not null default '[]',            -- [{type, count}]
  base_location text,
  operating_radius_miles integer,
  capacity_available integer,
  min_opportunity_value numeric,
  preferred_sectors text[] not null default '{}',
  rates jsonb not null default '{}',             -- {payload, pricePerTonne, pricePerMile, fuelPerMile, driverPerDay, minMargin}
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Shared, publicly-derived data (reused across every business —
-- see docs/architecture/02-data-and-intelligence-reuse.md)
-- ============================================================

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  company_number text unique,
  name text not null,
  sector text,
  registered_address text,
  status text,
  source_url text,
  last_synced_at timestamptz
);

create table if not exists procurement (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('find_a_tender', 'contracts_finder')),
  external_id text not null,
  title text not null,
  description text,
  buyer_name text,
  buyer_company_id uuid references companies(id),
  value_low numeric,
  value_high numeric,
  currency text default 'GBP',
  location_text text,
  deadline date,
  published_date date,
  contract_period_text text,
  cpv_codes text[] not null default '{}',
  source_url text not null,
  raw_payload jsonb not null,
  raw_payload_hash text not null,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
create index if not exists idx_procurement_deadline on procurement (deadline);
create index if not exists idx_procurement_published on procurement (published_date desc);

-- Planning-derived signals. NOTE: this is deliberately NOT "planning
-- application" data — per docs/research/02-data-sources.md, live planning
-- applications are only covered for 73/311 UK local authorities nationally,
-- so this project does not claim national planning-application coverage.
-- What IS real and keyless today is planning.data.gov.uk's spatial reference
-- datasets (brownfield land, article 4 directions, etc.) — ingested here as
-- a contextual planning *signal*, not a tender-equivalent opportunity.
create table if not exists planning_signals (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'planning_data_gov_uk',
  dataset text not null,                 -- e.g. 'brownfield-land'
  external_id text not null,
  name text,
  entity_type text,
  location_text text,
  organisation text,
  documentation_url text,
  source_url text not null,
  raw_payload jsonb not null,
  raw_payload_hash text not null,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, dataset, external_id)
);

-- One row per extracted field per procurement notice. field-level provenance,
-- not row-level — see docs/research/06-system-design.md.
create table if not exists requirements (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references procurement(id) on delete cascade,
  field_name text not null,
  value_text text not null,
  confidence text not null check (confidence in ('verified', 'calculated', 'customer_provided', 'estimated', 'inferred', 'unknown')),
  source_span text,
  extracted_by text not null,             -- e.g. 'claude-api-production' | 'claude-code-manual-session'
  extracted_at timestamptz not null default now()
);
create index if not exists idx_requirements_procurement on requirements (procurement_id);

-- ============================================================
-- Customer-specific data (tenant-scoped; RLS below)
-- ============================================================

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  procurement_id uuid references procurement(id) on delete cascade,
  planning_signal_id uuid references planning_signals(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'interested', 'contacted', 'won', 'lost', 'not_relevant')),
  recommendation_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (procurement_id is not null or planning_signal_id is not null)
);
create index if not exists idx_opportunities_business on opportunities (business_id);

create table if not exists matches (
  opportunity_id uuid primary key references opportunities(id) on delete cascade,
  service_score integer not null,
  fleet_score integer not null,
  geography_score integer not null,
  capacity_score integer not null,
  commercial_score integer not null,
  sector_score integer not null,
  total_score integer not null,
  weights_used jsonb not null,
  positive_factors text[] not null default '{}',
  negative_factors text[] not null default '{}',
  unknown_factors text[] not null default '{}',
  computed_at timestamptz not null default now()
);

create table if not exists commercial_estimates (
  opportunity_id uuid primary key references opportunities(id) on delete cascade,
  estimated_loads numeric,
  estimated_revenue numeric,
  estimated_cost numeric,
  estimated_contribution numeric,
  estimated_margin_pct numeric,
  revenue_basis text not null check (revenue_basis in ('verified', 'calculated', 'estimated', 'unknown')),
  rate_inputs_used jsonb,
  calculation_basis text not null default 'customer_rate',
  note text,
  computed_at timestamptz not null default now()
);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  claim text not null,
  value_text text not null,
  confidence text not null check (confidence in ('verified', 'calculated', 'customer_provided', 'estimated', 'inferred', 'unknown')),
  source_type text,
  source_url text,
  source_span text,
  created_at timestamptz not null default now()
);
create index if not exists idx_evidence_opportunity on evidence (opportunity_id);

create table if not exists feedback (
  opportunity_id uuid primary key references opportunities(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  match_was_correct boolean,
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Credits & billing (Stripe writes only via docs/security rules —
-- see docs/architecture/00-groundline-architecture.md)
-- ============================================================

create table if not exists credits (
  business_id uuid primary key references businesses(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  delta integer not null,
  reason text not null,                    -- 'signup_grant' | 'intelligence_unlock' | 'stripe_purchase' | 'manual_adjustment'
  opportunity_id uuid references opportunities(id),
  stripe_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_unlocks (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  credits_spent integer not null,
  content jsonb not null,
  unlocked_at timestamptz not null default now(),
  unique (opportunity_id, business_id)
);

-- ============================================================
-- Operational / observability
-- ============================================================

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  records_fetched integer not null default 0,
  records_new integer not null default 0,
  records_updated integer not null default 0,
  error_text text
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id),
  user_id uuid references users(id),
  event_type text not null,
  opportunity_id uuid references opportunities(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_analytics_events_type on analytics_events (event_type, created_at desc);
create index if not exists idx_analytics_events_business on analytics_events (business_id, created_at desc);

-- ============================================================
-- Row Level Security (tenant isolation)
-- Pattern: app sets `SET LOCAL app.business_id = '<uuid>'` per request
-- (see src/db/withTenant.ts). On Supabase this maps directly onto
-- auth.uid()-keyed policies instead — same isolation principle, documented
-- in docs/security/00-security-architecture.md.
-- ============================================================

alter table opportunities enable row level security;
alter table matches enable row level security;
alter table commercial_estimates enable row level security;
alter table evidence enable row level security;
alter table feedback enable row level security;
alter table credits enable row level security;
alter table credit_transactions enable row level security;
alter table intelligence_unlocks enable row level security;

create policy tenant_isolation_opportunities on opportunities
  using (business_id = current_setting('app.business_id', true)::uuid);
create policy tenant_isolation_matches on matches
  using (opportunity_id in (select id from opportunities where business_id = current_setting('app.business_id', true)::uuid));
create policy tenant_isolation_commercial_estimates on commercial_estimates
  using (opportunity_id in (select id from opportunities where business_id = current_setting('app.business_id', true)::uuid));
create policy tenant_isolation_evidence on evidence
  using (opportunity_id in (select id from opportunities where business_id = current_setting('app.business_id', true)::uuid));
create policy tenant_isolation_feedback on feedback
  using (business_id = current_setting('app.business_id', true)::uuid);
create policy tenant_isolation_credits on credits
  using (business_id = current_setting('app.business_id', true)::uuid);
create policy tenant_isolation_credit_transactions on credit_transactions
  using (business_id = current_setting('app.business_id', true)::uuid);
create policy tenant_isolation_intelligence_unlocks on intelligence_unlocks
  using (business_id = current_setting('app.business_id', true)::uuid);

-- The service role (ingestion workers, migrations, admin scripts) bypasses
-- RLS via a superuser/BYPASSRLS role, exactly as the Supabase service-role
-- key does in production — see src/db/pool.ts for the two connection modes.
