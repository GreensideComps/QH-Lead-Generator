-- Documented in docs/architecture/03-ai-routing-strategy.md but never
-- actually implemented until now — this is the observability foundation
-- for "AI cost per unlock" / "average latency" / "model usage", and for
-- distinguishing a genuine API failure from a simple no-key skip.
create table if not exists ai_call_log (
  id uuid primary key default gen_random_uuid(),
  task text not null,               -- 'extraction' | 'verification' | 'synthesis'
  model text,                       -- actual model id returned by the API, null if not attempted
  status text not null check (status in ('success', 'api_error', 'invalid_response', 'skipped_no_key')),
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error_message text,
  procurement_id uuid references procurement(id),
  opportunity_id uuid references opportunities(id),
  business_id uuid references businesses(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_call_log_task on ai_call_log (task, created_at desc);
