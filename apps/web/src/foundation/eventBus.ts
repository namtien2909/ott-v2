export type SemanticEventType =
  | "MOVE" | "SELECT" | "CAPTURE" | "GOAL_TENSION" | "MATCH_FOUND" | "READY" | "COUNTDOWN"
  | "VICTORY" | "DEFEAT" | "TIMEOUT" | "SURRENDER" | "DISCONNECT_TIMEOUT" | "SERVER_INTERRUPTION"
  | "REMATCH" | "ROUTE_GLITCH" | "CLOCK_WARNING" | "TOAST" | "COMBAT_FEED";

export type SemanticEvent<TPayload = unknown> = Readonly<{
  eventId: string;
  stateVersion: number;
  emittedAt: number;
  source: string;
  type: SemanticEventType;
  payload: TPayload;
}>;

export type SemanticEventListener = (event: SemanticEvent) => void;

export function createSemanticEvent<TPayload>(input: Omit<SemanticEvent<TPayload>, "emittedAt"> & { emittedAt?: number }): SemanticEvent<TPayload> {
  return { ...input, emittedAt: input.emittedAt ?? Date.now() };
}

export class SemanticEventBus {
  private readonly listeners = new Set<SemanticEventListener>();
  private readonly seenEventIds = new Set<string>();
  private readonly latestVersionByType = new Map<SemanticEventType, number>();

  subscribe(listener: SemanticEventListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  emit(event: SemanticEvent): boolean {
    if (this.seenEventIds.has(event.eventId)) return false;
    const latest = this.latestVersionByType.get(event.type);
    if (latest !== undefined && event.stateVersion < latest) return false;
    this.seenEventIds.add(event.eventId);
    this.latestVersionByType.set(event.type, Math.max(latest ?? event.stateVersion, event.stateVersion));
    this.listeners.forEach((listener) => listener(event));
    return true;
  }

  clear(): void { this.seenEventIds.clear(); this.latestVersionByType.clear(); }
}

export const semanticEventBus = new SemanticEventBus();
