import { layout, escapeHtml, fmtGBP, badge, scoreBand, type NavContext } from "./layout.js";

interface DetailData {
  opportunity: any;
  match: any;
  commercial: any;
  evidence: any[];
  requirements: any[];
  unlock: { content: any; credits_spent: number; unlocked_at: string } | null;
}

export function renderOpportunityDetail(nav: NavContext, data: DetailData): string {
  const { opportunity: o, match: m, commercial: c, evidence, requirements, unlock } = data;
  const band = m ? scoreBand(m.total_score) : { cls: "muted", label: "Unscored" };

  const body = `
    <a href="/discover" style="font-size:.8rem;color:var(--ink-muted);">&larr; Back to Discover</a>

    <div class="section-head">
      <div>
        <h1>${escapeHtml(o.title)}</h1>
        <div style="color:var(--ink-muted);margin-top:.3rem;">${escapeHtml(o.buyer_name)} · ${escapeHtml(o.location_text)}</div>
      </div>
      <form method="post" action="/opportunities/${o.id}/status" style="display:flex;gap:.4rem;flex-wrap:wrap;">
        ${["new", "interested", "contacted", "won", "lost", "not_relevant"]
          .map(
            (s) =>
              `<button class="btn btn--sm ${o.status === s ? "" : "btn--ghost"}" type="submit" name="status" value="${s}">${s.replace("_", " ")}</button>`,
          )
          .join("")}
      </form>
    </div>

    <div style="display:grid;grid-template-columns:1fr 300px;gap:1.5rem;align-items:start;">
      <div style="display:flex;flex-direction:column;gap:1.25rem;">

        <div class="card">
          <div style="display:flex;align-items:center;gap:1rem;">
            <div class="ring" style="width:70px;height:70px;--p:${m?.total_score ?? 0};--ring-c:var(--${band.cls === "muted" ? "ink-muted" : band.cls})">
              <span class="ring__num mono" style="font-size:1.2rem;">${m?.total_score ?? "—"}</span>
            </div>
            <div>
              <span class="pill pill--${band.cls}">${band.label}</span>
              <div style="font-size:.78rem;color:var(--ink-muted);margin-top:.3rem;">Source: <a href="${o.source_url}" target="_blank" rel="noopener">${escapeHtml(o.source_url)}</a></div>
            </div>
          </div>
          <div class="fact"><span class="fact__label">Deadline</span><span class="fact__value mono">${o.deadline ?? "Not stated"}</span></div>
          <div class="fact"><span class="fact__label">Published</span><span class="fact__value mono">${o.published_date ?? "Unknown"}</span></div>
          <div class="fact"><span class="fact__label">Contract value</span><span class="fact__value mono">${o.value_low ? fmtGBP(Number(o.value_low)) + (o.value_high && Number(o.value_high) !== Number(o.value_low) ? " – " + fmtGBP(Number(o.value_high)) : "") : "Not stated"}</span></div>
        </div>

        <div class="card">
          <h3 style="font-size:.92rem;margin-bottom:.5rem;">Why this matches</h3>
          ${m ? matchBreakdown(m) : "<em>Not yet scored.</em>"}
        </div>

        <div class="card">
          <h3 style="font-size:.92rem;margin-bottom:.5rem;">What we know</h3>
          ${
            requirements.filter((r) => r.confidence === "verified").length
              ? requirements
                  .filter((r) => r.confidence === "verified")
                  .map((r: any) => `<div class="fact"><span class="fact__label">${escapeHtml(r.field_name.replace(/_/g, " "))}</span><span class="fact__value" style="text-align:right;max-width:60%;font-family:'Public Sans';font-weight:500;">${escapeHtml(r.value_text)} ${badge(r.confidence)}</span></div>`)
                  .join("")
              : "<em>Nothing directly extracted yet from the source text.</em>"
          }
        </div>

        <div class="card">
          <h3 style="font-size:.92rem;margin-bottom:.5rem;">Commercial analysis</h3>
          ${commercialSection(c)}
        </div>

        <div class="card">
          <h3 style="font-size:.92rem;margin-bottom:.5rem;">Deep intelligence</h3>
          ${unlock ? unlockedContent(unlock) : lockedPrompt(o.id)}
        </div>

        <div class="card">
          <h3 style="font-size:.92rem;margin-bottom:.5rem;">Source evidence</h3>
          <div class="table-wrap"><table class="evi-table">
            <thead><tr><th>Claim</th><th>Value</th><th>Provenance</th></tr></thead>
            <tbody>${evidence.map((e: any) => `<tr><td>${escapeHtml(e.claim)}</td><td class="mono">${escapeHtml(e.value_text)}</td><td>${badge(e.confidence)}</td></tr>`).join("")}</tbody>
          </table></div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:1rem;">
        <div class="card">
          <h3 style="font-size:.85rem;margin-bottom:.4rem;">Recommended action</h3>
          <p style="margin:0;font-size:.85rem;color:var(--ink-secondary);">${unlock ? escapeHtml((unlock.content as any).recommendedAction) : "Unlock deep intelligence for a synthesised recommendation."}</p>
        </div>
      </div>
    </div>
  `;
  return layout(o.title, body, nav);
}

function matchBreakdown(m: any): string {
  const dims = [
    ["Service fit", m.service_score],
    ["Fleet fit", m.fleet_score],
    ["Geography fit", m.geography_score],
    ["Capacity fit", m.capacity_score],
    ["Commercial fit", m.commercial_score],
    ["Sector fit", m.sector_score],
  ];
  const bars = dims
    .map(
      ([label, score]) =>
        `<div style="display:grid;grid-template-columns:110px 1fr 30px;gap:.6rem;align-items:center;font-size:.8rem;margin-bottom:.4rem;">
          <span>${label}</span>
          <div style="height:8px;border-radius:4px;background:var(--border);overflow:hidden;"><div style="height:100%;background:var(--accent);width:${score}%"></div></div>
          <span class="mono" style="text-align:right;">${score}</span>
        </div>`,
    )
    .join("");
  const factors = (label: string, arr: string[], color: string) =>
    arr.length
      ? `<div style="margin-top:.5rem;"><strong style="font-size:.76rem;color:${color};">${label}</strong><ul style="margin:.25rem 0 0;padding-left:1.1rem;font-size:.8rem;color:var(--ink-secondary);">${arr.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul></div>`
      : "";
  return (
    bars +
    factors("Positive factors", m.positive_factors, "var(--good-ink)") +
    factors("Negative factors", m.negative_factors, "var(--critical-ink)") +
    factors("Unknown", m.unknown_factors, "var(--ink-muted)")
  );
}

function commercialSection(c: any): string {
  if (!c) return "<em>Not yet calculated.</em>";
  if (c.revenue_basis === "unknown") {
    return `<div class="fact"><span class="fact__label">Estimated revenue</span><span class="fact__value">${badge("unknown")}</span></div><p style="font-size:.8rem;color:var(--ink-muted);margin:.5rem 0 0;">${escapeHtml(c.note)}</p>`;
  }
  return `
    ${c.estimated_loads !== null ? `<div class="fact"><span class="fact__label">Estimated loads</span><span class="fact__value mono">${c.estimated_loads} ${badge("calculated")}</span></div>` : ""}
    <div class="fact"><span class="fact__label">Estimated revenue</span><span class="fact__value mono">${fmtGBP(Number(c.estimated_revenue))} ${badge(c.revenue_basis)}</span></div>
    ${c.estimated_cost !== null ? `<div class="fact"><span class="fact__label">Estimated cost</span><span class="fact__value mono">${fmtGBP(Number(c.estimated_cost))} ${badge("calculated")}</span></div>` : ""}
    ${c.estimated_contribution !== null ? `<div class="fact"><span class="fact__label">Contribution</span><span class="fact__value mono">${fmtGBP(Number(c.estimated_contribution))}</span></div>` : ""}
    ${c.estimated_margin_pct !== null ? `<div class="fact"><span class="fact__label">Margin</span><span class="fact__value mono">${c.estimated_margin_pct}%</span></div>` : ""}
    <p style="font-size:.78rem;color:var(--ink-muted);margin:.5rem 0 0;">${escapeHtml(c.note)}</p>
  `;
}

function lockedPrompt(opportunityId: string): string {
  return `
    <p style="font-size:.85rem;color:var(--ink-secondary);">Unlock a synthesised recommendation and the full evidence trail for 1 credit.</p>
    <form method="post" action="/opportunities/${opportunityId}/unlock">
      <button class="btn" type="submit">Unlock deep intelligence (1 credit)</button>
    </form>
  `;
}

function unlockedContent(unlock: { content: any; credits_spent: number; unlocked_at: string }): string {
  const content = unlock.content;
  return `
    <p style="font-size:.85rem;color:var(--ink-secondary);">${escapeHtml(content.narrative)}</p>
    <div style="font-size:.72rem;color:var(--ink-muted);margin-top:.5rem;">
      Synthesis method: <span class="mono">${content.method}</span> · Unlocked ${new Date(unlock.unlocked_at).toLocaleString("en-GB")}
    </div>
  `;
}
