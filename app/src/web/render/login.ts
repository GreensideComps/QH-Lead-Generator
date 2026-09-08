import { layout, escapeHtml } from "./layout.js";
import { csrfField } from "../csrf.js";

export function renderLogin(csrfToken: string, error?: string): string {
  const body = `
    <div style="max-width:360px;margin:4rem auto;display:flex;flex-direction:column;gap:1rem;">
      <div style="text-align:center;">
        <div style="font-family:'Archivo',system-ui,sans-serif;font-weight:800;font-size:1.3rem;">Groundline</div>
        <div style="color:var(--ink-muted);font-size:.85rem;">Commercial opportunity intelligence</div>
      </div>
      <form method="post" action="/login" class="card" style="display:flex;flex-direction:column;gap:.8rem;">
        ${csrfField(csrfToken)}
        ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}
        <div><label for="email" style="font-size:.76rem;font-weight:700;">Email</label><input id="email" type="email" name="email" autocomplete="email" required value="demo@nrs-services.example"></div>
        <div><label for="password" style="font-size:.76rem;font-weight:700;">Password</label><input id="password" type="password" name="password" autocomplete="current-password" required value="demo-password-change-me"></div>
        <button class="btn" type="submit">Log in</button>
        <div style="font-size:.72rem;color:var(--ink-muted);">Demo credentials are pre-filled — this is a seeded demonstration profile, not a real customer. See docs/architecture/04-implementation-status.md.</div>
      </form>
    </div>
  `;
  return layout("Log in", body);
}
