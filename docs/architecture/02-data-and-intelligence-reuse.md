# Data Architecture — Centralised Intelligence, Reused Across Customers

The CTO brief asks for opportunities to be researched once and matched to many customers, rather than re-researched per customer. This is a natural extension of the data model already designed in `docs/research/06-system-design.md` — it doesn't require a different architecture, just being explicit that the pipeline is customer-agnostic until the final matching step.

## The flow

```
Public source (FTS / Companies House / future: planning aggregator)
        |
        v
Ingestion workers (deterministic, scheduled — see docs/operations/00-background-jobs.md)
        |
        v
Entity resolution (deterministic: dedupe buyers/companies against existing Company rows)
        |
        v
Extraction Agent (Claude — structured fields + confidence, per docs/research/06-system-design.md)
        |
        v
Verification Agent (Claude — checks claims against source span)
        |
        v
Procurement / Requirement / Evidence tables (Supabase, Postgres)
   <- this is the reusable layer: one notice, extracted and verified ONCE ->
        |
        v
Matching engine (deterministic, runs PER CUSTOMER against the shared Procurement/Requirement data)
        |
        v
Commercial calc engine (deterministic, runs PER CUSTOMER using that customer's own rates)
        |
        v
Opportunity (customer-specific — score + commercial estimate + evidence trail)
```

**The expensive step (AI extraction + verification) happens once per notice, not once per customer.** A single Find a Tender notice that's relevant to five different haulage operators gets extracted and verified a single time; the matching and commercial-calculation steps (cheap, deterministic, customer-specific) run five times against that one shared `Procurement`/`Requirement` record. This is both the cost-control mechanism (AI calls scale with data volume, not with customer count) and the reusability mechanism the brief asks for.

## What this requires that the current schema doesn't yet have

- A **freshness/re-processing policy**: if a notice is amended after initial extraction, it needs re-extraction, not silent staleness. Add an `Procurement.raw_payload_hash` and a scheduled diff check as part of the ingestion worker (deterministic, no AI needed to detect a change — only re-run extraction if the hash changes).
- A **shared vs. customer-specific boundary enforced at the RLS layer**, not just in application code: `Procurement`/`Company`/`Requirement`/`Evidence` are readable by any authenticated customer (they're derived from public data); `Opportunity`/`Match`/`CommercialEstimate`/`Feedback` are scoped per-customer via Supabase Row Level Security. This was implied but not made explicit in `docs/research/06-system-design.md` — worth stating outright before the schema is implemented.
- **pgvector embeddings on `Procurement.description`** (and later, planning documents) to support semantic search across the shared corpus — e.g. "opportunities like this one" for a customer, or a research agent asking "have we seen anything like this before." This is genuinely justified now (Supabase ships pgvector by default, no extra service needed) but the embedding generation is itself a per-notice, not per-customer, cost — same reuse principle applies.

## What this does NOT require yet

A separate data warehouse, a dedicated vector database, or a graph database for the "opportunity graph" language in the brief. Postgres + pgvector, with the relational data model already designed, covers this at MVP-to-early-growth scale. Revisit only if/when query patterns genuinely can't be expressed relationally (e.g. multi-hop project→developer→contractor→supplier graph traversal at scale) — which is realistically a Contracts Exchange / Commercial Intelligence-phase problem (`docs/product/00-product-scope.md` stages 3–4), not a now problem.
