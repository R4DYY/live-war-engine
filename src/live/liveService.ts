import type { LiveEventAdapter, NormalizedLiveEvent } from "./types";
import { ReplayRecorder } from "./replay";

// ─── Live Service ────────────────────────────────────────────────────
// Single entry point for swapping adapters without touching gameplay code.
// Usage: liveService.useAdapter(simulatorAdapter);
// Later: liveService.useAdapter(tiktokAdapter);

type Listener = (event: NormalizedLiveEvent) => void;

class LiveService {
  private adapter: LiveEventAdapter | null = null;
  private unsubscribeAdapter: (() => void) | null = null;
  private listeners = new Set<Listener>();
  private recorder = new ReplayRecorder();

  useAdapter(adapter: LiveEventAdapter): void {
    if (this.unsubscribeAdapter) {
      this.unsubscribeAdapter();
      this.unsubscribeAdapter = null;
    }
    this.adapter = adapter;
    this.unsubscribeAdapter = adapter.subscribe((event) => {
      if (this.recorder.isRecording()) {
        this.recorder.record(event);
      }
      for (const listener of this.listeners) {
        listener(event);
      }
    });
  }

  async start(): Promise<void> {
    if (this.adapter) await this.adapter.start();
  }

  stop(): void {
    if (this.adapter) this.adapter.stop();
  }

  getStatus(): string {
    return this.adapter ? this.adapter.getStatus() : "DISCONNECTED";
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Broadcast to service-level subscribers
  emit(event: NormalizedLiveEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ─── Recording ─────────────────────────────────────────────────────

  startRecording(): void {
    this.recorder.start();
  }

  stopRecording() {
    return this.recorder.stop();
  }

  isRecording(): boolean {
    return this.recorder.isRecording();
  }

  getRecordedCount(): number {
    return this.recorder.getEventCount();
  }
}

export const liveService = new LiveService();
