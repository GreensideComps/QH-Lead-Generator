import { test } from "node:test";
import assert from "node:assert/strict";
import { servicePool } from "../src/db/pool.js";
import { debitForUnlock, grantCredits, InsufficientCreditsError } from "../src/credits/ledger.js";
import { verifyAllSourceSpans } from "../src/extraction/verifySourceSpans.js";

/**
 * These run against the REAL local Postgres database configured in
 * app/.env (see docs/architecture/04-implementation-status.md) — not
 * mocks. They assume `npm run migrate`-equivalent SQL has been applied
 * and `npm run seed:profile` has been run at least once.
 */

test("DB: every 'verified' requirement's source_span is a genuine substring of its notice text (no hallucinated quotes)", async () => {
  const { checked, failures } = await verifyAllSourceSpans();
  assert.ok(checked > 0, "expected at least one verified requirement to check — run npm run seed:extraction first");
  assert.deepEqual(failures, [], "found a 'verified' claim whose quoted source_span does not appear in the source text");
});

test("DB: opportunities has a real uniqueness constraint — a business can't get two opportunity rows for the same notice", async () => {
  const { rows: businesses } = await servicePool.query(`select id from businesses limit 1`);
  const { rows: notices } = await servicePool.query(`select id from procurement limit 1`);
  if (!businesses.length || !notices.length) {
    console.warn("Skipping: no seeded business/procurement data present");
    return;
  }
  const businessId = businesses[0].id;
  const procurementId = notices[0].id;

  await servicePool.query(`insert into opportunities (business_id, procurement_id) values ($1,$2) on conflict do nothing`, [
    businessId,
    procurementId,
  ]);
  const before = await servicePool.query(`select count(*) from opportunities where business_id=$1 and procurement_id=$2`, [
    businessId,
    procurementId,
  ]);
  await servicePool.query(`insert into opportunities (business_id, procurement_id) values ($1,$2) on conflict do nothing`, [
    businessId,
    procurementId,
  ]);
  const after = await servicePool.query(`select count(*) from opportunities where business_id=$1 and procurement_id=$2`, [
    businessId,
    procurementId,
  ]);
  assert.equal(before.rows[0].count, after.rows[0].count, "duplicate insert should have been a no-op, not a new row");
});

test("DB: credit ledger refuses to debit below zero and writes nothing on failure", async () => {
  const { rows } = await servicePool.query(
    `insert into businesses (name) values ('Test business — credit ledger unit test') returning id`,
  );
  const businessId = rows[0].id;
  try {
    await grantCredits(businessId, 1, "manual_adjustment");

    const { rows: oppSetup } = await servicePool.query(`select id from procurement limit 1`);
    if (!oppSetup.length) {
      console.warn("Skipping debit assertions: no procurement rows to attach an opportunity to");
      return;
    }
    const { rows: oppRows } = await servicePool.query(
      `insert into opportunities (business_id, procurement_id) values ($1,$2) returning id`,
      [businessId, oppSetup[0].id],
    );
    const opportunityId = oppRows[0].id;

    // First unlock: should succeed (balance 1 -> 0)
    await debitForUnlock(businessId, opportunityId, { narrative: "test", recommendedAction: "test", method: "deterministic-template" });

    // Second unlock attempt on a DIFFERENT opportunity with balance now 0: must fail
    const { rows: oppRows2 } = await servicePool.query(`select id from procurement offset 1 limit 1`);
    if (oppRows2.length) {
      const { rows: opp2 } = await servicePool.query(
        `insert into opportunities (business_id, procurement_id) values ($1,$2) returning id`,
        [businessId, oppRows2[0].id],
      );
      await assert.rejects(
        () => debitForUnlock(businessId, opp2[0].id, { narrative: "x", recommendedAction: "x", method: "deterministic-template" }),
        InsufficientCreditsError,
      );
    }

    const { rows: balanceRows } = await servicePool.query(`select balance from credits where business_id=$1`, [businessId]);
    assert.equal(balanceRows[0].balance, 0, "balance should be exactly 0, never negative");
  } finally {
    await servicePool.query(`delete from businesses where id = $1`, [businessId]);
  }
});
