import { env } from "../../config/env";
import { ApiError } from "./apiError";
import { trackUiEvent } from "../telemetry/uiTelemetry";

function dispatchWindowEvent(name: string, detail?: Record<string, unknown>): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}

function shouldNotifySessionExpiry(path: string): boolean {
  return !["/auth/login", "/auth/register", "/auth/recover", "/auth/me"].some((prefix) => path.startsWith(prefix));
}

export async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch {
    dispatchWindowEvent("ottv2:network-state", { state: "OFFLINE" });
    trackUiEvent("http_request", { method: "GET", path, state: "OFFLINE", durationMs: Math.round(performance.now() - startedAt) });
    throw new ApiError("Không thể kết nối tới máy chủ.");
  }
  const state = response.status >= 500 ? "DEGRADED" : response.status === 408 || response.status === 429 ? "RECONNECTING" : "CONNECTED";
  dispatchWindowEvent("ottv2:network-state", { state });
  trackUiEvent("http_request", { method: "GET", path, status: response.status, state, durationMs: Math.round(performance.now() - startedAt) });
  if (!response.ok) {
    if (response.status === 401 && shouldNotifySessionExpiry(path)) dispatchWindowEvent("ottv2:session-expired");
    try {
      const error = await response.json() as { message?: unknown; code?: unknown };
      throw new ApiError(typeof error.message === "string" ? error.message : "Máy chủ chưa sẵn sàng.", response.status, typeof error.code === "string" ? error.code : "HTTP_ERROR");
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Máy chủ chưa sẵn sàng.", response.status, "HTTP_ERROR");
    }
  }
  try { return await response.json(); }
  catch { throw new ApiError("Phản hồi từ máy chủ không hợp lệ.", response.status, "INVALID_JSON"); }
}

export async function requestJson<T = unknown>(path: string, options: { method: "POST" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> } ): Promise<T> {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method,
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    dispatchWindowEvent("ottv2:network-state", { state: "OFFLINE" });
    trackUiEvent("http_request", { method: options.method, path, state: "OFFLINE", durationMs: Math.round(performance.now() - startedAt) });
    throw new ApiError("Không thể kết nối tới máy chủ.");
  }
  const state = response.status >= 500 ? "DEGRADED" : response.status === 408 || response.status === 429 ? "RECONNECTING" : "CONNECTED";
  dispatchWindowEvent("ottv2:network-state", { state });
  trackUiEvent("http_request", { method: options.method, path, status: response.status, state, durationMs: Math.round(performance.now() - startedAt) });
  let payload: unknown = undefined;
  if (response.status !== 204) {
    try { payload = await response.json(); }
    catch { if (response.ok) throw new ApiError("Phản hồi từ máy chủ không hợp lệ.", response.status, "INVALID_JSON"); }
  }
  if (!response.ok) {
    if (response.status === 401 && shouldNotifySessionExpiry(path)) dispatchWindowEvent("ottv2:session-expired");
    const error = payload as { message?: unknown; code?: unknown } | undefined;
    throw new ApiError(typeof error?.message === "string" ? error.message : "Máy chủ chưa sẵn sàng.", response.status, typeof error?.code === "string" ? error.code : "HTTP_ERROR");
  }
  return payload as T;
}
