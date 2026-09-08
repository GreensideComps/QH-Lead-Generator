import { layout, escapeHtml, type NavContext } from "./layout.js";
import { opportunityCard } from "./opportunityCard.js";
import type { OpportunityListItem } from "../queries.js";

export function renderDiscover(nav: NavContext, items: OpportunityListItem[], query: { search?: string; minScore?: string }): string {
  const body = `
    <div class="section-head">
      <h1>Discover</h1>
      <span style="color:var(--ink-muted);font-size:.85rem;">Search and filter every opportunity matched against your business profile</span>
    </div>

    <form class="card" method="get" action="/discover" style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-end;">
      <div style="flex:1;min-width:200px;">
        <label style="font-size:.76rem;font-weight:700;color:var(--ink-secondary);">Search</label>
        <input type="text" name="search" placeholder="Title or buyer..." value="${escapeHtml(query.search ?? "")}">
      </div>
      <div style="width:160px;">
        <label style="font-size:.76rem;font-weight:700;color:var(--ink-secondary);">Minimum fit score</label>
        <input type="number" name="minScore" min="0" max="100" value="${escapeHtml(query.minScore ?? "")}">
      </div>
      <button class="btn" type="submit">Apply</button>
      ${query.search || query.minScore ? `<a class="btn btn--ghost" href="/discover">Clear</a>` : ""}
    </form>

    <div class="section-head">
      <h2 style="font-size:1rem;">${items.length} opportunit${items.length === 1 ? "y" : "ies"}</h2>
    </div>

    ${items.length ? `<div class="card-list">${items.map(opportunityCard).join("")}</div>` : emptyState(query)}
  `;
  return layout("Discover", body, nav);
}

function emptyState(query: { search?: string; minScore?: string }): string {
  if (query.search || query.minScore) {
    return `<div class="empty"><strong>No opportunities match this filter.</strong><br>Try widening your search or lowering the minimum score.</div>`;
  }
  return `<div class="empty"><strong>No opportunities ingested yet for this business.</strong><br>Run the ingestion and matching pipeline (see docs/architecture/04-implementation-status.md).</div>`;
}
