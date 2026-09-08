import { servicePool } from "../db/pool.js";
import { runExtraction, runVerification } from "./extractionAgent.js";
import { ClaudeNotConfiguredError, ClaudeCallError } from "../lib/claudeClient.js";

/**
 * Runs the real Extraction + Verification pipeline against every
 * `procurement` row that doesn't yet have `requirements`. Requires
 * ANTHROPIC_API_KEY. If it's not set, this logs which notices would be
 * processed and exits — it does NOT fabricate requirement rows. Use
 * `npm run seed:extraction` for the transparent manual-extraction path
 * used in this sandbox (see docs/architecture/04-implementation-status.md).
 *
 * Every AI call (success, API error, invalid response, or no-key skip) is
 * recorded in ai_call_log (0006_ai_call_log.sql) regardless of outcome.
 */
async function main() {
  const { rows: notices } = await servicePool.query(
    `select p.id, p.title, p.description from procurement p
     where not exists (select 1 from requirements r where r.procurement_id = p.id)
     order by p.ingested_at desc`,
  );

  if (notices.length === 0) {
    console.log("No notices are pending extraction.");
    await servicePool.end();
    return;
  }

  let succeeded = 0;
  let failed = 0;

  for (const notice of notices) {
    console.log(`Extracting: ${notice.title}`);
    try {
      const extraction = await runExtraction(notice.title, notice.description ?? "", { procurementId: notice.id });
      const verification = await runVerification(`${notice.title}\n${notice.description ?? ""}`, extraction.fields, {
        procurementId: notice.id,
      });

      for (const field of verification.verified_fields) {
        await servicePool.query(
          `insert into requirements (procurement_id, field_name, value_text, confidence, source_span, extracted_by)
           values ($1, $2, $3, $4, $5, $6)`,
          [notice.id, field.field_name, field.value, field.confidence, field.source_span, `claude-api-production:${verification.model}`],
        );
      }
      succeeded += 1;
    } catch (err) {
      failed += 1;
      if (err instanceof ClaudeNotConfiguredError) {
        // Every attempt (this one included) is still logged to ai_call_log
        // as 'skipped_no_key' by callClaude itself, per-notice, with
        // procurement_id context — stop after the first rather than
        // repeating the same, already-logged outcome for every remaining
        // notice.
        console.warn(
          `ANTHROPIC_API_KEY is not configured. ${notices.length} notice(s) have no extracted requirements yet. ` +
            `Not fabricating results. Run 'npm run seed:extraction' for the transparent manual-extraction ` +
            `path documented in docs/architecture/04-implementation-status.md, or set ANTHROPIC_API_KEY and re-run this command.`,
        );
        break;
      }
      if (err instanceof ClaudeCallError) {
        console.error(`Extraction/verification failed for "${notice.title}": ${err.message} — skipping, not fabricating a result.`);
        continue;
      }
      throw err;
    }
  }

  console.log(`Extraction run complete: ${succeeded} succeeded, ${failed} failed (see ai_call_log for detail).`);
  await servicePool.end();
}

main();
