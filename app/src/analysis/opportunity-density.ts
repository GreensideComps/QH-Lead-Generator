import { servicePool } from "../db/pool.js";
import { geocodePlace, haversineMiles, primaryPlaceName, type LatLng } from "../lib/geocode.js";
import type { DemandCategory } from "../ingestion/demandCategory.js";

/**
 * Opportunity-density study for the award-notice hypothesis.
 *
 * Answers one question and nothing else: does Groundline surface commercially
 * actionable opportunities at a volume that could justify a subscription?
 * Measurement only — no UI, no product surface, no marketplace.
 *
 * IMPORTANT INTERPRETATION LIMIT, stated up front because it bounds every
 * number below: an FTS notice carries the BUYER's address, not the site
 * address. A county council in Stafford may award work anywhere in the
 * county. Distances here are therefore buyer-proximity, a proxy for site
 * proximity — good enough to compare cities and radii against each other,
 * not precise enough to promise a customer a specific job is 24 miles away.
 */

const BASES = ["Coventry", "Birmingham", "Leicester", "Stoke-on-Trent", "Stafford"];
const RADII = [25, 50, 100];

const ARCHETYPES: Array<{ name: string; radius: number; cats: DemandCategory[]; minValue: number }> = [
  // A 25-vehicle operator works a tighter patch and needs volume of mid-size work.
  { name: "25-vehicle haulage operator", radius: 50, cats: ["haulage", "muck_away", "earthworks"], minValue: 25_000 },
  // A 50-vehicle operator can travel further and service larger schemes.
  { name: "50-vehicle haulage operator", radius: 100, cats: ["haulage", "muck_away", "earthworks"], minValue: 50_000 },
  // An aggregate supplier delivers to site; radius is limited by haul economics.
  { name: "Aggregate supplier", radius: 50, cats: ["aggregate_supply"], minValue: 25_000 },
  // A waste company covers a wide area and cares about waste + muck-away.
  { name: "Waste company", radius: 75, cats: ["waste", "muck_away"], minValue: 25_000 },
];

interface Row {
  id: string;
  title: string;
  buyer_name: string | null;
  supplier_name: string | null;
  location_text: string | null;
  award_value: string | null;
  value_low: string | null;
  published_date: string | null;
  notice_stage: string;
  demand_categories: DemandCategory[];
  demand_basis: string | null;
  source_url: string;
}

async function main() {
  const { rows } = await servicePool.query<Row>(`
    select id, title, buyer_name, supplier_name, location_text, award_value, value_low,
           published_date, notice_stage, demand_categories, demand_basis, source_url
    from procurement
    where notice_stage = 'award' and array_length(demand_categories, 1) > 0
    order by published_date desc nulls last
  `);

  const { rows: [span] } = await servicePool.query<{ months: string; earliest: string; latest: string }>(`
    -- date minus date yields an integer number of days in Postgres, not an
    -- interval, so convert days to months directly.
    select greatest(1, round((max(published_date) - min(published_date)) / 30.44))::text as months,
           min(published_date)::text as earliest, max(published_date)::text as latest
    from procurement where notice_stage = 'award' and array_length(demand_categories, 1) > 0
  `);
  const months = Number(span?.months ?? 1);

  console.log("=".repeat(78));
  console.log("GROUNDLINE — OPPORTUNITY DENSITY STUDY (award-notice hypothesis)");
  console.log("=".repeat(78));
  console.log(`Award notices generating bulk-material demand : ${rows.length}`);
  console.log(`Observation window                            : ${span?.earliest} → ${span?.latest} (~${months} months)`);
  console.log(`National rate                                 : ${(rows.length / months).toFixed(1)} / month`);
  console.log(`Named a winning contractor                    : ${rows.filter((r) => r.supplier_name).length}`);

  // Geocode every distinct buyer locality once.
  const geo = new Map<string, LatLng | null>();
  for (const r of rows) {
    const place = primaryPlaceName(r.location_text);
    if (place && !geo.has(place)) geo.set(place, await geocodePlace(place));
  }
  const bases = new Map<string, LatLng | null>();
  for (const b of BASES) bases.set(b, await geocodePlace(b));

  const located = rows.filter((r) => {
    const p = primaryPlaceName(r.location_text);
    return p && geo.get(p);
  });
  console.log(`Geocodable to a buyer locality                : ${located.length} (${((100 * located.length) / (rows.length || 1)).toFixed(0)}%)`);

  const distanceFrom = (base: LatLng, r: Row): number | null => {
    const p = primaryPlaceName(r.location_text);
    const ll = p ? geo.get(p) : null;
    return ll ? haversineMiles(base, ll) : null;
  };

  // ---- 2 & 3: density per city, per radius, per month -------------------
  console.log("\n" + "-".repeat(78));
  console.log("OPPORTUNITIES PER MONTH, BY BASE AND RADIUS");
  console.log("-".repeat(78));
  console.log("base".padEnd(17) + RADII.map((r) => `${r}mi`.padStart(13)).join("") + "   (count | per month)");
  for (const b of BASES) {
    const base = bases.get(b);
    if (!base) { console.log(b.padEnd(17) + "  could not geocode base"); continue; }
    let line = b.padEnd(17);
    for (const radius of RADII) {
      const n = located.filter((r) => (distanceFrom(base, r) ?? 1e9) <= radius).length;
      line += `${n}|${(n / months).toFixed(1)}`.padStart(13);
    }
    console.log(line);
  }

  // ---- opportunities per contractor -------------------------------------
  console.log("\n" + "-".repeat(78));
  console.log("OPPORTUNITIES PER CONTRACTOR (top 15 by award count, nationally)");
  console.log("-".repeat(78));
  const byContractor = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.supplier_name) continue;
    const k = r.supplier_name.trim();
    byContractor.set(k, [...(byContractor.get(k) ?? []), r]);
  }
  const ranked = [...byContractor.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`Distinct named contractors: ${ranked.length}`);
  console.log(`Mean awards per contractor: ${(rows.filter((r) => r.supplier_name).length / (ranked.length || 1)).toFixed(2)}`);
  for (const [name, list] of ranked.slice(0, 15)) {
    console.log(`  ${String(list.length).padStart(3)}  ${name.slice(0, 62)}`);
  }

  // ---- 5: category mix ---------------------------------------------------
  console.log("\n" + "-".repeat(78));
  console.log("CATEGORY MIX (a notice can carry more than one)");
  console.log("-".repeat(78));
  const catCount: Record<string, number> = {};
  for (const r of rows) for (const c of r.demand_categories) catCount[c] = (catCount[c] ?? 0) + 1;
  for (const [c, n] of Object.entries(catCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(18)} ${String(n).padStart(4)}  ${((100 * n) / rows.length).toFixed(0)}%  (${(n / months).toFixed(1)}/mo)`);
  }
  const direct = rows.filter((r) => r.demand_basis === "direct").length;
  console.log(`\n  direct (the scheme IS this work)      ${direct}  (${(direct / months).toFixed(1)}/mo)`);
  console.log(`  derived (scheme generates it downstream) ${rows.length - direct}  (${((rows.length - direct) / months).toFixed(1)}/mo)`);

  // ---- 6: archetype volumes ---------------------------------------------
  console.log("\n" + "-".repeat(78));
  console.log("REALISTIC VOLUME BY OPERATOR ARCHETYPE (best of the 5 Midlands bases)");
  console.log("-".repeat(78));
  for (const a of ARCHETYPES) {
    let best = { base: "-", n: 0 };
    for (const b of BASES) {
      const base = bases.get(b);
      if (!base) continue;
      const n = located.filter((r) => {
        const d = distanceFrom(base, r);
        if (d === null || d > a.radius) return false;
        if (!r.demand_categories.some((c) => a.cats.includes(c))) return false;
        const v = Number(r.award_value ?? r.value_low ?? 0);
        return v === 0 || v >= a.minValue; // unvalued notices are kept, not assumed small
      }).length;
      if (n > best.n) best = { base: b, n };
    }
    console.log(
      `  ${a.name.padEnd(30)} ${String(best.n).padStart(4)} in window  =  ${(best.n / months).toFixed(1)}/month   ` +
        `(${a.radius}mi from ${best.base})`,
    );
  }

  // ---- 4: 50 examples ----------------------------------------------------
  console.log("\n" + "=".repeat(78));
  console.log("50 EXAMPLE OPPORTUNITIES (most recent, award stage, demand-generating)");
  console.log("=".repeat(78));
  const examples = rows.filter((r) => r.supplier_name).slice(0, 50);
  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
  examples.forEach((r, i) => {
    const v = Number(r.award_value ?? r.value_low ?? 0);
    console.log(
      `${String(i + 1).padStart(2)}. ${pad(r.title, 52)} | ${pad(r.supplier_name ?? "-", 30)} | ` +
        `${(v ? "£" + Math.round(v).toLocaleString() : "n/s").padStart(12)} | ${pad(r.location_text ?? "-", 20)} | ` +
        `${r.demand_categories.join(",")}`,
    );
  });
  if (examples.length < 50) {
    console.log(`\n  NOTE: only ${examples.length} demand-generating award notices with a named contractor exist in the window.`);
  }

  await servicePool.end();
}

main();
