import { withTenant } from "../db/withTenant.js";

/**
 * Validation instrumentation. Every event listed in the brief is recorded
 * here so we can later answer "which intelligence actually causes
 * customers to take action" — see docs/architecture/07-validation-plan.md.
 * Deliberately just a Postgres table, not PostHog (still DEFERRED per
 * docs/architecture/01-tool-and-mcp-audit.md — no real users yet to justify it).
 */
export type EventType =
  | "opportunity_viewed"
  | "match_viewed"
  | "opportunity_saved"
  | "opportunity_unlocked"
  | "intelligence_consumed"
  | "contact_info_viewed"
  | "recommended_action_viewed"
  | "opportunity_exported"
  | "customer_returned"
  | "credit_purchased"
  | "search_performed";

export async function recordEvent(
  businessId: string,
  userId: string | null,
  eventType: EventType,
  opportunityId: string | null = null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await withTenant(businessId, async (client) => {
    await client.query(
      `insert into analytics_events (business_id, user_id, event_type, opportunity_id, metadata)
       values ($1, $2, $3, $4, $5)`,
      [businessId, userId, eventType, opportunityId, JSON.stringify(metadata)],
    );
  });
}
