export function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function fmtGBP(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "£" + Math.round(n).toLocaleString("en-GB");
}

const CONFIDENCE_BADGE: Record<string, { cls: string; label: string }> = {
  verified: { cls: "verified", label: "Verified" },
  calculated: { cls: "calculated", label: "Calculated" },
  customer_provided: { cls: "customer", label: "Your data" },
  estimated: { cls: "estimated", label: "Estimated" },
  inferred: { cls: "estimated", label: "Inferred" },
  unknown: { cls: "unknown", label: "Unknown" },
};

export function badge(confidence: string): string {
  const b = CONFIDENCE_BADGE[confidence] ?? CONFIDENCE_BADGE.unknown;
  return `<span class="badge badge--${b.cls}">${b.label}</span>`;
}

export function scoreBand(score: number): { cls: string; label: string } {
  if (score >= 70) return { cls: "good", label: "Strong fit" };
  if (score >= 45) return { cls: "warn", label: "Medium fit" };
  return { cls: "muted", label: "Weak fit" };
}

export interface NavContext {
  businessName: string;
  creditBalance: number;
  activeNav: "discover" | "my-opportunities" | "billing" | "other";
  csrfToken: string;
}

export function layout(title: string, bodyHtml: string, nav?: NavContext): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Groundline matches UK quarrying, aggregates and haulage businesses to commercial opportunities from live procurement data, with every figure traced back to its source.">
<title>${escapeHtml(title)} · Groundline</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>${STYLES}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${nav ? navHtml(nav) : ""}
<main id="main" class="content">${bodyHtml}</main>
</body>
</html>`;
}

function navHtml(nav: NavContext): string {
  const items: Array<[NavContext["activeNav"], string, string]> = [
    ["discover", "/discover", "Discover"],
    ["my-opportunities", "/my-opportunities", "My Opportunities"],
    ["billing", "/billing", "Credits & Billing"],
  ];
  return `<div class="topbar">
    <div class="topbar__brand">Groundline</div>
    <nav class="topbar__nav">
      ${items.map(([key, href, label]) => `<a class="navlink ${nav.activeNav === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
    </nav>
    <div class="topbar__right">
      <span class="pill pill--muted">${escapeHtml(nav.businessName)}</span>
      <span class="pill pill--accent">${nav.creditBalance} credits</span>
      <form method="post" action="/logout" style="display:inline"><input type="hidden" name="_csrf" value="${nav.csrfToken}"><button class="btn btn--ghost btn--sm" type="submit">Log out</button></form>
    </div>
  </div>`;
}

const STYLES = `
:root{--ground:#eef1ef;--surface:#fff;--surface-2:#e5e9e5;--surface-3:#dde2dd;--ink:#1a1d1b;--ink-secondary:#52564f;--ink-muted:#82877e;--border:#d5dad2;--border-strong:#c2c8bd;--accent:#c07a24;--accent-strong:#9c5f13;--accent-soft:#f2e2c7;--accent-ink:#5a3a0c;--good:#2e7d4f;--good-soft:#dbeee1;--good-ink:#1f5536;--warn:#a17a0c;--warn-soft:#f1e6c4;--warn-ink:#725509;--critical:#b23a2e;--critical-soft:#f5dad5;--critical-ink:#7e2a21;--info:#345f89;--info-soft:#dde6ee;--info-ink:#25445f;}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:'Public Sans',system-ui,sans-serif;font-size:14.5px;line-height:1.5}
.skip-link{position:absolute;left:-9999px;top:0;background:var(--accent);color:#fff;padding:.6rem 1rem;border-radius:0 0 8px 0;z-index:20;font-weight:700;font-size:.85rem}
.skip-link:focus{left:0}
h1,h2,h3{font-family:'Archivo',system-ui,sans-serif;font-weight:800;letter-spacing:-.01em;margin:0}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
a{color:inherit}
.topbar{display:flex;align-items:center;gap:1.5rem;padding:.9rem 2rem;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:5;flex-wrap:wrap}
.topbar__brand{font-family:'Archivo',system-ui,sans-serif;font-weight:800;font-size:1.05rem}
.topbar__nav{display:flex;gap:.25rem;flex:1}
.navlink{padding:.45rem .8rem;border-radius:8px;font-weight:600;font-size:.85rem;color:var(--ink-secondary)}
.navlink.active,.navlink:hover{background:var(--surface-3);color:var(--ink)}
.topbar__right{display:flex;align-items:center;gap:.5rem}
.content{padding:1.75rem 2rem 3rem;max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:1.5rem}
.btn{display:inline-flex;align-items:center;gap:.4rem;font-weight:700;font-size:.83rem;padding:.5rem .9rem;border-radius:8px;border:1px solid transparent;cursor:pointer;background:var(--accent);color:#fff}
.btn--ghost{background:transparent;border-color:var(--border-strong);color:var(--ink)}
.btn--sm{padding:.35rem .65rem;font-size:.76rem}
.btn:disabled{opacity:.5;cursor:not-allowed}
.badge{display:inline-flex;align-items:center;font-weight:700;font-size:.66rem;letter-spacing:.03em;text-transform:uppercase;padding:.22em .55em;border-radius:999px;border:1px solid transparent}
.badge--verified{background:var(--info-soft);color:var(--info-ink);border-color:var(--info)}
.badge--calculated{background:var(--surface-3);color:var(--ink-secondary);border-color:var(--border-strong)}
.badge--customer{background:var(--accent-soft);color:var(--accent-ink);border-color:var(--accent)}
.badge--estimated{background:var(--warn-soft);color:var(--warn-ink);border-color:var(--warn)}
.badge--unknown{background:transparent;color:var(--ink-muted);border-color:var(--border-strong);border-style:dashed}
.pill{display:inline-flex;align-items:center;gap:.3em;font-weight:700;font-size:.72rem;padding:.25em .6em;border-radius:999px}
.pill--good{background:var(--good-soft);color:var(--good-ink)}
.pill--warn{background:var(--warn-soft);color:var(--warn-ink)}
.pill--critical{background:var(--critical-soft);color:var(--critical-ink)}
.pill--muted{background:var(--surface-3);color:var(--ink-secondary)}
.pill--accent{background:var(--accent-soft);color:var(--accent-ink)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.1rem 1.25rem;box-shadow:0 1px 2px rgba(20,20,15,.06)}
.card-list{display:flex;flex-direction:column;gap:.7rem}
.opp-card{display:grid;grid-template-columns:56px 1fr auto;gap:1rem;align-items:flex-start;cursor:pointer}
.opp-card:hover{border-color:var(--border-strong)}
.ring{position:relative;width:52px;height:52px;border-radius:50%;background:conic-gradient(var(--ring-c) calc(var(--p)*3.6deg), var(--border) 0)}
.ring::after{content:'';position:absolute;inset:6px;border-radius:50%;background:var(--surface)}
.ring__num{position:absolute;inset:0;display:grid;place-items:center;font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:600;font-size:.92rem;z-index:1}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem}
@media (max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}.content{padding:1.25rem 1rem 2rem}}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem 1.1rem}
.tile__label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--ink-muted)}
.tile__value{font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:600;font-size:1.4rem}
.fact{display:flex;justify-content:space-between;gap:1rem;padding:.5rem 0;border-bottom:1px solid var(--border);font-size:.86rem}
.fact:last-child{border-bottom:none}
.fact__label{color:var(--ink-secondary)}
.fact__value{font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:600;text-align:right}
.evi-table{width:100%;border-collapse:collapse;font-size:.82rem}
.evi-table th{text-align:left;font-size:.68rem;text-transform:uppercase;color:var(--ink-muted);padding:.4rem .5rem;border-bottom:1px solid var(--border-strong)}
.evi-table td{padding:.5rem;border-bottom:1px solid var(--border);vertical-align:top}
.table-wrap{overflow-x:auto}
.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap}
input,textarea{border:1px solid var(--border-strong);border-radius:8px;padding:.5rem .65rem;font-family:inherit;font-size:.85rem;width:100%}
.form-row{display:flex;gap:.6rem}
.empty{border:1px dashed var(--border-strong);border-radius:12px;padding:2rem 1.5rem;text-align:center;color:var(--ink-muted)}
.alert{background:var(--warn-soft);border:1px solid var(--warn);color:var(--warn-ink);border-radius:10px;padding:.7rem .9rem;font-size:.83rem}
.alert--info{background:var(--info-soft);border-color:var(--info);color:var(--info-ink)}
`;
