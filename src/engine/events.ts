import type { EngineEvent, EngineEventType } from "@/domain/types";

const MAX_EVENTS = 500;

export function createEvent(
  type: EngineEventType,
  battleId?: string,
  payload?: Record<string, unknown>,
  loopSessionId?: string
): EngineEvent {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    battleId,
    loopSessionId,
    payload,
  };
}

export function appendEvent(
  events: EngineEvent[],
  event: EngineEvent
): EngineEvent[] {
  const next = [...events, event];
  if (next.length > MAX_EVENTS) {
    return next.slice(next.length - MAX_EVENTS);
  }
  return next;
}

export function formatEventTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
