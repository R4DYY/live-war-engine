import type { LiveEventAdapter, LiveConnectionStatus, NormalizedLiveEvent } from "@/live/types";
import { liveEventBus } from "@/live/liveEventBus";
import { tiktokBridgeClient } from "@/live/tiktokBridgeClient";

type Listener = (event: NormalizedLiveEvent) => void;

export class TikTokAdapter implements LiveEventAdapter {
  private listeners = new Set<Listener>();
  private status: LiveConnectionStatus = "DISCONNECTED";
  private unsubscribeEvents: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;

  start(): void {
    if (this.unsubscribeEvents) return;
    this.unsubscribeEvents = tiktokBridgeClient.subscribe((event) => {
      liveEventBus.emit(event);
      for (const listener of this.listeners) listener(event);
    });
    this.unsubscribeStatus = tiktokBridgeClient.subscribeState((state) => { this.status = state.status; });
    tiktokBridgeClient.connect();
  }

  stop(): void {
    this.unsubscribeEvents?.();
    this.unsubscribeStatus?.();
    this.unsubscribeEvents = null;
    this.unsubscribeStatus = null;
    tiktokBridgeClient.disconnect();
    this.status = "DISCONNECTED";
  }

  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getStatus(): LiveConnectionStatus { return this.status; }
  connect(username: string): void { tiktokBridgeClient.sendConnect(username); }
  disconnect(): void { tiktokBridgeClient.send("DISCONNECT_TIKTOK"); }
  reconnect(): void { tiktokBridgeClient.send("RECONNECT_TIKTOK"); }
}

export const tiktokAdapter = new TikTokAdapter();
