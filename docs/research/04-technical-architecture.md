# Phase 1 Research — Technical Architecture & Ecosystem

*Researched via live web search, September 2026. Verify version-specific details before committing, as this space moves fast.*

## 1. Supabase

Hosted Postgres with pgvector enabled by default, Auth, Storage, Edge Functions (Deno serverless), Realtime, and Row Level Security as the core access-control model — a genuine simplification versus running Postgres + a separate vector DB + a separate auth service. [What Is Supabase](https://www.mindstudio.ai/blog/what-is-supabase), [RLS](https://supabase.com/features/row-level-security)

**MCP/connector status**: As of Feb 2026, Supabase is an **official Claude connector** (appears in Claude's connectors menu, not just a third-party MCP). There's also the open-source `supabase-community/supabase-mcp` (32 tools: SQL execution, schema/migrations, branching, Edge Function deploy, storage, TS type generation, security advisories, project provisioning). [Supabase — official Claude connector](https://supabase.com/blog/supabase-is-now-an-official-claude-connector), [supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp)

**Setup (human-gated — cannot be completed autonomously)**:
- Cloud connector path: human authorizes via Claude's connectors menu (OAuth).
- CLI/self-hosted path: `claude mcp add` with a Supabase Personal Access Token or project-scoped API key (scope via `project_ref`, else the server sees every project in the account). Self-hosted exposes an MCP endpoint at `localhost:54321/mcp` with reduced toolset, no OAuth.
- **Either way, a Supabase account/project and its API keys must be created/authorized by the user.**

**Recommendation**: Strong fit. Postgres + pgvector + RLS + Auth + Edge Functions covers relational storage, semantic search, and auth in one platform; RLS is a natural fit for multi-tenant customer-profile/matching data. Use a project-scoped service-role key for background ingestion workers; use the OAuth connector only for interactive admin work.

## 2. OpenRouter

A model-routing/aggregation API giving access to 400+ LLMs across providers, with routing hints via model-slug suffixes (`:online`, `:nitro`, `:floor`, `:free`). Official MCP server is remote-hosted (`mcp.openrouter.ai/mcp`), added via `claude mcp add --transport http`, requiring **human OAuth** (mints a scoped key, 7-day expiry, $10 default spend cap). [OpenRouter MCP docs](https://openrouter.ai/docs/guides/overview/mcp-server)

**Is it the right choice here?** Mixed. OpenRouter's value is being provider-agnostic — useful if genuinely routing across Anthropic/OpenAI/Google/open-weight models on live price/latency. For a Claude-centric orchestration layer, it adds a routing hop, an extra billing relationship, and loses first-party Anthropic features (prompt-caching semantics, Batch API, Files API) that only work cleanly against Anthropic directly.

**Recommendation**: Use **Claude's own model tiers directly** — cheap tier for bulk triage/filtering of procurement notices, mid tier for standard extraction/analysis, premium tier for the hardest matching/reasoning calls — combined with **prompt caching** (up to ~90% off cache hits) and the **Batch API** (50% off) as the primary cost levers for the ingestion pipeline. This beats OpenRouter on cost and feature depth for a Claude-first stack. Reach for OpenRouter only if the roadmap later needs genuine multi-provider redundancy or non-Anthropic model A/B testing.

## 3. Playwright

**MCP server**: Actively maintained by **Microsoft** (`microsoft/playwright-mcp`, Apache 2.0, `npx @playwright/mcp@latest`). Exposes browser automation via **accessibility-tree snapshots** rather than screenshots/vision — 50+ tools spanning navigation, form interaction, tab/network/storage handling, tracing, PDF generation. [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)

**AI testing agents**: Current Playwright ships three built-in AI agent roles — **Planner, Generator, Healer**. Planner/Generator turn plain-language specs into committable Playwright test code; Healer does self-healing locator repair using accessibility-role-based identification when a UI change breaks a selector.

**Relevance**: (1) the MCP server for research/browser-automation during development (inspecting live procurement/planning portals), and (2) Playwright + its agents for E2E testing of the eventual dashboard UI, with self-healing locators reducing maintenance. No account/credential blockers — open-source, npm-installable.

## 4. Shopify as commerce/billing layer

**Capabilities**: Real subscription stack — Subscription Contract API, Billing Management API, Billing Cycle API, Payment Methods API, Product Subscription App Extension, plus B2B-specific APIs (company accounts, custom price lists).

**Where it breaks down for this product**: Multiple sources converge on the same finding: Shopify's billing model is built around commerce carts/checkout, not SaaS contract billing. Enterprise B2B customers wanting annual-paid-monthly contracts, or manually-provisioned custom plans/discounts, run into structural limits — Shopify's billing system was designed for retail checkout flows. [The B2B Billing Wall](https://tightly.io/newsroom/the-b2b-billing-wall-a-guide-to-saas-subcription-management)

**"Commerce layer bolted on" vs "build on Shopify"**: The pattern that works is headless Shopify (backend commerce engine behind a custom frontend via Storefront/Admin APIs) — viable for storefronts, but this product isn't a storefront: no cart, no physical/digital "product" being purchased, just recurring seat/tier-based access to a data product.

**Stripe comparison**: Stripe Billing is purpose-built for exactly this case — subscriptions, usage/metered billing, tiered pricing, proration, dunning, trials, invoicing, all first-class, no commerce-platform lock-in.

**Recommendation: do not use Shopify for this product.** It has no cart/checkout/inventory shape — it's seat- or usage-based B2B SaaS access. **Use Stripe Billing directly.** This directly contradicts the brief's original hypothesis that "Shopify should probably handle commerce/subscriptions" — the research does not support that. Reserve Shopify only if the roadmap later adds a genuinely commerce-shaped add-on (e.g., a marketplace of purchasable data reports).

## 5. Claude Code: MCP, subagents, skills, hooks (current official capability check)

All four are genuinely supported today (confirmed against `code.claude.com/docs/en`):
- **MCP servers**: `claude mcp add`, transports `http` (recommended, remote), `stdio` (local), `sse` (deprecated), `websocket`. Three scopes: local, project (`.mcp.json`, shareable via VCS), user. Auth via OAuth, static headers/API keys, or a `headersHelper` script.
- **Subagents**: Markdown files with YAML frontmatter under `.claude/agents/`, with tool allow/deny lists, per-agent model selection (route cheap subagents to a cheaper model), permission modes, isolated context windows.
- **Skills**: `SKILL.md` files (project/personal/enterprise/plugin scoped), auto- or manually-invoked, supporting dynamic context injection and argument passing.
- **Hooks**: JSON-configured lifecycle handlers (`PreToolUse`, `PostToolUse`, `SessionStart`, `UserPromptSubmit`, `Stop`, etc.) that can run shell commands, HTTP calls, MCP tool calls, or LLM prompts — used for deterministic guardrails around agentic workflows.

## Items requiring the user's own account/credentials (cannot be completed autonomously in this session)

- **Supabase**: cloud OAuth authorization, or a Supabase project + API key/PAT.
- **OpenRouter**: OAuth authorization to mint a scoped key (only relevant if the OpenRouter recommendation above is overridden).
- **Stripe**: account creation and API key generation for Billing.
- **Anthropic API key** / organization billing for production Claude usage beyond this session.

Playwright and Claude Code's own MCP/subagent/skill/hook mechanisms need no third-party account and can be configured directly once the project's actual codebase exists.
