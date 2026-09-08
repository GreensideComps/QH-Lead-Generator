# Phase 1 Research — UK Public Data Sources

*Researched via live web search/fetch, September 2026. All claims sourced; unverifiable items explicitly marked "unknown."*

## Section A — Procurement

| Source | Data | Structured? | API | Bulk download | Update freq | Licence | Geography | Contact info |
|---|---|---|---|---|---|---|---|---|
| **Find a Tender Service (FTS)** | All above-threshold + (since 24 Feb 2025) most below-threshold UK contract notices — now the **single Central Digital Platform** under the Procurement Act 2023 | Yes | Yes — OCDS-native REST API (`ocdsReleasePackages`, `ocdsRecordPackages`), filterable | Yes — full JSON (~214MB)/CSV (~230MB) exports, year-by-year files, daily XML zips via data.gov.uk | Near real-time/daily | **OGL v3.0** — commercial reuse with attribution permitted | GB & NI; buyer org address per notice (not project-site geocoded) | GOV.UK support form |
| **Contracts Finder** | Legacy/transition notices, being absorbed into FTS post-Feb 2025 (verify current split before building — status is evolving) | Yes | Yes — REST, OAuth2 client-credentials, JSON/XML, OCDS-mapped | Yes — daily/date-range CSV | Daily | OGL | England-focused | GOV.UK support |
| **OCDS (Open Contracting Data Standard)** | UK adoption is real and mature via FTS/Contracts Finder | Yes | Yes (via above) | Yes | Effectively real-time at source | OGL | UK-wide | OCP registry (not UK govt) |
| **Local Government Transparency Code registers** | Council contracts >£5,000, published quarterly | Structured per-file | No central API | One CSV per council, own site | Quarterly | OGL, but **no central aggregator** — genuinely fragmented, inconsistent schemas | Per-council | Individual council teams |

**Verdict**: Procurement is the strongest MVP category. FTS is a genuine, documented, OCDS-compliant, OGL-licensed API with bulk export, materially improved by the Feb-2025 Procurement Act reform. Sources: [FTS API docs](https://www.find-tender.service.gov.uk/Developer/Documentation), [OCP registry — FTS](https://data.open-contracting.org/en/publication/41), [Central Digital Platform factsheet](https://www.gov.uk/government/publications/procurement-act-2023-short-guides/central-digital-platform-factsheet-html).

## Section B — Companies

| Source | Data | API | Rate limit | Licence | Contact |
|---|---|---|---|---|---|
| **Companies House API** | Profiles, officers, filings, charges, PSC, insolvency, **Streaming API** (real-time change feed), **bulk snapshot products** | Yes, REST, free | 600 req/5min default, higher on request | **OGL v3.0**, explicitly free for commercial use, attribution "good practice" not mandatory | CH developer forum |
| Construction-sector announcement feeds | Nothing centrally aggregated found beyond CH filing streams and listed-company RNS feeds (not relevant to SME haulage/aggregates) | — | — | — | — |

**Verdict**: Fully accessible, low-friction, genuinely free-for-commercial API — second-strongest category. Sources: [CH rate limiting](https://developer-specs.company-information.service.gov.uk/guides/rateLimiting), [CH streaming overview](https://developer-specs.company-information.service.gov.uk/streaming-api/guides/overview).

**Important operational caveat**: Companies House explicitly disclaims responsibility for how reused data is applied and states reusers are responsible for their own GDPR/copyright compliance — this pushes all downstream personal-data risk onto the product (see `03-legal-compliance.md`).

## Section C — Planning (the critical, most fragmented category — verify this carefully before committing to a roadmap)

| Source | Data | API | Bulk | Licence | Geography | Notes |
|---|---|---|---|---|---|---|
| **planning.data.gov.uk** | 100+ *spatial reference* datasets (conservation areas, listed buildings, brownfield, green belt, flood zones, Article 4, TPOs, AONB) — a context-layer platform, **not a live national planning-application feed** | Yes — REST (`/entity.json`, `/dataset.json`, OpenAPI spec) | Yes — CSV/GeoJSON/JSON/Parquet | **OGL v3.0**, Crown copyright, commercial reuse explicitly permitted | England only | Run by MHCLG Digital Planning Programme |
| **Planning-application data on planning.data.gov.uk** | A national planning-application spec exists but is **not mandatory** — only **73 of 311 local planning authorities** are onboarded to provide the 8 core datasets nationally | Same platform, once populated | Same | Same | Partial | **Key verified fact: real but genuinely partial today (under 25% of LPAs), not a comprehensive national feed. Coverage is growing but MVP cannot rely on it for full UK coverage in 2026.** |
| **Individual council planning portals** (Idox Public Access, Northgate Planning Explorer, Civica, OcellaWeb, Agile Planning, NI Portal, Acolnet, Swift) | Full live application registers (applicant, agent, site address, description, status, decision, documents) | **No official common API** — confirmed fragmentation: ~5–7 different portal software systems, no standard schema | No official bulk export | Publicly viewable under OGL, but each council's own site/terms | Per-council, all four nations separate | Genuinely fragmented, scrape-only at source |
| **Commercial aggregators**: Searchland, PlanNexus, PlanningAPI UK, LandHawk, PlanWire | Normalised planning-application data ingested from ~all UK council portals into one schema | Yes — commercial APIs | Yes | **Paid commercial licence** — e.g. Searchland: 23.9M applications since 1990, daily updates, up to 2-day lag, bespoke pricing | UK-wide (varies by vendor) | Viable **build-vs-buy** option — licensing a feed may be faster/cheaper than maintaining scrapers against 300+ council portals |
| **Planning Inspectorate / NSIP register** | Nationally Significant Infrastructure Project applications — case documents, examination stages, S51 advice | HTML register only; formal API/bulk export **not found — unknown, possibly nonexistent** (register page returned 403 on direct fetch) | Unknown | Presumed OGL, unverified for this specific portal | GB (England & Wales) | Low volume, high value for haulage/aggregates on major schemes; likely scrape-only at MVP |

**Verdict — planning is the weakest, most fragmented category, exactly as the brief anticipated.** planning.data.gov.uk is real, OGL-licensed, API-accessible — but a spatial-reference-layer platform, not yet a comprehensive live applications feed (~73/311 LPAs). Real UK-wide "live planning application" coverage at MVP requires either (a) building/maintaining per-council scrapers against 5+ portal systems with no common schema, or (b) licensing a commercial aggregator. **There is no free official shortcut at MVP stage.**

Sources: [planning.data.gov.uk performance page (73/311 LPAs)](https://planning.data.gov.uk/about/performance), [Searchland Planning API](https://searchland.co.uk/our-apis/planning-applications), [PlanNexus](https://plannexus.io/), [LandHawk](https://www.landhawk.uk/api/planning-application-data/), [NSIP register](https://infrastructure.planninginspectorate.gov.uk/projects/register-of-applications/).

## Section D — Other signals

| Source | Data | API | Licence | Notes |
|---|---|---|---|---|
| **Environment Agency Public Register (ePR)** | Environmental permits (installations, waste operations, water discharge), waste carrier/broker/dealer registrations, scrap metal licences, enforcement actions | API confirmed to exist at environment.data.gov.uk/public-register ("no requirement for registration" per api.gov.uk); exact schema not fully confirmed | **Environment Agency Conditional Licence** — distinct from standard OGL, needs full review before commercial redistribution | Directly relevant: waste/muck-away and quarrying permits are exactly EA-regulated activities — a strong signal source, but licence terms need solicitor review before building a paid product on it |
| **Local authority capital programmes / committee papers** | Forward capital spending plans, contract awards, infrastructure decisions | No | N/A | **Confirmed genuinely unstructured** — one-off PDFs per committee meeting, no structured feed, no aggregator found. Would require per-council PDF scraping/NLP, high fragility |
| **Find a Grant service** | Live/closed UK government grant opportunities incl. infrastructure-relevant ones | No public API confirmed — appears browsable-only | Unknown | Potentially relevant, but likely scrape-only |
| **Local Government Transparency Code contract registers** | Per-council CSVs of contracts >£5,000, quarterly | No central API | OGL, per-council | Same fragmentation problem as planning portals |

## Cross-cutting summary — accessibility tiers for MVP

**Tier 1 — genuinely API-accessible today, OGL-licensed, commercial reuse confirmed:**
- Find a Tender Service (OCDS API + bulk download) — strongest source, structurally improved by Feb-2025 reform
- Companies House (REST + streaming + bulk snapshots, explicit commercial-use confirmation)
- planning.data.gov.uk (for spatial context layers only — not live applications)

**Tier 2 — API exists but partial coverage/unclear licence, needs more diligence:**
- Contracts Finder (verify current status vs FTS before integrating both)
- Environment Agency Public Register API (exists, but under a distinct Conditional Licence)
- Find a Grant (public API unverified)
- Planning Inspectorate/NSIP register (no confirmed API — likely scrape-only, low volume, high signal)

**Tier 3 — no official API; scraping or paid third-party feed required:**
- Live planning applications at council level (genuinely fragmented, no common schema) — build/maintain per-council scrapers, or license Searchland/PlanNexus/LandHawk/PlanWire
- Local authority capital programmes / committee papers (unstructured PDFs, no aggregator)
- LGTC contract registers (structured CSV but no central aggregator)

## Practical implication for MVP sequencing

**Procurement (FTS/OCDS) and Companies House give a genuinely buildable, low-risk, commercially-licensed core within weeks.** Planning — the highest-value signal for haulage/aggregates/muck-away/plant-hire because it gives the earliest pipeline visibility — is the hardest: the official national platform is materially incomplete (73/311 LPAs), so real UK-wide planning coverage will most likely require **buying a feed from a commercial aggregator** rather than building council-by-council scrapers, unless the roadmap deliberately accepts partial coverage via planning.data.gov.uk's growing dataset as a starting point. Environment Agency and NSIP data are worthwhile secondary enrichment sources requiring further licence diligence.

**Recommendation for the MVP** (see `05-product-strategy.md`): build the core engine on Tier 1 sources (FTS + Companies House) first, since that proves the extraction→matching→commercial-analysis pipeline on a fully clean, low-risk dataset. Treat planning-signal ingestion as a fast-follow, likely via a paid aggregator rather than a from-scratch scraper build.
