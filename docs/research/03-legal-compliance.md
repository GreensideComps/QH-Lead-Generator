# Phase 1 Research — Legal / Data / Compliance

*This is NOT legal advice. It identifies risk areas, open questions for a solicitor, and safer architecture defaults, based on real research into current UK rules (September 2026).*

## 1. Open Government Licence (OGL v3.0)

OGL permits copying, publishing, distributing, adapting and exploiting licensed information **commercially and non-commercially**, including combining it with other data or building it into a product. Requires attribution (either the provider's specified statement, or the default: *"Contains public sector information licensed under the Open Government Licence v3.0"*).

**Excluded from OGL scope**: personal data within the information; information not released under FOI/publication schemes; government logos/crests; other IP rights the provider doesn't own; no endorsement implied.

**Source**: [OGL v3.0, nationalarchives.gov.uk](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)

**Architecture implication**: OGL covers the *dataset structure itself*, not personal data embedded within it (a named case officer, a sole trader's home address on a planning form). OGL clearance ≠ GDPR clearance — these are two separate, stacked compliance questions. Build attribution into the product footer from day one.

## 2. Contracts Finder / Find a Tender API terms

Contracts Finder data is OGL-published and described by the Open Contracting Partnership registry as commercially reusable with attribution. **The Contracts Finder API docs page itself contains no explicit licensing statement — only technical specs.** FTS's API docs page returned a 503 during this research and could not be directly verified.

**Architecture implication**: Don't assume — confirm in writing (GDS/Cabinet Office, or the licence footer shown on actual API responses) that API-retrieved data carries the same OGL terms as the web UI, and that FTS (newer, post-Brexit) hasn't diverged from Contracts Finder's terms. Log the licence statement shown at time of ingestion in case terms change.

## 3. UK GDPR / PECR for scraped business-contact and named-individual data

**Storing/processing:**
- Scraped personal data (a named individual on a planning application) is personal data under UK GDPR **even though it's publicly available** — "public" does not exempt it from GDPR. Commentary is unanimous on this.
- Because the data isn't collected *from* the individual, **Article 14** applies (info to be provided when data isn't obtained from the data subject) — proactive notice is generally required unless a narrow "disproportionate effort" exemption applies (Art 14(5)(b)), which requires a documented proportionality assessment and still requires published privacy information.
- The ICO's generative-AI consultation series (2024–2025) treats **legitimate interests as the only plausible lawful basis** for scraping personal data into AI processing, requiring the full three-part test (purpose, necessity, balancing) — including whether scraping is actually necessary versus a licensed/official-API alternative.

**Source**: [ICO — lawful basis for web scraping for generative AI](https://ico.org.uk/about-the-ico/what-we-do/our-work-on-artificial-intelligence/response-to-the-consultation-series-on-generative-ai/the-lawful-basis-for-web-scraping-to-train-generative-ai-models/), [ICO Article 14 exemptions](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/the-research-provisions/exemptions/)

**Future outreach/marketing:**
- PECR's electronic-marketing rules **don't apply to "corporate subscribers"** (most limited companies) — B2B email to a generic company inbox is largely a PECR non-issue. But **sole traders, partnerships, and named individuals count as "individual subscribers"**, and PECR consent/soft-opt-in rules apply to them.
- Under UK GDPR itself, B2B marketing commonly relies on legitimate interests, but requires a documented Legitimate Interests Assessment (purpose, necessity, balancing against the individual's reasonable expectations), clear identification of who's marketing and why, and an easy opt-out.
- Legitimate interests is more defensible where the contact is a business role/professional capacity and the individual would reasonably expect this kind of contact; **less defensible** for scraping a private individual's data from a planning application (e.g., a homeowner's extension) for sales outreach — a materially different, less-expected purpose than why the data was published.

**Source**: [ICO — B2B marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/)

**Architecture implication**:
- Separate "fact about a project/contract" (low risk — company names, values, dates) from "named individual's personal contact details" (materially higher risk) at the **data model level**, so the latter can be gated behind extra controls.
- Don't let AI extraction silently repurpose planning-application personal data (submitted for a regulatory purpose) into a sales-contact database without a distinct legal-basis assessment.
- **Default to not enabling outreach features on individual (non-corporate) contacts** until a solicitor has signed off on an LIA. Default to corporate-entity-level contacts (company name, registered office, generic enquiries address) where possible instead of named individuals.
- Build a privacy notice and a realistic data-subject-rights mechanism (access/erasure/objection) — an explicit ICO expectation for AI systems using scraped personal data.

## 4. Web scraping legal risk in the UK generally

**Copyright/database right**: UK has copyright (protecting original selection/arrangement) plus a separate **sui generis database right** (Copyright and Rights in Databases Regulations 1997) protecting *substantial investment* in obtaining/verifying/presenting a database — independent of creativity. Infringement covers extraction of a substantial part, **and repeated extraction of small parts that cumulatively amount to a substantial part** — directly relevant to systematic/repeated scraping of a site over time.

**Terms-of-service risk**: The standard reference case is **hiQ Labs v LinkedIn** (US, settled Dec 2022) — ultimately decided on breach-of-contract grounds; a scraping-prohibition clause in accepted terms of use was held enforceable, hiQ was permanently enjoined and paid $500k. Not binding UK precedent, but the standard analogy commentators use — UK courts would likely treat similar clauses as enforceable contract terms (breach of contract, injunctions/damages, reputational risk), not a criminal matter.

**Architecture implication**: Check ToS/robots.txt for every scrape target; prefer official APIs/open-data feeds over HTML scraping wherever they exist (sidesteps both database-right and contract-breach risk); where scraping a non-API source is unavoidable, keep it to genuinely public pages with no login/click-through ToS, scrape lightly, and get specific solicitor sign-off on individual target sites before launch.

## 5. Companies House / planning-portal specific restrictions

**Companies House**: OGL-licensed, free, no commercial-use ban — but **rate-limited** (600 req/5min default), and the searchable web database is explicitly **not intended for bulk downloads** ("not intended to be a source for bulk downloads due to equipment and bandwidth limitations" — use the separate bulk data products instead). Companies House explicitly **disclaims responsibility for how the data is used** and states reusers are responsible for their own data-protection/copyright compliance.

**Source**: [CH Service Information](https://resources.companieshouse.gov.uk/serviceInformation.shtml), [CH Developer Guidelines](https://developer.company-information.service.gov.uk/developer-guidelines)

**Planning portal data**: No single national "Planning Portal API terms" verified — fragmented across ~300+ LPAs plus planning.data.gov.uk, each potentially with different terms. The core issue isn't licensing — it's that planning applications routinely contain **named private individuals'** details (applicant name, sometimes address/agent contact) submitted for a specific regulatory purpose; republishing that for sales-lead matching is a clear purpose-limitation and Article 14/legitimate-interests question, independent of the licence covering the dataset structure.

**Architecture implication**: Use Companies House's bulk data products / streaming API (designed for reuse at scale), not the search UI. Build rate-limit-respecting throttling. Treat "Companies House disclaims responsibility for your compliance" as a direct signal that GDPR/PECR risk sits entirely with the product — reinforces the need for solicitor-reviewed data-use policy for named individuals from planning portals, before any outreach feature ships.

---

## Summary table for the solicitor conversation

| Area | Open question for a solicitor | Safer default to build in now |
|---|---|---|
| OGL data | Does OGL cover FTS/Contracts Finder API output identically to the web UI? | Auto-generate attribution footer; log licence version per ingested record |
| Personal data in public records | Can legitimate interests + Art 14 "disproportionate effort" cover named individuals scraped from planning apps? | Separate entity-level data (low risk) from named-individual data (high risk) in the schema; suppress named-individual fields by default |
| B2B marketing/outreach | Is an LIA sufficient before enabling outreach on non-corporate contacts? | Ship without outreach features first (insight-only product); gate outreach behind sign-off; corporate-subscriber contacts only, with opt-out |
| Scraping | Which target sites' ToS forbid scraping, and what's the exposure? | Prefer official APIs/bulk data everywhere possible; ToS-check every scrape target; throttle to avoid "substantial part" extraction |
| Companies House | Does the fair-use policy restrict direct-marketing use of register data? | Use bulk data products, not UI scraping; respect rate limits programmatically |
| AI processing (Claude) | Does routing scraped personal data through a third-party AI processor need a DPA/sub-processor disclosure in the privacy notice? | Draft a data-processing addendum / sub-processor list before launch |

**Overall recommendation**: Build the MVP around fact-level, entity-level insight (which companies/contracts/planning applications match a customer's target market) using official OGL/API sources, and treat "surface a named individual's personal contact info for outreach" as a distinct, higher-risk feature — scoped, legally reviewed (LIA + Art 14 assessment + PECR check), and switched on later, not baked into the initial product.
