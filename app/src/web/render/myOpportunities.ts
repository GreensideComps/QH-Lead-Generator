import { layout, type NavContext } from "./layout.js";
import { opportunityCard } from "./opportunityCard.js";
import type { OpportunityListItem } from "../queries.js";

export function renderMyOpportunities(
  nav: NavContext,
  items: OpportunityListItem[],
  stats: { new_count: string; high_priority_count: string; total_count: string },
): string {
  const top = items.filter((i) => ["new", "interested", "contacted"].includes(i.status)).slice(0, 10);

  const body = `
    <div>
      <h1>My Opportunities</h1>
      <p style="color:var(--ink-muted);margin:.3rem 0 0;">Groundline found these because they're relevant to your business — not a database of every tender.</p>
    </div>

    <div class="stats">
      <div class="tile"><div class="tile__label">New</div><div class="tile__value mono">${stats.new_count}</div></div>
      <div class="tile"><div class="tile__label">High priority (70+)</div><div class="tile__value mono">${stats.high_priority_count}</div></div>
      <div class="tile"><div class="tile__label">Total tracked</div><div class="tile__value mono">${stats.total_count}</div></div>
      <div class="tile"><div class="tile__label">Data sources</div><div class="tile__value mono">2</div><div style="font-size:.72rem;color:var(--ink-muted);">Find a Tender, Companies House</div></div>
    </div>

    <div class="section-head"><h2 style="font-size:1rem;">Top matches</h2></div>
    ${top.length ? `<div class="card-list">${top.map(opportunityCard).join("")}</div>` : `<div class="empty"><strong>Nothing here yet.</strong><br>This usually means either there's genuinely nothing in scope right now, or your business profile is narrowly set — check <a href="/discover">Discover</a> to browse everything ingested.</div>`}
  `;
  return layout("My Opportunities", body, nav);
}
