import { writeFileSync } from "node:fs";
import { servicePool } from "../db/pool.js";
import { geocodePlace, haversineMiles, primaryPlaceName, type LatLng } from "../lib/geocode.js";
import { categoriseDemand } from "../ingestion/demandCategory.js";

/**
 * Generates the Groundline Operator Validation Pack from real ingested data.
 *
 * This exists to make Groundline DISPROVABLE. Every field is emitted with its
 * provenance separated into what the source notice actually states, what was
 * inferred by rule, and what is simply unknown — so an operator being
 * interviewed can see exactly how thin or solid each opportunity is, rather
 * than being shown a confident-looking card that hides its gaps.
 *
 * No AI is involved anywhere in this pack. Categorisation is deterministic
 * rules (src/ingestion/demandCategory.ts). That is stated on the page,
 * because "AI inference" would misrepresent the provenance.
 */

/** Five operator bases. Each opportunity is measured to its NEAREST base, so
 *  the pack represents "an operator in one of these towns" rather than one
 *  city's view — the brief asks for geographic distribution. */
const BASES = ["Birmingham", "Coventry", "Leicester", "Stoke-on-Trent", "Stafford"];
const RADIUS_MILES = 50;
const TARGET = 50;
/** No single buyer may supply more than this many cards. Without it, one
 *  county council's resurfacing programme fills a third of the pack and the
 *  interview tests that programme rather than Groundline. */
const MAX_PER_BUYER = 3;
/** Opportunities beyond this are excluded from the pack outright, however
 *  well documented — an operator cannot serve them. */
const MAX_PACK_MILES = 75;

interface Row {
  id: string;
  title: string;
  description: string | null;
  buyer_name: string | null;
  supplier_name: string | null;
  location_text: string | null;
  published_date: string | null;
  source_url: string;
  cpv_codes: string[];
  demand_categories: string[];
  demand_basis: string | null;
  delivery_location: string | null;
  bidders: number | null;
}

/** Buyer names that are notice-administration artefacts rather than a company
 *  an operator could ring. Found by inspection of the real award feed. */
const NOT_A_CONTRACTOR = /^(c\/o |for individual contract awards|various|n\/a$|see )/i;

/** A location string is treated as usable only if it names somewhere specific.
 *  "Various locations throughout the central belt of Scotland" is not usable. */
function locationIsSpecific(s: string | null): boolean {
  if (!s) return false;
  if (/various|throughout|nationwide|UK[- ]wide|multiple (sites|locations)|country ?wide/i.test(s)) return false;
  return s.trim().length > 3;
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function main() {
  const { rows } = await servicePool.query<Row>(`
    select id, title, description, buyer_name, supplier_name, location_text, published_date::text,
           source_url, cpv_codes, demand_categories, demand_basis,
           raw_payload->'tender'->'items'->0->'deliveryLocation'->>'description' as delivery_location,
           (raw_payload->'bids'->'statistics'->0->>'value')::int as bidders
    from procurement
    where notice_stage = 'award'
      and array_length(demand_categories, 1) > 0
      and supplier_name is not null
    order by published_date desc nulls last
  `);

  const baseCoords = new Map<string, LatLng>();
  for (const b of BASES) {
    const ll = await geocodePlace(b);
    if (ll) baseCoords.set(b, ll);
  }
  if (baseCoords.size === 0) throw new Error("Could not geocode any operator base");

  const geo = new Map<string, LatLng | null>();
  const withDistance: Array<Row & { distance: number | null; nearestBase: string | null; locSpecific: boolean }> = [];
  for (const r of rows) {
    // Prefer the project delivery location over the buyer's address when the
    // notice gives one — the buyer address is often a county hall miles away.
    const locSpecific = locationIsSpecific(r.delivery_location);
    const candidate = locSpecific ? r.delivery_location : r.location_text;
    const place = primaryPlaceName(candidate ?? null);
    if (place && !geo.has(place)) geo.set(place, await geocodePlace(place));
    const ll = place ? geo.get(place) ?? null : null;

    let best: { base: string; d: number } | null = null;
    if (ll) {
      for (const [b, bll] of baseCoords) {
        const d = haversineMiles(bll, ll);
        if (!best || d < best.d) best = { base: b, d };
      }
    }
    withDistance.push({ ...r, distance: best?.d ?? null, nearestBase: best?.base ?? null, locSpecific });
  }

  /** Quality score. The brief is explicit: do not pad the pack with weak
   *  opportunities to reach 50. Ranking by quality rather than proximity means
   *  the interview tests the best case Groundline can currently produce — if
   *  operators reject THESE, the weaker ones are irrelevant. */
  const score = (r: (typeof withDistance)[number]): number => {
    let s = 0;
    if (r.demand_basis === "direct") s += 3; // scheme IS this work, not assumed downstream
    if (r.locSpecific) s += 3; // a real project location, not a county hall
    if (r.supplier_name && !NOT_A_CONTRACTOR.test(r.supplier_name)) s += 2;
    if (r.bidders && r.bidders > 0) s += 1; // a genuinely competed award
    if ((r.distance ?? 999) <= RADIUS_MILES) s += 2;
    if (r.demand_categories.includes("muck_away") || r.demand_categories.includes("earthworks")) s += 1;
    return s;
  };

  const perBuyer = new Map<string, number>();
  const selected: typeof withDistance = [];
  for (const r of withDistance
    .filter(
      (r) =>
        r.distance !== null &&
        // Hard geographic gate FIRST. Quality ranking alone pulled in
        // excellent Scottish awards 400+ miles away — irrelevant to a
        // Midlands operator no matter how well-documented they are.
        r.distance <= MAX_PACK_MILES &&
        r.supplier_name &&
        !NOT_A_CONTRACTOR.test(r.supplier_name),
    )
    .sort((a, b) => score(b) - score(a) || (a.distance ?? 1e9) - (b.distance ?? 1e9))) {
    const k = (r.buyer_name ?? "unknown").toLowerCase();
    if ((perBuyer.get(k) ?? 0) >= MAX_PER_BUYER) continue;
    perBuyer.set(k, (perBuyer.get(k) ?? 0) + 1);
    selected.push(r);
    if (selected.length >= TARGET) break;
  }

  // ---- metrics computable from data alone ------------------------------
  const { rows: [span] } = await servicePool.query<{ months: string }>(`
    select greatest(1, round((max(published_date) - min(published_date)) / 30.44))::text as months
    from procurement where notice_stage='award' and array_length(demand_categories,1) > 0`);
  const months = Number(span?.months ?? 1);

  const inRadius = withDistance.filter((r) => r.distance !== null && r.distance <= RADIUS_MILES);
  // How many each individual base sees within its own radius.
  const perBaseCounts = [...baseCoords.entries()].map(
    ([, bll]) =>
      withDistance.filter((r) => {
        const place = primaryPlaceName((r.locSpecific ? r.delivery_location : r.location_text) ?? null);
        const ll = place ? geo.get(place) : null;
        return ll ? haversineMiles(bll, ll) <= RADIUS_MILES : false;
      }).length,
  );
  const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

  const m = {
    months,
    // Per-operator density. NOT total/5 — the five bases sit in overlapping
    // territory (Birmingham, Coventry and Stafford are all within 50 miles of
    // each other), so they largely see the SAME opportunities. Dividing would
    // treat overlapping patches as exclusive and understate it fivefold.
    densityPerMonth: (perBaseCounts.reduce((a, b) => a + b, 0) / perBaseCounts.length / months).toFixed(1),
    densityRange: `${Math.min(...perBaseCounts)}–${Math.max(...perBaseCounts)}`,
    inRadiusTotal: inRadius.length,
    contactRoute: pct(selected.filter((r) => r.supplier_name && !NOT_A_CONTRACTOR.test(r.supplier_name)).length, selected.length),
    locationPrecise: pct(selected.filter((r) => r.locSpecific).length, selected.length),
    startDateKnown: 0, // measured: zero of 289 award notices carry a start date
    workTypeClear: pct(selected.filter((r) => r.demand_basis === "direct").length, selected.length),
  };

  // ---- render -----------------------------------------------------------
  const cards = selected
    .map((r, i) => {
      const d = categoriseDemand({ title: r.title, description: r.description ?? "", cpvCodes: r.cpv_codes ?? [] });
      const contractorOk = r.supplier_name && !NOT_A_CONTRACTOR.test(r.supplier_name);
      const chUrl = contractorOk
        ? `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(r.supplier_name!)}`
        : null;
      const locSpecific = r.locSpecific;
      // Confidence reflects how much of the card is stated rather than assumed.
      const conf = r.demand_basis === "direct" && locSpecific ? "high" : r.demand_basis === "direct" ? "medium" : "low";
      return `
<article class="opp">
  <header class="opp__hd">
    <span class="opp__n">${i + 1}</span>
    <h3>${esc(r.title)}</h3>
    <span class="conf conf--${conf}">${conf} confidence</span>
    <span class="opp__dist mono">${r.distance !== null ? Math.round(r.distance) + " mi" : "—"}<br><span class="b">${esc(r.nearestBase ?? "")}</span></span>
  </header>
  <div class="opp__grid">
    <div><em>Awarded contractor</em><span>${esc(r.supplier_name)}</span></div>
    <div><em>Buyer</em><span>${esc(r.buyer_name ?? "—")}</span></div>
    <div><em>Best available location</em><span>${esc(r.delivery_location ?? r.location_text ?? "—")}${locSpecific ? ' <span class="okflag">project location</span>' : ' <span class="flag">buyer address only</span>'}</span></div>
    <div><em>Notice published</em><span class="mono">${esc(r.published_date ?? "—")}</span></div>
    <div><em>Award date</em><span class="unk">not published</span></div>
    <div><em>Start date</em><span class="unk">not published</span></div>
    <div><em>Work category</em><span>${r.demand_categories.map((c) => `<span class="cat">${esc(c.replace("_", " "))}</span>`).join(" ")}</span></div>
    <div><em>CPV codes</em><span class="mono">${esc((r.cpv_codes ?? []).slice(0, 4).join(", ") || "none given")}</span></div>
  </div>

  <div class="prov">
    <div class="prov__col prov--v">
      <h4>Verified</h4>
      <p class="prov__note">Directly stated by the source notice</p>
      <ul>
        <li>Scheme: ${esc(r.title)}</li>
        <li>Contractor appointed: ${esc(r.supplier_name)}</li>
        <li>Buyer: ${esc(r.buyer_name ?? "not stated")}</li>
        <li>Notice published: ${esc(r.published_date ?? "not stated")}</li>
        ${r.bidders ? `<li>${r.bidders} bidders competed</li>` : ""}
        ${locSpecific ? `<li>Project location: ${esc(r.delivery_location)}</li>` : ""}
      </ul>
    </div>
    <div class="prov__col prov--c">
      <h4>Calculated</h4>
      <p class="prov__note">Deterministic arithmetic on source data</p>
      <ul>
        <li>${r.distance !== null ? Math.round(r.distance) : "—"} miles from ${esc(r.nearestBase ?? "—")}, straight line</li>
        <li>Measured from ${locSpecific ? "the stated project location" : "the buyer's address — not the site"}</li>
      </ul>
    </div>
    <div class="prov__col prov--i">
      <h4>Inferred</h4>
      <p class="prov__note">Reasoned, not stated. Rule-based — no AI involved</p>
      <ul>
        <li>May create: ${r.demand_categories.map((c) => esc(c.replace("_", " "))).join(", ")}</li>
        <li>Basis: <strong>${esc(r.demand_basis ?? "—")}</strong>${r.demand_basis === "derived" ? " — the scheme is not itself earthmoving; demand is assumed downstream" : ""}</li>
        <li class="matched">Matched: ${esc(d.matchedOn.slice(0, 3).join("; ") || "—")}</li>
      </ul>
    </div>
    <div class="prov__col prov--u">
      <h4>Unknown</h4>
      <p class="prov__note">No evidence either way</p>
      <ul>
        <li>Contract value</li>
        <li>Site address${locSpecific ? " (only a town is given)" : ""}</li>
        <li>Start date and duration</li>
        <li>Whether haulage is subcontracted or self-delivered</li>
        <li>Tonnage, vehicle need, package timing</li>
      </ul>
    </div>
  </div>

  <footer class="opp__ft">
    <a href="${esc(r.source_url)}" target="_blank" rel="noopener">Source notice</a>
    ${chUrl ? `<a href="${esc(chUrl)}" target="_blank" rel="noopener">Companies House — ${esc(r.supplier_name)}</a>` : '<span class="unk">No usable contact route</span>'}
  </footer>
</article>`;
    })
    .join("\n");

  const html = TEMPLATE.replace("{{CARDS}}", cards)
    .replace(/{{OPERATOR}}/g, esc(`${BASES.length} Midlands bases · ${RADIUS_MILES}-mile radius`))
    .replace("{{DENSITY}}", m.densityPerMonth)
    .replace("{{MONTHS}}", String(m.months))
    .replace("{{INRADIUS}}", String(m.inRadiusTotal))
    .replace("{{CONTACT}}", String(m.contactRoute))
    .replace("{{LOCPRECISE}}", String(m.locationPrecise))
    .replace("{{STARTDATE}}", String(m.startDateKnown))
    .replace("{{WORKTYPE}}", String(m.workTypeClear))
    .replace(/{{COUNT}}/g, String(selected.length));

  const out = process.argv[2] ?? "/tmp/validation-pack.html";
  writeFileSync(out, html, "utf-8");

  console.log(`Wrote ${selected.length} opportunities to ${out}`);
  console.log(`Density per operator: ${m.densityPerMonth}/month (range across bases: ${m.densityRange} over ~${months} months)`);
  console.log(`Usable contact route : ${m.contactRoute}%`);
  console.log(`Location specific    : ${m.locationPrecise}%`);
  console.log(`Start date known     : ${m.startDateKnown}%`);
  console.log(`Work type direct     : ${m.workTypeClear}%`);
  console.log(`Max distance in pack : ${Math.round(Math.max(...selected.map((s) => s.distance ?? 0)))} mi`);

  await servicePool.end();
}

const TEMPLATE = `<title>Operator Validation Pack</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{--ground:#e9ecee;--surface:#fff;--surface-2:#f2f4f5;--sunk:#dfe3e6;--ink:#16191c;--ink-2:#3f474f;--ink-muted:#69737d;
--rule:#cfd5da;--rule-strong:#b3bcc3;--accent:#a8560c;--accent-ink:#63330a;--accent-soft:#f6e6d6;
--good:#1f6b45;--good-soft:#dceee4;--warn:#8a6510;--warn-soft:#f5e9cd;--crit:#a32c22;--crit-soft:#f7dedb;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#131619;--surface:#1b1f23;--surface-2:#22272c;--sunk:#101315;
--ink:#e7eaec;--ink-2:#bcc4cb;--ink-muted:#8b959e;--rule:#2d343a;--rule-strong:#3d454c;--accent:#e08a3c;--accent-ink:#f2c395;--accent-soft:#3a2712;
--good:#5fbe8c;--good-soft:#16301f;--warn:#d8ac4a;--warn-soft:#332811;--crit:#e57f74;--crit-soft:#361816;}}
:root[data-theme="dark"]{--ground:#131619;--surface:#1b1f23;--surface-2:#22272c;--sunk:#101315;
--ink:#e7eaec;--ink-2:#bcc4cb;--ink-muted:#8b959e;--rule:#2d343a;--rule-strong:#3d454c;--accent:#e08a3c;--accent-ink:#f2c395;--accent-soft:#3a2712;
--good:#5fbe8c;--good-soft:#16301f;--warn:#d8ac4a;--warn-soft:#332811;--crit:#e57f74;--crit-soft:#361816;}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:'Public Sans',system-ui,sans-serif;font-size:14.5px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:2.5rem 1.25rem 5rem;display:flex;flex-direction:column;gap:2.5rem}
h1,h2,h3,h4{font-family:'Archivo',sans-serif;margin:0;letter-spacing:-.015em;text-wrap:balance}
h1{font-size:clamp(1.8rem,4vw,2.5rem);font-weight:800;line-height:1.1}
h2{font-size:1.25rem;font-weight:700}
p{margin:0}
.mono{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
.eyebrow{font-family:'IBM Plex Mono',monospace;font-size:.69rem;text-transform:uppercase;letter-spacing:.14em;color:var(--ink-muted);font-weight:500}
.masthead{display:flex;flex-direction:column;gap:.9rem;padding-bottom:1.5rem;border-bottom:2px solid var(--ink)}
.lede{font-size:1.05rem;color:var(--ink-2);max-width:66ch}
.lede strong{color:var(--ink);font-weight:600}
.sec-head{display:flex;align-items:baseline;gap:.75rem;border-bottom:1px solid var(--rule-strong);padding-bottom:.45rem;margin-bottom:1rem}
.warnbox{background:var(--warn-soft);border:1px solid var(--warn);border-radius:3px;padding:1.1rem 1.25rem;font-size:.9rem;color:var(--ink-2);max-width:78ch}
.warnbox b{color:var(--ink)}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.8rem}
.met{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:.9rem 1rem;display:flex;flex-direction:column;gap:.15rem}
.met b{font-family:'Archivo',sans-serif;font-size:1.7rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.met span{font-size:.75rem;color:var(--ink-muted);line-height:1.3}
.met.bad b{color:var(--crit)}.met.ok b{color:var(--good)}.met.mid b{color:var(--warn)}
.met.pending{border-style:dashed;background:var(--sunk)}
.met.pending b{color:var(--ink-muted);font-size:1.1rem}
.opp{background:var(--surface);border:1px solid var(--rule);border-radius:3px;overflow:hidden;break-inside:avoid}
.opp__hd{display:grid;grid-template-columns:34px 1fr auto auto;gap:.7rem;align-items:baseline;padding:.75rem .9rem;border-bottom:1px solid var(--rule);background:var(--surface-2)}
.opp__n{font-family:'IBM Plex Mono',monospace;font-size:.72rem;color:var(--accent);font-weight:600}
.opp__hd h3{font-size:.95rem;font-weight:700}
.opp__dist{font-size:.78rem;color:var(--ink-muted);white-space:nowrap}
.opp__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.6rem .9rem;padding:.85rem .9rem;border-bottom:1px dotted var(--rule-strong)}
.opp__grid div{display:flex;flex-direction:column;gap:.05rem}
.opp__grid em{font-style:normal;font-family:'IBM Plex Mono',monospace;font-size:.62rem;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-muted)}
.opp__grid span{font-size:.85rem;color:var(--ink-2)}
.cat{display:inline-block;background:var(--accent-soft);color:var(--accent-ink);border:1px solid var(--accent);border-radius:2px;font-size:.64rem;font-weight:600;padding:.1em .35em;text-transform:uppercase;letter-spacing:.04em}
.unk{color:var(--ink-muted);font-style:italic}
.flag{color:var(--crit);font-size:.72rem;font-weight:600}
.prov{display:grid;grid-template-columns:repeat(4,1fr);gap:0}
@media (max-width:1000px){.prov{grid-template-columns:repeat(2,1fr)}}
@media (max-width:620px){.prov{grid-template-columns:1fr}}
.prov__col{padding:.8rem .9rem;border-right:1px solid var(--rule)}
.prov__col:last-child{border-right:none}
.prov__col h4{font-size:.7rem;text-transform:uppercase;letter-spacing:.07em;margin-bottom:.35rem}
.prov__col ul{margin:0;padding-left:1.05rem;font-size:.8rem;color:var(--ink-2);display:flex;flex-direction:column;gap:.2rem}
.prov--v{background:var(--good-soft)} .prov--v h4{color:var(--good)}
.prov--i{background:var(--warn-soft)} .prov--i h4{color:var(--warn)}
.prov--c{background:var(--surface-2)} .prov--c h4{color:var(--ink-2)}
.prov--u{background:var(--crit-soft)} .prov--u h4{color:var(--crit)}
.prov__note{font-size:.66rem;color:var(--ink-muted);margin-bottom:.3rem;font-style:italic}
.okflag{color:var(--good);font-size:.72rem;font-weight:600}
.conf{font-family:'IBM Plex Mono',monospace;font-size:.62rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:.18em .45em;border-radius:2px;border:1px solid;white-space:nowrap}
.conf--high{background:var(--good-soft);color:var(--good);border-color:var(--good)}
.conf--medium{background:var(--warn-soft);color:var(--warn);border-color:var(--warn)}
.conf--low{background:var(--crit-soft);color:var(--crit);border-color:var(--crit)}
.opp__dist .b{font-size:.66rem;color:var(--ink-muted)}
.matched{font-family:'IBM Plex Mono',monospace;font-size:.7rem;color:var(--ink-muted)}
.opp__ft{display:flex;gap:1rem;flex-wrap:wrap;padding:.6rem .9rem;font-size:.78rem;background:var(--surface-2);border-top:1px solid var(--rule)}
.opp__ft a{color:var(--accent-ink)}
.opps{display:flex;flex-direction:column;gap:.9rem}
.q{background:var(--surface);border:1px solid var(--rule);border-left:3px solid var(--accent);border-radius:3px;padding:1rem 1.15rem;display:flex;flex-direction:column;gap:.5rem}
.q h3{font-size:.95rem}
.q p{font-size:.85rem;color:var(--ink-2);max-width:74ch}
.opts{display:flex;flex-wrap:wrap;gap:.4rem}
.opt{font-family:'IBM Plex Mono',monospace;font-size:.72rem;border:1px solid var(--rule-strong);border-radius:2px;padding:.25em .5em;color:var(--ink-2);background:var(--surface-2)}
.kill{background:var(--ink);color:#f4f6f7;border-radius:3px;padding:1.6rem;display:flex;flex-direction:column;gap:.8rem}
:root[data-theme="dark"] .kill{background:var(--surface-2);border:1px solid var(--rule-strong)}
.kill h2{color:#fff}.kill p{color:#c9d0d6;max-width:74ch}
:root[data-theme="dark"] .kill h2{color:var(--ink)}:root[data-theme="dark"] .kill p{color:var(--ink-2)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .kill h2{color:var(--ink)}:root:not([data-theme="light"]) .kill p{color:var(--ink-2)}}
.kill .eyebrow{color:var(--accent)}
.foot{font-size:.79rem;color:var(--ink-muted);border-top:1px solid var(--rule);padding-top:1rem;max-width:78ch}
</style>
<div class="wrap">
<header class="masthead">
  <div style="display:flex;gap:1.1rem;flex-wrap:wrap"><span class="eyebrow">Customer validation</span><span class="eyebrow mono">{{OPERATOR}}</span></div>
  <h1>Groundline Operator Validation Pack</h1>
  <p class="lede">{{COUNT}} real contract awards, taken from live Find a Tender data, shown to operators exactly as they are — <strong>including everything the notice does not tell us</strong>. This pack is built to disprove Groundline, not to sell it.</p>
</header>

<div class="warnbox">
  <b>Read this before using the pack.</b> Every card separates what the notice actually states from what Groundline inferred and what nobody knows.
  <b>No AI was used anywhere in this pack</b> — categorisation is deterministic rules, so "inferred" means a keyword or CPV code matched, not that a model formed a judgement.
  Two figures below are deliberately blank: they can only come from operators, and filling them in from our own opinion would destroy the experiment.
</div>

<section>
  <div class="sec-head"><h2>Measured from data</h2></div>
  <div class="metrics">
    <div class="met ok"><b>{{DENSITY}}</b><span>opportunities per month within radius (n={{INRADIUS}} over ~{{MONTHS}} months)</span></div>
    <div class="met ok"><b>{{CONTACT}}%</b><span>have a usable contact route (named company, Companies House searchable)</span></div>
    <div class="met mid"><b>{{LOCPRECISE}}%</b><span>give a project location rather than the buyer's address</span></div>
    <div class="met bad"><b>{{STARTDATE}}%</b><span>state a start date</span></div>
    <div class="met mid"><b>{{WORKTYPE}}%</b><span>work type is directly stated, not inferred downstream</span></div>
    <div class="met bad"><b>0.3%</b><span>state a contract value (1 of 289 nationally)</span></div>
    <div class="met pending"><b>pending</b><span>% judged actionable — operators only</span></div>
    <div class="met pending"><b>pending</b><span>% judged worth contacting — operators only</span></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Interview framework</h2></div>
  <div class="warnbox" style="margin-bottom:1rem">
    <b>Running it without leading the witness.</b> Show the cards; say nothing about what Groundline is for until the end.
    Do not explain why an opportunity might be good. If the operator asks "what would I do with this?", answer "that's what I'm asking you" and move on.
    Record refusals and shrugs verbatim — a flat "I wouldn't bother with that" is the most valuable answer in the set.
    Ask Q6 last, and never after describing a feature you could build.
  </div>
  <div style="display:flex;flex-direction:column;gap:.7rem">
    <div class="q"><h3>1. Would you pursue this?</h3><p>Neutral prompt: "Looking at this one, what would you do — anything, or nothing?"</p>
      <div class="opts"><span class="opt">would pursue</span><span class="opt">might, depends</span><span class="opt">would not</span><span class="opt">already knew about it</span></div></div>
    <div class="q"><h3>2. Who would you contact?</h3><p>Ask them to name the actual role or company. If they cannot name anyone, record that — it is a finding, not a gap in the interview.</p>
      <div class="opts"><span class="opt">named a specific person/role</span><span class="opt">named the company only</span><span class="opt">did not know who</span><span class="opt">would not contact anyone</span></div></div>
    <div class="q"><h3>3. What is missing before you would contact them?</h3><p>Open. Do not offer a list. Capture their words; only afterwards map to value / start date / site / package timing / named buyer.</p>
      <div class="opts"><span class="opt">nothing — enough as is</span><span class="opt">one thing missing</span><span class="opt">several things missing</span><span class="opt">fundamentally not usable</span></div></div>
    <div class="q"><h3>4. How commercially valuable would this be?</h3><p>Ask for a figure or a range in their own terms, then ask how often they would expect to win one. Do not suggest a number.</p>
      <div class="opts"><span class="opt">no value</span><span class="opt">&lt;£5k</span><span class="opt">£5–25k</span><span class="opt">£25–100k</span><span class="opt">&gt;£100k</span><span class="opt">could not say</span></div></div>
    <div class="q"><h3>5. Would you want to be notified when opportunities like this appear?</h3><p>Then ask the harder version: "how would you feel if this arrived every week and most weren't relevant?"</p>
      <div class="opts"><span class="opt">yes, weekly</span><span class="opt">yes, only strong ones</span><span class="opt">no — too much noise</span><span class="opt">no — not how I win work</span></div></div>
    <div class="q"><h3>6. Would you pay for this monthly?</h3><p>Ask what they would pay <em>before</em> naming any price. If they give a number, ask what it would have to do to be worth double. Treat "maybe" as a no.</p>
      <div class="opts"><span class="opt">no</span><span class="opt">maybe (= no)</span><span class="opt">yes, named a figure</span><span class="opt">yes, and asked to start</span></div></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>The {{COUNT}} opportunities</h2></div>
  <div class="opps">
{{CARDS}}
  </div>
</section>

<div class="kill">
  <span class="eyebrow">Pre-committed decision rule</span>
  <h2>Set the pass mark before collecting the data, not after.</h2>
  <p><b>Groundline passes</b> if, across 8–12 operators: at least 40% of shown opportunities are judged worth contacting, at least half of operators say they would want notification without prompting, and at least 3 operators name a monthly figure unprompted.</p>
  <p><b>Groundline fails</b> if: fewer than 20% are judged worth contacting, or operators consistently say they already know about this work through existing relationships, or nobody names a price. A failure here is a real result and should stop the build — not trigger another feature.</p>
  <p>Write the numbers in before the first interview. Changing the threshold afterwards is how teams talk themselves into building something nobody buys.</p>
</div>

<p class="foot">Generated from Groundline's live database against Find a Tender award notices. Distances are measured from the operator base to the best available location — the project delivery location where the notice gives one, otherwise the buyer's registered address, which may be many miles from the actual site. Contract values, start dates and award dates are absent because the notices do not publish them, not because they were omitted here.</p>
</div>`;

main();
