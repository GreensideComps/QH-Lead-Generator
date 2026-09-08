import { EXTRACTION_SYSTEM_PROMPT, VERIFICATION_SYSTEM_PROMPT } from "./prompts.js";
import { callClaude, logInvalidResponse, ClaudeCallError } from "../lib/claudeClient.js";
import { ExtractionResponseSchema, VerificationResponseSchema, type ExtractedField, type VerifiedField } from "./schemas.js";

export type { ExtractedField, VerifiedField } from "./schemas.js";

/**
 * Real, callable Extraction Agent — Claude, mid tier, per
 * docs/architecture/03-ai-routing-strategy.md. Requires ANTHROPIC_API_KEY
 * (ClaudeNotConfiguredError otherwise — see src/lib/claudeClient.ts).
 * Every response is schema-validated (schemas.ts) before being trusted;
 * a response that doesn't match the expected shape is logged as
 * 'invalid_response' and rejected, never coerced or partially accepted.
 */
export async function runExtraction(
  title: string,
  description: string,
  context?: { procurementId?: string },
): Promise<{ fields: ExtractedField[]; notes: string; model: string }> {
  const result = await callClaude({
    task: "extraction",
    system: EXTRACTION_SYSTEM_PROMPT,
    userContent: `Notice title: ${title}\n\nNotice description:\n${description || "(no description provided)"}`,
    maxTokens: 1024,
    context,
  });

  const parsed = safeParseJson(result.text);
  const validated = ExtractionResponseSchema.safeParse(parsed);
  if (!validated.success) {
    await logInvalidResponse(
      { task: "extraction", system: EXTRACTION_SYSTEM_PROMPT, userContent: "", maxTokens: 0, context },
      result.model,
      validated.error.message,
    );
    throw new ClaudeCallError(`Extraction response failed schema validation: ${validated.error.message}`);
  }

  return { ...validated.data, model: result.model };
}

/**
 * Real, callable Verification Agent — independent second pass, per
 * docs/research/06-system-design.md. Same key requirement and validation
 * discipline as runExtraction.
 */
export async function runVerification(
  originalText: string,
  claimedFields: ExtractedField[],
  context?: { procurementId?: string },
): Promise<{ verified_fields: VerifiedField[]; model: string }> {
  const result = await callClaude({
    task: "verification",
    system: VERIFICATION_SYSTEM_PROMPT,
    userContent: `Original notice text:\n${originalText}\n\nClaimed fields:\n${JSON.stringify(claimedFields, null, 2)}`,
    maxTokens: 1024,
    context,
  });

  const parsed = safeParseJson(result.text);
  const validated = VerificationResponseSchema.safeParse(parsed);
  if (!validated.success) {
    await logInvalidResponse(
      { task: "verification", system: VERIFICATION_SYSTEM_PROMPT, userContent: "", maxTokens: 0, context },
      result.model,
      validated.error.message,
    );
    throw new ClaudeCallError(`Verification response failed schema validation: ${validated.error.message}`);
  }

  return { ...validated.data, model: result.model };
}

function safeParseJson(text: string): unknown {
  // Claude sometimes wraps JSON in prose or a fenced code block; take the
  // outermost {...} block defensively rather than assuming a bare JSON reply.
  const match = text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : "{}");
  } catch {
    return {};
  }
}
