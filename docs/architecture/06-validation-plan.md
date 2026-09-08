# Validation Plan — Instrumentation

Extends `docs/EXECUTIVE_SUMMARY.md` §15 (the validation experiment) with the concrete instrumentation now built to support it.

## What's tracked, and why

Every event below is a real row in `analytics_events` (`app/src/analytics/track.ts`), written by real user actions, RLS-scoped per business:

| Event | Written when | Answers |
|---|---|---|
| `opportunity_viewed` | A customer opens an opportunity detail page | Which opportunities get looked at at all |
| `match_viewed` | Same moment (kept separate in case the UI later shows the score without the full detail page) | Whether score visibility alone drives engagement |
| `search_performed` | A Discover search/filter is run | Whether customers browse or rely on the curated feed |
| `opportunity_saved` | Status set to `interested` | A real, if soft, signal of relevance |
| `opportunity_unlocked` / `intelligence_consumed` | A credit is spent | The strongest signal: a customer paid attention with something that cost them |
| `recommended_action_viewed` | The unlocked recommendation is shown | Whether the synthesis step is actually being read |
| `customer_returned` | Login | Retention, trivially |
| `credit_purchased` | Stripe webhook grants credits | Willingness to pay, in-product (distinct from the price-hypothesis conversations in `docs/EXECUTIVE_SUMMARY.md`) |
| `opportunity_exported` | Reserved, not yet wired to a UI action in this phase | Future: sharing behaviour |
| `contact_info_viewed` | Reserved, not yet applicable | No contact-route data exists yet (no Companies House key) — event type exists in the schema for when it does |

## The question this is built to answer

*"Which intelligence actually causes customers to take action?"* — joinable today: `analytics_events.opportunity_id` → `matches.total_score` / `positive_factors` / `negative_factors` → did an `opportunity_unlocked` or `opportunity_saved` event follow. With enough real usage, this answers whether high-scoring opportunities are actually the ones customers act on, or whether the scoring weights (`docs/research/06-system-design.md` — an explicit hypothesis, not a researched constant) need retuning.

## What this does not replace

The 8–12 direct operator conversations in `docs/EXECUTIVE_SUMMARY.md` §15 are still the fastest way to learn whether anyone will pay — in-product analytics only start being informative once real customers are using the product, which hasn't happened yet. This instrumentation is ready for that moment, not a substitute for the conversations that come first.
