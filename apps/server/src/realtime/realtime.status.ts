import type { RealtimeSubsystemStatus } from "./realtime.port.js";

export function realtimeNotConfigured(): RealtimeSubsystemStatus {
  return { status: "degraded", reason: "not_configured" };
}
