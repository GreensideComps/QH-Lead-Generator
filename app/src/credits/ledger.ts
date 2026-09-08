import type { PoolClient } from "pg";
import { withTenant } from "../db/withTenant.js";

export class InsufficientCreditsError extends Error {
  constructor(public balance: number, public required: number) {
    super(`Insufficient credits: have ${balance}, need ${required}`);
  }
}

/**
 * A "credit" represents one unlocked opportunity's deep intelligence —
 * a commercial research outcome, not a unit of AI token usage (per the
 * brief's own instruction not to expose/price internal token cost). The
 * price-per-credit is a hypothesis to validate, not a settled fact — see
 * docs/research/05-product-strategy.md pricing hypothesis and
 * docs/architecture/06-credits-and-billing.md.
 */
export const CREDIT_COST_PER_UNLOCK = 1;

export async function getBalance(businessId: string): Promise<number> {
  return withTenant(businessId, async (client) => {
    const { rows } = await client.query(`select balance from credits where business_id = $1`, [businessId]);
    return rows[0]?.balance ?? 0;
  });
}

/**
 * Atomically debits credits and records the unlock, inside one transaction
 * (via withTenant) so a race between two unlock requests can't double-spend
 * a balance. Throws InsufficientCreditsError without writing anything if
 * the balance is too low — never grants an unlock "on credit".
 *
 * Idempotent per (opportunityId, businessId): the `for update` lock on the
 * credits row serializes concurrent unlock attempts for this business, so
 * the existence check below is race-safe — a duplicate/replayed unlock
 * request (double-click, browser resubmit, or a replayed POST) is a no-op,
 * never a second charge. The caller's own `alreadyUnlocked()` check is a
 * fast-path that avoids the AI synthesis call in the common case; this is
 * the actual safety net for the money movement.
 */
export async function debitForUnlock(
  businessId: string,
  opportunityId: string,
  content: Record<string, unknown>,
): Promise<{ newBalance: number }> {
  return withTenant(businessId, async (client: PoolClient) => {
    const { rows } = await client.query(
      `select balance from credits where business_id = $1 for update`,
      [businessId],
    );
    const balance = rows[0]?.balance ?? 0;

    const existing = await client.query(
      `select 1 from intelligence_unlocks where opportunity_id = $1 and business_id = $2`,
      [opportunityId, businessId],
    );
    if (existing.rowCount) {
      return { newBalance: balance };
    }

    if (balance < CREDIT_COST_PER_UNLOCK) {
      throw new InsufficientCreditsError(balance, CREDIT_COST_PER_UNLOCK);
    }

    const newBalance = balance - CREDIT_COST_PER_UNLOCK;
    await client.query(`update credits set balance = $1, updated_at = now() where business_id = $2`, [newBalance, businessId]);
    await client.query(
      `insert into credit_transactions (business_id, delta, reason, opportunity_id) values ($1, $2, 'intelligence_unlock', $3)`,
      [businessId, -CREDIT_COST_PER_UNLOCK, opportunityId],
    );
    await client.query(
      `insert into intelligence_unlocks (opportunity_id, business_id, credits_spent, content)
       values ($1, $2, $3, $4)
       on conflict (opportunity_id, business_id) do update set content = excluded.content`,
      [opportunityId, businessId, CREDIT_COST_PER_UNLOCK, JSON.stringify(content)],
    );

    return { newBalance };
  });
}

export async function grantCredits(
  businessId: string,
  amount: number,
  reason: string,
  stripeEventId?: string,
): Promise<void> {
  await withTenant(businessId, async (client) => {
    await client.query(
      `insert into credits (business_id, balance) values ($1, $2)
       on conflict (business_id) do update set balance = credits.balance + $2, updated_at = now()`,
      [businessId, amount],
    );
    await client.query(
      `insert into credit_transactions (business_id, delta, reason, stripe_event_id) values ($1, $2, $3, $4)
       on conflict (stripe_event_id) where stripe_event_id is not null do nothing`,
      [businessId, amount, reason, stripeEventId ?? null],
    );
  });
}

export async function alreadyUnlocked(businessId: string, opportunityId: string): Promise<Record<string, unknown> | null> {
  return withTenant(businessId, async (client) => {
    const { rows } = await client.query(
      `select content from intelligence_unlocks where business_id = $1 and opportunity_id = $2`,
      [businessId, opportunityId],
    );
    return rows[0]?.content ?? null;
  });
}
