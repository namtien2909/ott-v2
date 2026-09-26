import { z } from "zod";

export const ErrorSeveritySchema = z.enum([
  "RECOVERABLE",
  "INVALID",
  "FATAL_SESSION"
]);

export const PublicErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "CONFLICT",
  "RATE_LIMITED",
  "NOT_FOUND",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
  "PROTOCOL_VERSION_MISMATCH"
]);

export const ErrorEnvelopeSchema = z.object({
  code: PublicErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  severity: ErrorSeveritySchema,
  details: z.record(z.string(), z.unknown()).default({})
});

export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>;
export type PublicErrorCode = z.infer<typeof PublicErrorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
