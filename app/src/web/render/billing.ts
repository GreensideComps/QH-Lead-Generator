import { layout, escapeHtml, type NavContext } from "./layout.js";
import { CREDIT_PACKS, isStripeConfigured } from "../../billing/stripe.js";

export function renderBilling(nav: NavContext, balance: number, transactions: any[]): string {
  const stripeReady = isStripeConfigured();
  const body = `
    <h1>Credits &amp; Billing</h1>

    <div class="card">
      <div style="font-size:.76rem;font-weight:700;color:var(--ink-secondary);text-transform:uppercase;">Current balance</div>
      <div class="mono" style="font-size:2rem;font-weight:600;">${balance} credits</div>
    </div>

    ${
      !stripeReady
        ? `<div class="alert">Stripe is not configured in this environment (no STRIPE_SECRET_KEY). Checkout is disabled — see docs/architecture/04-implementation-status.md. The credit-purchase code path is written and unit-tested, but requires a real Stripe account to run live.</div>`
        : ""
    }

    <div class="section-head"><h2 style="font-size:1rem;">Buy credits</h2></div>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;">
      ${Object.entries(CREDIT_PACKS)
        .map(
          ([id, pack]) => `
        <form method="post" action="/billing/checkout" class="card" style="flex:1;min-width:220px;">
          <input type="hidden" name="packId" value="${id}">
          <div style="font-family:'Archivo',system-ui,sans-serif;font-weight:700;">${pack.label}</div>
          <div class="mono" style="font-size:1.4rem;margin:.4rem 0;">£${(pack.unitAmountGbp / 100).toFixed(2)}</div>
          <button class="btn" type="submit" ${stripeReady ? "" : "disabled"}>Buy</button>
        </form>`,
        )
        .join("")}
    </div>

    <div class="section-head"><h2 style="font-size:1rem;">Transaction history</h2></div>
    <div class="table-wrap">
      <table class="evi-table">
        <thead><tr><th>Date</th><th>Reason</th><th>Change</th></tr></thead>
        <tbody>
          ${transactions.map((t) => `<tr><td class="mono">${new Date(t.created_at).toLocaleString("en-GB")}</td><td>${escapeHtml(t.reason)}</td><td class="mono" style="color:${t.delta > 0 ? "var(--good-ink)" : "var(--critical-ink)"}">${t.delta > 0 ? "+" : ""}${t.delta}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
  return layout("Billing", body, nav);
}
