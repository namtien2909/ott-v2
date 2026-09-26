export type ErrorSeverity = "RECOVERABLE" | "INVALID" | "FATAL_SESSION";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "PROTOCOL_VERSION_MISMATCH";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean,
    public readonly severity: ErrorSeverity,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "AppError";
  }
}
