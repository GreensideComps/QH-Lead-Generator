# Phase 1 Research — Market & Competitors

*Researched via live web search, September 2026. All claims are sourced. Anything unverifiable is explicitly marked "unverified" or "unknown" — do not treat it as fact.*

## 1. Is this a real market?

Yes, but it sits across **two separate, well-established markets** that the proposed product would need to straddle, and it is not currently occupied at their intersection.

- **Public-sector procurement intelligence** — crowded, many vendors, real VC money (Stotles raised a $13M Series A in May 2025; total disclosed raises $21.6M–$36.1M). [Tracxn](https://tracxn.com/d/companies/stotles/), [PitchBook](https://pitchbook.com/profiles/company/399142-72)
- **Private-sector construction/planning project intelligence** — dominated by two incumbents (Glenigan, Barbour ABI), both now part of Byggfakta Group (rebranded **Hubexo** in 2024), which itself is owned by PE (Stirling Square Capital Partners, TA Associates, Macquarie Capital). Glenigan alone was acquired for **£72.9m** in Dec 2020 — real institutional money is in this data category. [Glenigan press](https://www.glenigan.com/glenigan-acquired-by-byggfakta-group/), [Hubexo](https://hubexo.com/news/byggfakta-group-becomes-hubexo/)

**Real budget exists**: buyers of Glenigan/Barbour ABI report spending **£1,000–£50,000/year**, typically **£5,000–£10,000/year**. [SiteLens](https://sitelens.co.uk/compare/glenigan/), [Crucible](https://crucible.io/insights/marketing/barbour-abi-or-glenigan-comparing-construction-data-platform-2025/)

**Who currently pays**: main contractors, subcontractors, building-materials manufacturers, plant/tool hire, builders' merchants, FM and waste/recycling firms, and — on the procurement-intelligence side — enterprise bid teams selling into government (Tussell's named clients include Microsoft, Google, AWS, Capita, Serco, BT, EY, Jacobs — not SME haulage/aggregates operators).

**Important sector headwind (do not gloss over this):** UK aggregates demand is at a **12-year low**. The Mineral Products Association reports primary aggregates sales volumes in 2025 at their lowest since 2013, a fourth consecutive annual decline (−1.6% in 2025), "no sign of recovery," further deterioration forecast into 2026/27 (partially offset by projects like Sizewell C). [MPA](https://www.mineralproducts.org/News/2026/release02.aspx), [Agg-Net](https://www.agg-net.com/news/no-sign-of-recovery-in-construction-demand-warns-mpa)

This cuts both ways: it shrinks the addressable pool of new work, but raises the marginal value of a tool that helps a smaller operator win a larger share of a shrinking pie. It also means the target customer is currently under margin pressure — a harder sell for a new subscription cost unless ROI is obvious fast.

## 2–3. Named competitors, by category

### A. Public-sector procurement/tender intelligence (crowded, horizontal, AI-scoring is now table stakes)

| Product | Target customer | Pricing (public) | Data sources | Weakness for this niche |
|---|---|---|---|---|
| **Tussell** | Enterprise BD/bid teams selling into UK gov | G-Cloud listing from £11,400/licence/yr | UK gov contracts, spend data, 80k+ contacts | Public-sector-only, horizontal, enterprise price point |
| **Stotles** | SME→enterprise sales/bid teams | Free tier; £75–990/mo tiers; custom Expert | All UK public portals + buyer profiles + AI bid/no-bid reports | Public-sector only; AI is bid-drafting, not fleet-capability matching |
| **PSIP** | SME suppliers/bid agencies | From £199/mo | 5 official UK portals; 192,465 classified awards, £195.7bn tracked | **Closest functional analogue found** — uses AI (Claude) to score each tender 1–10 against a stored profile with visible reasoning. Public-tender-only; no planning data, no haulage/aggregates specialisation |
| **BidSkim** | UK suppliers | Free→£189/mo | UK portals; renewal/incumbent signals; ships an MCP server | Same AI-scoring model; public procurement only |
| **TenderLedger** | SME suppliers | £99–249/mo | 5 UK national sources | Public tenders only |
| **Tracker Intelligence, BidStats Insights, BiP/Delta eSourcing/DCI, CFP Analytics, D3 Tenders, Oscar Research, Spend Network, Civant, TenderAlpha** | Various bid/BD teams | Mixed, from ~£5,000/yr up | UK/EU public procurement | All public-sector-only, none construction-vertical or haulage-specific |

Comparative source: [Civensa — UK procurement tools, mapped](https://civensa.com/tools/procurement-intelligence/)

**Pattern**: this sub-market is now saturated with near-identical horizontal "AI relevance scoring" tender tools (PSIP, BidSkim, TenderLedger, D3 Tenders, BidStats all launched/relaunched this mechanic in the last 1–2 years). None ingest planning applications or private-sector project announcements — they are procurement-notice-only, which structurally excludes most haulage/muck-away/aggregates work, which is rarely formally tendered.

### B. Planning/construction-project intelligence (leads-focused, private + public projects)

| Product | Target customer | Pricing (public) | Data sources | Notes |
|---|---|---|---|---|
| **Glenigan** (Hubexo/Byggfakta) | Main contractors, manufacturers, plant hire, specialist contractors | Not published; typically £5,000–£10,000/yr | Planning Portal early access, 160 human researchers, 1M+ calls/yr, 593,816 live projects tracked | Strong, researcher-verified, expensive, sales-call-gated; no aggregates/haulage-specific filtering found |
| **Barbour ABI** | Subcontractors, main contractors, plant/tool hire, manufacturers, FM, recruiters | Not published; 10 free leads trial | 1.6M live opportunities, AI search, verified contacts, win/loss data | Generic; no fleet/capability matching. *(Exact ownership link to Glenigan/Hubexo not independently confirmed — flag as unverified.)* |
| **SiteLens** | SMEs/regional suppliers priced out of the big two | Free tier; £29–99/mo, monthly rolling | 380+ UK councils, auto trade/value classification, constraint flags, Companies House matching | **Direct evidence that cheap, self-serve, AI-classified planning-data disruption of Glenigan/Barbour ABI is already happening** — a useful pricing/GTM comparator |
| **PlanWire** | Developers building on planning data (API-first, infrastructure play) | Free sandbox; £49–499/mo | Every UK council's applications/decisions, normalised API, webhooks | Not an end-user sales tool — a raw-data layer a new entrant could build on rather than researching from scratch |
| **Searchland, LandInsight (LandTech)** | Land agents/developers sourcing sites | £195/mo+ (Searchland) | Planning applications, ownership, constraints | Land-acquisition-focused, not a supply-chain sales tool |
| **Construction Enquirer** | Whole industry readership | Free to read; ads from £100/wk | Editorial/breaking news | Trade press, not an intelligence/matching platform |

### C. Company/contact intelligence (general B2B, not construction-specific)

Cognism and ZoomInfo are the generic players; no construction- or haulage-specific contact-intelligence vendor distinct from these was found. Construction BD teams appear to layer generic contact data on top of Glenigan/Barbour ABI project data manually.

### D. Marketplaces / capability-matching adjacent to haulage & materials

| Product | What it actually is | Relevance/gap |
|---|---|---|
| **TipperLink** | "UK's only digital exchange built exclusively for tipper and grab haulage." Free to join; hauliers pay a 3.5% fee per completed load | **Closest named real-world haulage-specific product** — but it's a *reactive transactional load marketplace*, not an upstream intelligence/monitoring product. It surfaces a load only after it's posted; it does not watch planning-consent-to-groundworks-start signals ahead of demand. Complementary to, not a competitor of, the proposed product. |
| **Haulage Exchange / HaulageHub** | General freight load-board | Not construction/aggregates-specific, transactional only |
| **Excess Materials Exchange (EME)** | B2B surplus-materials reuse marketplace (e.g. Enfield Council pilot) | Narrow adoption, circular-economy focus, not a sales-opportunity radar |
| **Herbst Software / Access Weighsoft** | Quarry/haulage back-office ERP (weighbridge, scheduling, invoicing) | Confirms quarrying/haulage firms already pay for vertical SaaS — but this is operations software, not front-of-funnel opportunity discovery. Nobody has built the sales/BD-intelligence layer on top. |

### E. Quarrying/aggregates-specific commercial intelligence — explicit finding

**No dedicated commercial-opportunity-intelligence product targeting quarrying, aggregates, or muck-away/tipper haulage businesses specifically was found.** Closest adjacents: **Agg-Net** (industry news/jobs board, not a sales tool), **letsrecycle.com** (trade-press tender news), **MPA** (macro market statistics, not per-company opportunity feed).

### Items explicitly checked and found NOT to exist / unverified
- **"Cerealto"** as a UK construction procurement platform — not found; resolves to an unrelated Spanish food-manufacturing company. Treat as not real.
- **"Radius Data"** as a discrete UK planning-intelligence brand — not confirmed; closest matches (EG Radius, an unrelated Radius Group, a US fleet-mobility company) don't fit. Treat as unverified/likely doesn't exist as described.
- Marketing statistics such as "48% of construction businesses use data analytics" — sourced only to low-authority content-mill sites, **not cited** as fact anywhere in this report.

## 4. Market gap analysis

**A real, narrowly-bounded white space appears to exist**, on four structural grounds:

1. **Nobody merges planning + procurement + private project-announcement signal into one feed.** Procurement tools are hard-scoped to public tender notices; planning tools are hard-scoped to planning applications/projects. Nobody combines both plus private, non-tendered signals (site clearance starting, groundworks contractor appointed, demolition notice) — which matter disproportionately to haulage/aggregates/muck-away, most of whose work is won by relationship/reactive quoting, never a formal tender.
2. **Nothing does true capability/fleet matching.** Existing AI-scoring tools (PSIP, BidSkim) score against a "sector/CPV code" profile. None extend to vehicle/plant type, payload/tonnage, licensed waste-carrier category, haul radius, or material type — the actual operating parameters of a haulage/quarrying business. This is the concrete, defensible design gap.
3. **The closest haulage-specific product (TipperLink) is reactive, not predictive.** It sits downstream of where this product would sit — arguably complementary, feeding TipperLink-style transactions once an opportunity is validated.
4. **The aggregates trade press is descriptive, not operational.** No incumbent has vertical mind-share in this niche the way Glenigan/Barbour ABI have in general construction.

**Countervailing risks — read carefully:**
- Glenigan's moat is 160 human researchers verifying data; a scraping/AI-only entrant is exposed to the same "cheap but less trustworthy" critique SiteLens already markets against.
- The niche buyer base (haulage/muck-away/aggregates SMEs willing to pay a SaaS subscription, vs. relying on relationships/TipperLink/free trade press) is likely a few hundred to low-thousands of companies nationally — a real but narrow wedge, not obviously VC-scale unless it expands into adjacent trades (groundworks, demolition, plant hire, waste haulage).
- **Incumbents could add this as a feature, not a new product.** Glenigan/Barbour ABI already hold most of the raw planning/project signal; a "haulage/aggregates capability filter" is a plausible feature add for them. That they haven't built it is a timing opportunity, not proof of a durable moat.
- **Willingness to pay is unverified.** No evidence was found of quarrying/haulage/muck-away companies currently paying for *any* dedicated commercial-intelligence subscription (as distinct from operational ERP, which they clearly do pay for). This is the single biggest untested assumption behind the business case.

## Summary judgement

The general market (construction/procurement intelligence) is real, evidenced, and commercially active. At the specific intersection proposed — AI-matched, capability-specific, planning+procurement+private-signal radar for haulage/aggregates/quarrying/muck-away — **no directly competing named product was found**. The gap looks real. But the addressable niche is narrow and currently contracting, and willingness-to-pay for this specific capability is unverified. That should be the first thing tested with real target customers, not assumed.
