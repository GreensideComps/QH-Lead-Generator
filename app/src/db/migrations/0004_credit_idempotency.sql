-- Ensures a Stripe webhook retried/delivered twice can't double-grant
-- credits — Stripe explicitly documents webhooks as at-least-once delivery,
-- so this is a real requirement, not defensive over-engineering.
create unique index if not exists uq_credit_transactions_stripe_event
  on credit_transactions (stripe_event_id)
  where stripe_event_id is not null;
