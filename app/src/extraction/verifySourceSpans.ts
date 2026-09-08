import { servicePool } from "../db/pool.js";

/**
 * Deterministic integrity check: every `requirements.source_span` with
 * confidence 'verified' must actually appear in the notice's own
 * title+description text. This is NOT a replacement for the AI Verification
 * Agent (which also judges whether the span *supports* the claimed value,
 * a semantic check this can't do) — it's a cheap, mechanical check that
 * can run unconditionally (no API key needed) and catch the simplest
 * failure mode: a hallucinated quote that was never in the source at all.
 *
 * Run standalone: `node --loader ts-node/esm src/extraction/verifySourceSpans.ts`
 */
function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function verifyAllSourceSpans(): Promise<{ checked: number; failures: Array<{ id: string; field: string; span: string }> }> {
  const { rows } = await servicePool.query(`
    select r.id, r.field_name, r.source_span, r.confidence, p.title, p.description
    from requirements r
    join procurement p on p.id = r.procurement_id
    where r.confidence = 'verified' and r.source_span is not null
  `);

  const failures: Array<{ id: string; field: string; span: string }> = [];
  for (const row of rows) {
    const haystack = normalise(`${row.title} ${row.description ?? ""}`);
    const needle = normalise(row.source_span);
    if (!haystack.includes(needle)) {
      failures.push({ id: row.id, field: row.field_name, span: row.source_span });
    }
  }
  return { checked: rows.length, failures };
}

async function main() {
  const { checked, failures } = await verifyAllSourceSpans();
  console.log(`Checked ${checked} 'verified' requirement(s) against their source notice text.`);
  if (failures.length === 0) {
    console.log("All source spans found verbatim in their source text. No hallucinated quotes detected.");
  } else {
    console.error(`${failures.length} FAILED — quoted span not found in source text:`);
    for (const f of failures) console.error(`  requirement ${f.id} (${f.field}): "${f.span}"`);
    process.exitCode = 1;
  }
  await servicePool.end();
}

// Only run as CLI when invoked directly, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith("verifySourceSpans.ts")) {
  main();
}
