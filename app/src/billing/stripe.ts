import Stripe from "stripe";
import { grantCredits } from "../credits/ledger.js";

/**
 * Minimal Stripe integration — credit packs only, no subscriptions yet
 * (per docs/architecture/01-tool-and-mcp-audit.md: billing was deferred
 * until it's actually being built; this is that build, kept deliberately
 * small). NOT live-tested — this sandbox has no Stripe account (see
 * docs/architecture/04-implementation-status.md). Code is structurally
 * correct against the current Stripe Node SDK and documented API, and
 * every function fails loudly (never silently) when unconfigured.
 */

const CREDIT_PACKS: Record<string, { credits: number; unitAmountGbp: number; label: string }> = {
  starter: { credits: 10, unitAmountGbp: 4900, label: "10 credits" }, // £49 — hypothesis, see docs/research/05-product-strategy.md
  professional: { credits: 50, unitAmountGbp: 19900, label: "50 credits" }, // £199
};

function getClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeNotConfiguredError();
  }
  return new Stripe(key);
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured in this environment (STRIPE_SECRET_KEY unset) — see docs/architecture/04-implementation-status.md");
  }
}

export async function createCheckoutSession(businessId: string, packId: keyof typeof CREDIT_PACKS, successUrl: string, cancelUrl: string) {
  const pack = CREDIT_PACKS[packId];
  if (!pack) throw new Error(`Unknown credit pack: ${packId}`);

  const stripe = getClient();
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: { name: `Groundline — ${pack.label}` },
          unit_amount: pack.unitAmountGbp,
        },
        quantity: 1,
      },
    ],
    metadata: { businessId, packId, credits: String(pack.credits) },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

/**
 * Verifies and handles a Stripe webhook. Requires STRIPE_WEBHOOK_SECRET.
 * The credit-granting logic (grantCredits, idempotent on stripe_event_id —
 * see 0004_credit_idempotency.sql) is unit-testable independently of
 * signature verification; see test/credits.test.ts.
 */
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<{ handled: boolean; type: string }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new StripeNotConfiguredError();

  const stripe = getClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const businessId = session.metadata?.businessId;
    const credits = Number(session.metadata?.credits ?? 0);
    if (businessId && credits > 0) {
      await grantCredits(businessId, credits, "stripe_purchase", event.id);
      return { handled: true, type: event.type };
    }
  }
  return { handled: false, type: event.type };
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export { CREDIT_PACKS };
