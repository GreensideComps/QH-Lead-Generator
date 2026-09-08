import { servicePool } from "../db/pool.js";
import { runExtraction, runVerification } from "./extractionAgent.js";

/**
 * Runs the real Extraction + Verification pipeline against every
 * `procurement` row that doesn't yet have `requirements`. Requires
 * ANTHROPIC_API_KEY. If it's not set, this logs which notices would be
 * processed and exits — it does NOT fabricate requirement rows. Use
 * `npm run seed:extraction` for the transparent manual-extraction path
 * used in this sandbox (see docs/architecture/04-implementation-status.md).
 */
async function main() {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const { rows: notices } = await servicePool.query(
    `select p.id, p.title, p.description from procurement p
     where not exists (select 1 from requirements r where r.procurement_id = p.id)
     order by p.ingested_at desc`,
  );

  if (!hasKey) {
    console.warn(
      `ANTHROPIC_API_KEY is not configured. ${notices.length} notice(s) have no extracted requirements yet. ` +
        `Not fabricating results. Run 'npm run seed:extraction' for the transparent manual-extraction ` +
        `path documented in docs/architecture/04-implementation-status.md, or set ANTHROPIC_API_KEY and re-run this command.`,
    );
    await servicePool.end();
    return;
  }

  for (const notice of notices) {
    console.log(`Extracting: ${notice.title}`);
    const extraction = await runExtraction(notice.title, notice.description ?? "");
    const verification = await runVerification(
      `${notice.title}\n${notice.description ?? ""}`,
      extraction.fields,
    );

    for (const field of verification.verified_fields) {
      await servicePool.query(
        `insert into requirements (procurement_id, field_name, value_text, confidence, source_span, extracted_by)
         values ($1, $2, $3, $4, $5, 'claude-api-production')`,
        [notice.id, field.field_name, field.value, field.confidence, field.source_span],
      );
    }
  }

  await servicePool.end();
}

main();
