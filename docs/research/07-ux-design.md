# Phase 4 — UX Design Specification

Scoped to the MVP defined in `05-product-strategy.md`. This is the spec the eventual Artifact prototype should follow.

## Information architecture

```
Onboarding (first run only)
  -> Business Profile (services, fleet, geography, capacity, rates, preferences)
  -> Dashboard (home)
       -> Opportunity Feed (list/filter/sort)
            -> Opportunity Detail
       -> Pipeline (kanban-style: New / Interested / Contacted / Won / Lost / Not relevant)
       -> Business Profile (editable, same form as onboarding)
       -> Data & Evidence (per-source transparency: what's ingested, when, from where)
```

Six persistent nav destinations post-onboarding: Dashboard, Opportunities, Pipeline, Profile, Data Sources, (Settings — rates/thresholds, minimal for MVP).

## User journey

1. First-time user completes Business Profile (services → fleet → geography/radius → capacity → commercial rates → preferred sectors). Nothing is inferred here — it's all direct customer input, explicitly the "customer-specific data" provenance tier.
2. Dashboard shows headline numbers (new opportunities, high-priority count, estimated addressable value, items needing action) plus an alert strip for anything time-sensitive (near-deadline high-fit opportunities).
3. User opens the Opportunity Feed, sorted by fit score by default, scans cards.
4. User opens an Opportunity Detail to see the full evidence trail, score breakdown, and commercial estimate before deciding.
5. User marks status (Interested/Contacted/Won/Lost/Not relevant) and optionally leaves feedback on whether the match was correct — this closes the loop the brief requires for eventual model improvement.
6. Pipeline view lets the user see everything they've actioned, by status, at a glance.

## Dashboard design

Header: company name, total tracked opportunities, estimated addressable value, alert count.

Primary metrics row (four stat tiles, matching the brief's suggested shape):
- New opportunities (this period)
- High-priority (score above a configurable threshold)
- Estimated addressable value (sum of calculated/estimated revenue across open opportunities — labelled as a range, not a false-precision single number)
- Opportunities requiring action (approaching deadline, unactioned)

Below: the opportunity feed, same card component used in the full feed view, showing the top N by score.

## Opportunity card (feed view)

Each card shows, in this priority order (score first — the brief is explicit that fit/risk must be immediately visible):
- Fit score (numeric + visual, e.g. a bar or ring — not decorative, must be scannable at a glance across many cards)
- Title / opportunity type (procurement notice title, tagged as "Tender" for MVP scope)
- Location + distance from customer's base
- Estimated value (with its provenance label — Verified/Calculated/Estimated — visible on the card, not hidden behind a click)
- Key extracted requirements (2-3 line summary: service type, scale, deadline)
- Confidence indicator (aggregate of the underlying evidence — if most claims are Unknown/Inferred, the card should visibly say so, not present false confidence)
- Recommended action (short imperative, e.g. "Review before deadline," "Investigate — high fit, unconfirmed value")

## Opportunity detail page

Sections, in this order:
1. **Overview** — title, buyer, location, deadline, at-a-glance score.
2. **What we know** — Verified facts only, each with its source link.
3. **What we estimate** — Calculated and Estimated/Inferred values, clearly separated from "What we know," each showing its calculation basis (e.g. "480 loads = 18,000 tonnes ÷ your configured 37.5-tonne payload").
4. **Why you match** — the six-dimension score breakdown from `06-system-design.md`, each dimension showing the specific comparison made (e.g. "Geography: 42 miles, within your 100-mile radius").
5. **Operational requirements** — extracted service/vehicle/material/duration fields, each with a confidence label.
6. **Commercial analysis** — estimated loads, revenue, cost, contribution, margin, all computed from the customer's own configured rates, with those rates shown alongside the output so the calculation is auditable, not a black box.
7. **Companies involved** — buyer (from the source notice) and any Companies House-enriched detail (registered status, sector) — no invented contacts.
8. **Timeline** — published date, deadline, contract period, all Verified-labelled or explicitly "not stated."
9. **Source evidence** — the full Evidence list for this opportunity, one row per claim, exactly matching the `Evidence` table in the data model — this is the page section that makes the whole trust model tangible to the user, not an afterthought.
10. **Recommended action** — one clear imperative sentence, with confidence.
11. Status control (Interested/Contacted/Won/Lost/Not relevant) + feedback capture ("was this match right?").

## Onboarding flow

A short, linear wizard, not a long form dumped on one screen:
1. Company name + primary services (multi-select from a fixed vocabulary, not free text, so it can be matched deterministically later).
2. Fleet (vehicle type + count, repeatable rows).
3. Operating geography (base location + radius).
4. Capacity (available vehicles/tonnage — simple numeric input, framed as "how much of your fleet is available for new work," not asked to model complex scheduling at MVP).
5. Commercial rates (payload, price basis, fuel/driver cost, minimum margin, minimum attractive opportunity value) — explicitly optional to skip individual fields, with the product clearly stating that skipped fields mean commercial estimates will show as "Unknown" rather than guessed.
6. Preferred sectors (multi-select).
Confirmation screen showing the completed profile before it goes live, since this profile drives every downstream match.

## Empty, loading, and error states (required, not optional per the brief's build-quality bar)

- **Empty feed** (no matches yet, or profile too narrow): explain why, not just "no results" — e.g. "No opportunities currently match your profile. This usually means either there's genuinely nothing in scope this week, or your radius/services are set narrowly — review your profile." This matters specifically because "precision over volume" means empty states will be common and must not read as a broken product.
- **Loading**: skeleton cards matching the real card layout, not a generic spinner, so the layout doesn't jump.
- **Data source outage/stale data**: the Data & Evidence page should show last-successful-sync time per source, and the dashboard should visibly flag if ingestion has gone stale (e.g. "Procurement data last updated 3 days ago" if the ingestion worker has failed) — silent staleness is a trust failure in exactly the way the brief warns against.
- **Error in extraction/verification**: if the Verification Agent rejects an extracted field, the UI shows "Unknown" for that field rather than surfacing an error to the customer — extraction failures are an internal data-quality signal, not a user-facing error state.

## Visual design system direction

Brand personality per the brief: intelligent, industrial, trustworthy, commercial, data-driven, fast, practical. Concretely:
- **Typography**: a functional sans (e.g. Inter/IBM Plex Sans-class) for UI text, tabular figures for all numeric data (scores, £ values, tonnages) so columns of numbers align — this matters more than it sounds for a data-dense B2B dashboard.
- **Colour**: a restrained, mostly neutral palette (charcoal/slate greys, off-white background) with a small set of functional colours reserved for meaning, not decoration — e.g. one colour for high-fit/urgent, one for the provenance-label system (Verified/Calculated/Estimated/Unknown each need a visually distinct, consistently-used treatment across every screen, not just badges invented per-page).
- **Density**: information-dense by design (this is a working tool, not a marketing page) — avoid the brief's explicitly-flagged anti-patterns: no gradients as decoration, no glow/neon "AI" styling, no illustration-heavy empty states, no large decorative whitespace blocks.
- **Iconography**: functional only (vehicle type icons, confidence-level icons) — never used to imply the product is "AI-flashy" rather than a serious operational tool.
- **Motion**: minimal — state transitions (status change, card expand) may animate briefly for clarity, nothing decorative or attention-seeking.

This direction is what the eventual Artifact prototype should be built to, once the strategy in this document set is approved.
