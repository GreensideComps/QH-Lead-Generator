import Anthropic from "@anthropic-ai/sdk";
import { servicePool } from "../db/pool.js";

/**
 * Single shared entry point for every Claude call in Groundline (extraction,
 * verification, synthesis) — per the instruction not to create duplicate AI
 * systems. Centralises: explicit timeout, retry behaviour, latency/cost
 * logging (ai_call_log, 0006_ai_call_log.sql), and the no-key-vs-API-error
 * distinction that callers need for honest error handling.
 *
 * Model tier: "claude-sonnet-5" — the current Sonnet tier (see CLAUDE.md /
 * docs/architecture/03-ai-routing-strategy.md: mid tier for extraction,
 * verification, and synthesis; no OpenRouter/OmniRoute).
 */
export const CLAUDE_MODEL = "claude-sonnet-5";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2; // Anthropic SDK's own default; set explicitly rather than relying on an implicit default

export type AiTask = "extraction" | "verification" | "synthesis";

export class ClaudeNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured in this environment");
  }
}

export class ClaudeCallError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}

export interface ClaudeCallOptions {
  task: AiTask;
  system: string;
  userContent: string;
  maxTokens: number;
  context?: { procurementId?: string; opportunityId?: string; businessId?: string };
}

export interface ClaudeCallResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Makes one Claude call with logging. Throws ClaudeNotConfiguredError if no
 * key is set (callers decide whether that's fatal or a fallback trigger —
 * this function never fabricates a response either way) and ClaudeCallError
 * on any API-level failure (timeout, rate limit, malformed request, etc.)
 * AFTER logging the failure to ai_call_log, so a failed call is always
 * observable, never silent.
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await logAiCall({ ...opts, status: "skipped_no_key" });
    throw new ClaudeNotConfiguredError();
  }

  const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
  const started = Date.now();

  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.userContent }],
    });
    const latencyMs = Date.now() - started;
    const text = message.content.find((b) => b.type === "text")?.text ?? "";

    await logAiCall({
      ...opts,
      status: "success",
      model: message.model,
      inputTokens: message.usage?.input_tokens,
      outputTokens: message.usage?.output_tokens,
      latencyMs,
    });

    return {
      text,
      model: message.model,
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    await logAiCall({ ...opts, status: "api_error", latencyMs, errorMessage: message });
    throw new ClaudeCallError(`Claude API call failed (task=${opts.task}): ${message}`, err);
  }
}

/** Call this when a response was received but failed schema validation — a distinct failure mode from a transport/API error. */
export async function logInvalidResponse(opts: ClaudeCallOptions, model: string, errorMessage: string): Promise<void> {
  await logAiCall({ ...opts, status: "invalid_response", model, errorMessage });
}

interface LogParams {
  task: AiTask;
  context?: { procurementId?: string; opportunityId?: string; businessId?: string };
  status: "success" | "api_error" | "invalid_response" | "skipped_no_key";
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  errorMessage?: string;
}

async function logAiCall(params: LogParams): Promise<void> {
  try {
    await servicePool.query(
      `insert into ai_call_log (task, model, status, input_tokens, output_tokens, latency_ms, error_message, procurement_id, opportunity_id, business_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        params.task,
        params.model ?? null,
        params.status,
        params.inputTokens ?? null,
        params.outputTokens ?? null,
        params.latencyMs ?? null,
        params.errorMessage ?? null,
        params.context?.procurementId ?? null,
        params.context?.opportunityId ?? null,
        params.context?.businessId ?? null,
      ],
    );
  } catch (logErr) {
    // Logging must never break the caller's actual request — but it must be visible.
    console.error("Failed to write ai_call_log row:", logErr);
  }
}
