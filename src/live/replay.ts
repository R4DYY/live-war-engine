import type { ReplayRecording, RecordedEvent, NormalizedLiveEvent } from "./types";

// ─── Replay System ──────────────────────────────────────────────────
// Records normalized events with timestamps and replays them in order.

export class ReplayRecorder {
  private events: RecordedEvent[] = [];
  private startMs: number | null = null;
  private recording = false;

  start(): void {
    this.events = [];
    this.startMs = Date.now();
    this.recording = true;
  }

  record(event: NormalizedLiveEvent): void {
    if (!this.recording || this.startMs === null) return;
    this.events.push({
      offsetMs: event.timestamp - this.startMs,
      event,
    });
  }

  stop(): ReplayRecording {
    this.recording = false;
    const recording: ReplayRecording = {
      id: crypto.randomUUID(),
      events: [...this.events],
      createdAt: Date.now(),
    };
    this.events = [];
    this.startMs = null;
    return recording;
  }

  isRecording(): boolean {
    return this.recording;
  }

  getEventCount(): number {
    return this.events.length;
  }
}

export type ReplayCallback = (event: NormalizedLiveEvent) => void;

export function replayRecording(
  recording: ReplayRecording,
  callback: ReplayCallback,
  speed: number = 1
): { cancel: () => void } {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;

  for (const recorded of recording.events) {
    const delay = recorded.offsetMs / speed;
    const timer = setTimeout(() => {
      if (!cancelled) callback(recorded.event);
    }, delay);
    timers.push(timer);
  }

  return {
    cancel: () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    },
  };
}

export function recordingToJson(recording: ReplayRecording): string {
  return JSON.stringify(recording, null, 2);
}

export function recordingFromJson(json: string): ReplayRecording {
  const parsed = JSON.parse(json);
  return {
    id: parsed.id ?? crypto.randomUUID(),
    events: parsed.events ?? [],
    createdAt: parsed.createdAt ?? Date.now(),
    label: parsed.label,
  };
}
