import type { NormalizedLiveEvent, SimulatorMetrics } from "./types";

type Listener = (event: NormalizedLiveEvent) => void;

// ─── Live Event Bus ─────────────────────────────────────────────────
// Decouples event producers (adapters) from event consumers.
// Consumers subscribe without knowing which adapter produced the event.

const MAX_HISTORY = 2000;

class LiveEventBus {
  private listeners = new Set<Listener>();
  private history: NormalizedLiveEvent[] = [];
  private sequence = 0;
  private viewers = new Set<string>();
  private metrics: SimulatorMetrics = {
    eventsTotal: 0,
    likes: 0,
    comments: 0,
    gifts: 0,
    follows: 0,
    shares: 0,
    joins: 0,
    uniqueViewers: 0,
    giftCombos: 0,
    errors: 0,
    droppedEvents: 0,
    eventsPerSec: 0,
  };
  private eventsThisSecond = 0;
  private lastSecondMark = Date.now();

  emit(event: NormalizedLiveEvent): void {
    this.history.push(event);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }

    this.metrics.eventsTotal++;
    if (event.userId) this.viewers.add(event.userId);
    switch (event.type) {
      case "LIKE":
        this.metrics.likes++;
        break;
      case "COMMENT":
        this.metrics.comments++;
        break;
      case "GIFT":
        this.metrics.gifts++;
        if (event.comboState === "START") this.metrics.giftCombos++;
        break;
      case "FOLLOW":
        this.metrics.follows++;
        break;
      case "SHARE":
        this.metrics.shares++;
        break;
      case "JOIN":
        this.metrics.joins++;
        break;
      case "CHEST_CONTRIBUTION":
        // Tracked by chestManager, not bus metrics
        break;
      case "CONNECTION":
        if (event.status === "ERROR") this.metrics.errors++;
        break;
    }
    this.metrics.uniqueViewers = this.viewers.size;

    const now = Date.now();
    this.eventsThisSecond++;
    if (now - this.lastSecondMark >= 1000) {
      this.metrics.eventsPerSec = this.eventsThisSecond;
      this.eventsThisSecond = 0;
      this.lastSecondMark = now;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getHistory(): NormalizedLiveEvent[] {
    return [...this.history];
  }

  getHistorySlice(count: number): NormalizedLiveEvent[] {
    return this.history.slice(-count);
  }

  getMetrics(): SimulatorMetrics {
    return { ...this.metrics };
  }

  getLastEvent(): NormalizedLiveEvent | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  clearHistory(): void {
    this.history = [];
  }

  nextSequence(): number {
    return ++this.sequence;
  }

  reset(): void {
    this.listeners.clear();
    this.history = [];
    this.sequence = 0;
    this.viewers.clear();
    this.metrics = {
      eventsTotal: 0,
      likes: 0,
      comments: 0,
      gifts: 0,
      follows: 0,
      shares: 0,
      joins: 0,
      uniqueViewers: 0,
      giftCombos: 0,
      errors: 0,
      droppedEvents: 0,
      eventsPerSec: 0,
    };
    this.eventsThisSecond = 0;
    this.lastSecondMark = Date.now();
  }
}

export const liveEventBus = new LiveEventBus();
