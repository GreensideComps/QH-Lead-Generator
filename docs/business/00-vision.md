# Groundline — Business Vision

## What Groundline is

An AI-native commercial opportunity intelligence company for UK construction, quarrying, aggregates, haulage, waste, and infrastructure businesses, aiming over time to operate with a small human team (owner as decision-maker) supported by AI agents across product, research, and eventually growth and operations.

## What's already decided and should not be re-litigated without new evidence

Everything in `docs/research/` and `docs/EXECUTIVE_SUMMARY.md`. In summary: the validated beachhead is a Midlands haulage/aggregates/muck-away operator profile; the MVP data sources are Find a Tender (OCDS) and Companies House; Supabase + Claude's own model tiers + Stripe Billing are the chosen stack (Shopify and OpenRouter were both evaluated and rejected for specific researched reasons); the AI agent count is deliberately small (2 agents: Extraction, Verification — everything else is deterministic code); and no outreach/marketing automation ships without a solicitor-reviewed legal basis, per `docs/research/03-legal-compliance.md`.

## What's new in this phase

The ambition to eventually run Groundline as an AI-native company — not just ship an AI-native *product* — with AI agents eventually handling growth, customer success, and operations, and a broader product surface (a capacity exchange, a commercial-intelligence layer that serves many customers from centrally-researched data). This is a legitimate long-term direction. It does not change anything about what should be built first: see `docs/product/00-product-scope.md` for sequencing.

## Owner's role

Per the CTO brief: owner as decision-maker, not full-time operator. Concretely, that means every AI agent added to this system (see `docs/agents/00-agent-architecture.md`) needs an explicit human-escalation rule and a cost/permission boundary from day one — "AI-native" is a target for how the company runs once it has customers and revenue, not a licence to let agents take unsupervised actions (spending money, contacting third parties, changing pricing) before there is a business to protect.

## Success markers for this phase

Unchanged from `docs/EXECUTIVE_SUMMARY.md` §16: technical success (reliable ingestion/extraction/matching with provenance), product success (operators say they'd use it), commercial success (operators name a price in range), strong validation (a surfaced opportunity changes a real commercial decision). Nothing about the Groundline rebrand or module expansion changes these gates.
