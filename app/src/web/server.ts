import "dotenv/config";
import express from "express";
import cookieSession from "cookie-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { attemptLogin, requireAuth, currentUser } from "./auth.js";
import { listOpportunities, getOpportunityDetail, dashboardStats, updateStatus, getCreditBalance, isValidStatus, isUuid } from "./queries.js";
import { renderLogin } from "./render/login.js";
import { renderDiscover } from "./render/discover.js";
import { renderMyOpportunities } from "./render/myOpportunities.js";
import { renderOpportunityDetail } from "./render/opportunityDetail.js";
import { renderBilling } from "./render/billing.js";
import { recordEvent } from "../analytics/track.js";
import { debitForUnlock, alreadyUnlocked, InsufficientCreditsError } from "../credits/ledger.js";
import { synthesizeIntelligence } from "../intelligence/synthesize.js";
import { createCheckoutSession, handleStripeWebhook, isStripeConfigured, StripeNotConfiguredError } from "../billing/stripe.js";
import { withTenant } from "../db/withTenant.js";
import { requireEnv } from "../db/pool.js";
import { ensureCsrfToken, verifyCsrf, csrfField } from "./csrf.js";
import type { Request, Response, NextFunction, RequestHandler } from "express";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

/**
 * Express 4 does not await async route handlers or catch their rejections —
 * an unhandled rejection anywhere in one (a DB hiccup, an unexpected API
 * error) becomes an unhandledRejection at the process level, which crashes
 * the entire server for every customer, not just the one request. Every
 * async handler below is wrapped with this so a failure always reaches the
 * error-handling middleware at the bottom of this file instead.
 */
function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// Stripe webhook needs the raw body for signature verification — must be
// registered BEFORE express.urlencoded()/express.json() touch the body.
app.post("/billing/webhook", express.raw({ type: "application/json" }), ah(async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"] as string;
    const result = await handleStripeWebhook(req.body, signature);
    res.json(result);
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      res.status(501).json({ error: err.message });
      return;
    }
    console.error("Stripe webhook error:", err);
    res.status(400).json({ error: "Webhook verification failed" });
  }
}));

// Fails loudly rather than silently signing sessions with a guessable
// default — the same discipline requireEnv already applies to DATABASE_URL.
// A missing SESSION_SECRET would otherwise let anyone who has read this
// file's git history forge a session cookie for any business.
const SESSION_SECRET = requireEnv("SESSION_SECRET");

app.use(
  helmet({
    // This app is plain server-rendered HTML with an inline <style> block
    // and no client-side JS at all (every state change is a form POST) —
    // so script-src can be locked down hard, while style-src needs
    // 'unsafe-inline' for that block plus the Google Fonts stylesheet.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
      },
    },
  }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cookieSession({
    name: "groundline_session",
    keys: [SESSION_SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    secure: isProduction,
  }),
);
app.use(ensureCsrfToken);

// Login is the one route an unauthenticated party can hit repeatedly —
// throttle credential-guessing without needing a shared store (single
// dev/staging instance today; swap the store if this ever runs behind
// multiple app instances).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please wait a few minutes and try again.",
});

// Unlocking spends real credits. Generous enough that no genuine session hits
// it (a person reads an opportunity before unlocking the next), tight enough
// that a runaway script or stuck retry loop can't drain a balance.
const unlockLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many unlock requests in a short time. Please wait a moment and try again.",
});

function navFor(req: express.Request, businessName: string, balance: number, active: "discover" | "my-opportunities" | "billing") {
  return { businessName, creditBalance: balance, activeNav: active, csrfToken: (req as any).session.csrfToken } as const;
}

app.get("/", (req, res) => {
  res.redirect(currentUser(req) ? "/my-opportunities" : "/login");
});

app.get("/login", (req, res) => {
  res.send(renderLogin((req as any).session.csrfToken));
});

app.post("/login", loginLimiter, verifyCsrf, ah(async (req, res) => {
  const { email, password } = req.body;
  const user = await attemptLogin(email, password);
  if (!user) {
    res.status(401).send(renderLogin((req as any).session.csrfToken, "Incorrect email or password."));
    return;
  }
  (req as any).session.userId = user.userId;
  (req as any).session.businessId = user.businessId;
  (req as any).session.businessName = user.businessName;
  await recordEvent(user.businessId, user.userId, "customer_returned");
  res.redirect("/my-opportunities");
}));

app.post("/logout", verifyCsrf, (req, res) => {
  (req as any).session = null;
  res.redirect("/login");
});

app.get("/my-opportunities", requireAuth, ah(async (req, res) => {
  const user = currentUser(req)!;
  const [items, stats, balance] = await Promise.all([
    listOpportunities(user.businessId),
    dashboardStats(user.businessId),
    getCreditBalance(user.businessId),
  ]);
  res.send(renderMyOpportunities(navFor(req, user.businessName, balance, "my-opportunities"), items, stats));
}));

app.get("/discover", requireAuth, ah(async (req, res) => {
  const user = currentUser(req)!;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const minScore = typeof req.query.minScore === "string" && req.query.minScore !== "" ? Number(req.query.minScore) : undefined;

  if (search) await recordEvent(user.businessId, user.userId, "search_performed", null, { search });

  const [items, balance] = await Promise.all([
    listOpportunities(user.businessId, { search, minScore }),
    getCreditBalance(user.businessId),
  ]);
  res.send(
    renderDiscover(navFor(req, user.businessName, balance, "discover"), items, {
      search,
      minScore: minScore !== undefined ? String(minScore) : undefined,
    }),
  );
}));

app.get("/opportunities/:id", requireAuth, ah(async (req, res) => {
  const user = currentUser(req)!;
  if (!isUuid(req.params.id)) {
    res.status(404).send("Opportunity not found");
    return;
  }
  const data = await getOpportunityDetail(user.businessId, req.params.id);
  if (!data) {
    res.status(404).send("Opportunity not found");
    return;
  }
  await recordEvent(user.businessId, user.userId, "opportunity_viewed", req.params.id);
  await recordEvent(user.businessId, user.userId, "match_viewed", req.params.id);
  if (data.unlock) await recordEvent(user.businessId, user.userId, "recommended_action_viewed", req.params.id);

  const balance = await getCreditBalance(user.businessId);
  res.send(renderOpportunityDetail(navFor(req, user.businessName, balance, "discover"), data));
}));

app.post("/opportunities/:id/status", requireAuth, verifyCsrf, ah(async (req, res) => {
  const user = currentUser(req)!;
  const status = String(req.body.status);
  if (!isUuid(req.params.id)) {
    res.status(404).send("Opportunity not found");
    return;
  }
  if (!isValidStatus(status)) {
    res.status(400).send("Invalid status.");
    return;
  }
  await updateStatus(user.businessId, req.params.id, status);
  if (status === "interested") await recordEvent(user.businessId, user.userId, "opportunity_saved", req.params.id);
  res.redirect(`/opportunities/${req.params.id}`);
}));

app.post("/opportunities/:id/unlock", requireAuth, unlockLimiter, verifyCsrf, ah(async (req, res) => {
  const user = currentUser(req)!;
  const opportunityId = req.params.id;
  if (!isUuid(opportunityId)) {
    res.status(404).send("Opportunity not found");
    return;
  }

  const existing = await alreadyUnlocked(user.businessId, opportunityId);
  if (existing) {
    res.redirect(`/opportunities/${opportunityId}`);
    return;
  }

  const data = await getOpportunityDetail(user.businessId, opportunityId);
  if (!data || !data.match) {
    res.status(404).send("Opportunity not found or not yet scored");
    return;
  }

  const synthesis = await synthesizeIntelligence(
    {
      title: data.opportunity.title,
      buyerName: data.opportunity.buyer_name,
      description: data.opportunity.description,
      matchFactors: {
        positive: data.match.positive_factors,
        negative: data.match.negative_factors,
        unknown: data.match.unknown_factors,
      },
      commercialNote: data.commercial?.note ?? "No commercial estimate available.",
      requirements: data.requirements.map((r: any) => ({ field: r.field_name, value: r.value_text, confidence: r.confidence })),
    },
    { opportunityId, businessId: user.businessId },
  );

  try {
    await debitForUnlock(user.businessId, opportunityId, {
      narrative: synthesis.narrative,
      recommendedAction: synthesis.recommendedAction,
      method: synthesis.method,
      fallbackReason: synthesis.fallbackReason ?? null,
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      res.status(402).send("Insufficient credits. Visit /billing to top up.");
      return;
    }
    throw err;
  }

  await recordEvent(user.businessId, user.userId, "opportunity_unlocked", opportunityId, {
    method: synthesis.method,
    fallbackReason: synthesis.fallbackReason ?? null,
  });
  await recordEvent(user.businessId, user.userId, "intelligence_consumed", opportunityId);

  res.redirect(`/opportunities/${opportunityId}`);
}));

app.get("/billing", requireAuth, ah(async (req, res) => {
  const user = currentUser(req)!;
  const balance = await getCreditBalance(user.businessId);
  const transactions = await withTenant(user.businessId, async (client) => {
    const { rows } = await client.query(
      `select * from credit_transactions where business_id = $1 order by created_at desc limit 50`,
      [user.businessId],
    );
    return rows;
  });
  res.send(renderBilling(navFor(req, user.businessName, balance, "billing"), balance, transactions));
}));

app.post("/billing/checkout", requireAuth, verifyCsrf, ah(async (req, res) => {
  const user = currentUser(req)!;
  if (!isStripeConfigured()) {
    res.status(501).send("Stripe is not configured in this environment. See docs/architecture/04-implementation-status.md.");
    return;
  }
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const session = await createCheckoutSession(user.businessId, req.body.packId, `${baseUrl}/billing`, `${baseUrl}/billing`);
    res.redirect(303, session.url!);
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).send("Could not create checkout session.");
  }
}));

// Global error handler — added per the AI-integration audit finding that no
// route in this app previously caught an unexpected failure (e.g. a DB
// outage, an unhandled Claude client error) before it fell through to
// Express's default handler, which leaks stack traces in non-production
// environments. Must be registered last, and must take all 4 params for
// Express to recognise it as error-handling middleware.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled request error:", err);
  if (res.headersSent) return;
  res.status(500).send("Something went wrong. This has been logged.");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Groundline app listening on http://localhost:${port}`);
});
