import { HealthResponseSchema, type HealthResponse } from "@ottv2/contracts";
import { ApiError } from "../http/apiError";
import { getJson } from "../http/httpClient";

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const parsed = HealthResponseSchema.safeParse(await getJson("/health", signal));
  if (!parsed.success) throw new ApiError("Phản hồi trạng thái không đúng định dạng.", undefined, "INVALID_RESPONSE");
  return parsed.data;
}
