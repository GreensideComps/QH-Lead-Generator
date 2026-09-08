-- Small geocoding cache. Real UK place lookups via postcodes.io (free,
-- keyless, ONS-derived, OGL-licensed — see src/lib/geocode.ts), cached here
-- so distance calculations are fast and don't re-hit the API every match run.
create table if not exists places (
  name text primary key,
  latitude double precision not null,
  longitude double precision not null,
  source text not null default 'postcodes.io',
  cached_at timestamptz not null default now()
);
