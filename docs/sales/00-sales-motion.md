# Sales Motion — Roadmap (Deferred)

## Current stage: there is no sales motion yet, by design

Per `docs/EXECUTIVE_SUMMARY.md` §15, the immediate next step is 8–12 direct discovery conversations with real target operators — done by the owner, not an agent. This is deliberate: at this stage, the goal is learning (does anyone want this, at what price), not pipeline volume, and a human needs to be in every one of those conversations to interpret what's actually said, not just what's logged.

## CRM

**Deferred.** No CRM is needed to run 8–12 manual conversations — a spreadsheet or a Supabase table the owner uses directly is enough, and premature CRM integration work would be effort spent before there's a repeatable process worth systematising. Revisit once there's a real, repeatable sales motion (post-validation, with a priced product) to actually manage.

## What a future Sales Agent would do, and its boundaries

Once Groundline has a validated product and a real sales process worth partially automating:

- Reuses Groundline's own matching engine to identify and score prospects (see `docs/marketing/00-growth-department-roadmap.md`) — this is a legitimate reuse of the core product capability, not new invention.
- Drafts outreach and follow-up content for **human review before sending** — never sends unattended until a pattern has been human-approved repeatedly and the legal basis for that specific contact type is confirmed (`docs/research/03-legal-compliance.md`).
- Tracks pipeline state in a real CRM (evaluate at that point — not decided now, no premature vendor lock-in).
- Escalates to a human for anything outside a defined script: a prospect asking a question the agent can't answer from documented product facts, any pricing negotiation, any complaint.

## Why this isn't built now

Building a Sales Agent before the sales motion itself has been proven manually would mean automating a process nobody has validated works. The validation experiment comes first; the agent, if justified, comes after.
