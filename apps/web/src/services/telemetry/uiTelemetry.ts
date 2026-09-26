export type UiTelemetryEvent = { name: string; timestamp: number; detail?: Record<string, unknown> };

const recentEvents: UiTelemetryEvent[] = [];
const MAX_EVENTS = 100;

export function trackUiEvent(name: string, detail?: Record<string, unknown>): void {
  const event = { name, timestamp: Date.now(), ...(detail ? { detail } : {}) };
  recentEvents.push(event);
  if (recentEvents.length > MAX_EVENTS) recentEvents.splice(0, recentEvents.length - MAX_EVENTS);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ottv2:ui-telemetry", { detail: event }));
}

export function getRecentUiTelemetry(): readonly UiTelemetryEvent[] { return recentEvents; }
