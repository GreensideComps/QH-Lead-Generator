import { z } from "zod";

/**
 * Strict schema validation for model output — added because the previous
 * implementation did `JSON.parse(extractJson(text))` with no shape
 * checking at all, meaning a malformed or unexpected model response could
 * flow straight into a database insert (docs/architecture/04-implementation-status.md
 * audit finding). A response that fails this validation is treated as a
 * failure (logged as 'invalid_response'), never coerced into something
 * that looks valid.
 */
export const ExtractedFieldSchema = z.object({
  field_name: z.string().min(1),
  value: z.string().min(1),
  confidence: z.enum(["verified", "inferred", "unknown"]),
  source_span: z.string().nullable(),
});

export const ExtractionResponseSchema = z.object({
  fields: z.array(ExtractedFieldSchema),
  notes: z.string().default(""),
});

export const VerifiedFieldSchema = ExtractedFieldSchema.extend({
  verification_note: z.string().optional(),
});

export const VerificationResponseSchema = z.object({
  verified_fields: z.array(VerifiedFieldSchema),
});

export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
export type VerifiedField = z.infer<typeof VerifiedFieldSchema>;
