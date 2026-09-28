import { HealthResponseSchema, type HealthResponse } from "@ottv2/contracts";
import { ApiError } from "../http/apiError";
import { getJson } from "../http/httpClient";

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const parsed = HealthResponseSchema.safeParse(await getJson("/health", signal));
  if (!parsed.success) throw new ApiError("Phản hồi trạng thái không đúng định dạng.", undefined, "INVALID_RESPONSE");
  return parsed.data;
}

/**
 * Realtime is an optional transport boundary in local v0.1. The API and
 * database are the core service readiness signal for the global app shell.
 */
export function isCoreServiceReady(health: HealthResponse): boolean {
  return health.components.application.status === "ok" && health.components.database.status === "ok";
}
