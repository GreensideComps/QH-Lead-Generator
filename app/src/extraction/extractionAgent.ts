import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_SYSTEM_PROMPT, VERIFICATION_SYSTEM_PROMPT } from "./prompts.js";

export interface ExtractedField {
  field_name: string;
  value: string;
  confidence: "verified" | "inferred" | "unknown";
  source_span: string | null;
}

export interface VerifiedField extends ExtractedField {
  verification_note?: string;
}

/**
 * Real, callable Extraction Agent — Claude, mid tier, per
 * docs/architecture/03-ai-routing-strategy.md. Requires ANTHROPIC_API_KEY.
 *
 * When no key is configured (true in this sandbox — see
 * docs/architecture/04-implementation-status.md), this throws rather than
 * silently returning fabricated data. Callers (run-extraction.ts) must
 * handle that by skipping the notice and logging it, never by inventing
 * a result.
 */
export async function runExtraction(title: string, description: string): Promise<{ fields: ExtractedField[]; notes: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured — cannot run live extraction");
  }
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Notice title: ${title}\n\nNotice description:\n${description || "(no description provided)"}`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(extractJson(text));
}

/**
 * Real, callable Verification Agent — independent second pass, per
 * docs/research/06-system-design.md. Same key requirement as above.
 */
export async function runVerification(
  originalText: string,
  claimedFields: ExtractedField[],
): Promise<{ verified_fields: VerifiedField[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured — cannot run live verification");
  }
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: VERIFICATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Original notice text:\n${originalText}\n\nClaimed fields:\n${JSON.stringify(claimedFields, null, 2)}`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(extractJson(text));
}

function extractJson(text: string): string {
  // Claude sometimes wraps JSON in prose or a fenced code block; take the
  // outermost {...} block defensively rather than assuming a bare JSON reply.
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}
