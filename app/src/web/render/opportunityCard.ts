import { escapeHtml, fmtGBP, scoreBand } from "./layout.js";
import type { OpportunityListItem } from "../queries.js";

export function opportunityCard(item: OpportunityListItem): string {
  const band = scoreBand(item.totalScore);
  const why = item.positiveFactors[0] ?? item.negativeFactors[0] ?? "See detail for full reasoning";
  return `
  <a class="card opp-card" href="/opportunities/${item.opportunityId}">
    <div class="ring" style="--p:${item.totalScore};--ring-c:var(--${band.cls === "muted" ? "ink-muted" : band.cls})">
      <span class="ring__num mono">${item.totalScore}</span>
    </div>
    <div>
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem;">
        <strong style="font-family:'Archivo',system-ui,sans-serif;font-size:.95rem;">${escapeHtml(item.title)}</strong>
        <span class="pill pill--${statusPillClass(item.status)}">${item.status.replace("_", " ")}</span>
      </div>
      <div style="font-size:.78rem;color:var(--ink-muted);margin-bottom:.35rem;">
        ${escapeHtml(item.buyerName)} · ${escapeHtml(item.locationText)}${item.deadline ? ` · deadline ${item.deadline}` : ""}
      </div>
      <div style="font-size:.83rem;color:var(--ink-secondary);">${escapeHtml(why)}</div>
    </div>
    <div style="text-align:right;">
      <div class="mono" style="font-weight:600;">${fmtGBP(item.estimatedRevenue)}</div>
      <div style="font-size:.7rem;color:var(--ink-muted);text-transform:uppercase;">${item.revenueBasis}</div>
    </div>
  </a>`;
}

function statusPillClass(status: string): string {
  if (status === "won") return "good";
  if (status === "lost") return "critical";
  if (status === "not_relevant") return "muted";
  if (status === "contacted") return "warn";
  return "accent";
}
