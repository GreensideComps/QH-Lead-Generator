# AI Growth Department — Roadmap (Deferred)

This is future infrastructure, written down now so it isn't lost, and deliberately not built yet. Building customer-acquisition automation before Groundline has a validated product, real usage data, or legal sign-off on outreach would be automating a guess.

## Why this is deferred, specifically

1. **No validated product yet.** `docs/EXECUTIVE_SUMMARY.md` is a conditional GO on a prototype + validation experiment, not a funded production build. Marketing content and outreach for a product that hasn't confirmed willingness-to-pay is wasted motion at best.
2. **No legal basis for outreach yet.** `docs/research/03-legal-compliance.md` is explicit: default to no outreach features until a solicitor has reviewed a Legitimate Interests Assessment, and default to corporate-subscriber contacts only even then. "Identifying commercial triggers" and "creating personalised outreach" (from the CTO brief) both touch this directly — they are not safe to automate without that review, regardless of how capable the underlying AI is.
3. **No usage data to target from.** Ideal-customer-profile identification and trigger-based outreach are only as good as the data behind them — right now that's zero real customers and zero real usage signal.

## What this looks like when it's actually triggered

Once Discover/My Opportunities are live with real customers (`docs/product/00-product-scope.md` stage 2) and legal sign-off exists:

| Capability (from the CTO brief) | What it needs to be safe & useful, not just possible |
|---|---|
| Identify ideal customer profiles | Real conversion/retention data from actual Groundline customers — not guessed from the market research alone |
| Find & research relevant businesses | Companies House (already integrated for the product itself) + the same provenance discipline as customer-facing intelligence — never present an AI-researched prospect fact as verified without a source |
| Score prospects, identify commercial triggers | Reuses the same matching-engine pattern already built for Discover — this is a genuine, low-effort extension once the core engine exists |
| Personalised outreach | **Gated on legal review.** Corporate-subscriber contacts only by default (`docs/research/03-legal-compliance.md`); a human approves the first send of any new outreach pattern before it runs unattended |
| Follow-ups, pipeline tracking | Needs a CRM-equivalent — deferred alongside this, see `docs/sales/00-sales-motion.md` |
| Marketing/SEO content | Lowest-risk item on this list (no personal data, no direct outreach) — could reasonably be brought forward ahead of the rest if genuinely useful pre-launch (e.g. content that supports the validation-phase discovery conversations), but still deferred here to keep this phase's scope honest |
| Channel monitoring, conversion analysis, churn signals | Needs PostHog (`ADOPT SOON` trigger: real users) wired in first |

## The one thing worth doing now

Nothing that runs unattended. If SEO/content marketing is wanted *during* the validation phase (to support outreach to the 8–12 discovery-conversation operators, not to acquire customers at scale), that's a human-directed, human-reviewed content task — not a reason to stand up agent infrastructure yet.
