import type { NormalizedLiveEvent, LiveConnectionStatus } from "@/live/types";

export interface TikTokBridgeState {
  status: LiveConnectionStatus;
  username: string | null;
  roomId: string | null;
  connectedAt: number | null;
  lastEventAt: number | null;
  reconnects: number;
  duplicateEventsDropped: number;
  unknownGifts: number;
  viewerCount: number;
  peakViewerCount: number;
  errorMessage?: string;
}

export interface TikTokGiftCatalogItem {
  giftId: string;
  giftName: string;
  diamondCount?: number;
  imageUrl?: string;
}

type BridgeMessage =
  | { type: "TIKTOK_STATUS"; state: TikTokBridgeState; message?: string }
  | { type: "TIKTOK_EVENT"; event: NormalizedLiveEvent }
  | { type: "TIKTOK_GIFT_CATALOG"; catalog: unknown }
  | { type: "TIKTOK_METRICS"; state: TikTokBridgeState }
  | { type: "TIKTOK_ERROR"; message: string };

type Listener = (event: NormalizedLiveEvent) => void;
type StateListener = (state: TikTokBridgeState) => void;
type SendType = "CONNECT_TIKTOK" | "DISCONNECT_TIKTOK" | "RECONNECT_TIKTOK" | "REQUEST_GIFT_CATALOG";

const BRIDGE_URL = import.meta.env.VITE_LIVE_BRIDGE_URL;

export class TikTokBridgeClient {
  private socket: WebSocket | null = null;
  private eventListeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private messageQueue: Array<{ type: SendType; username?: string }> = [];
  private state: TikTokBridgeState = {
    status: "DISCONNECTED", username: null, roomId: null, connectedAt: null,
    lastEventAt: null, reconnects: 0, duplicateEventsDropped: 0,
    unknownGifts: 0, viewerCount: 0, peakViewerCount: 0,
  };

  connect(): void {
    this.manuallyClosed = false;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    const url = BRIDGE_URL ?? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/live-bridge`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      const queue = this.messageQueue;
      this.messageQueue = [];
      for (const msg of queue) {
        this.socket?.send(JSON.stringify(msg));
      }
    };

    this.socket.onmessage = (message: MessageEvent<string>) => {
      try {
        this.handleMessage(JSON.parse(message.data) as BridgeMessage);
      } catch {
        // ignore malformed messages
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (!this.manuallyClosed) {
        const errorMessage = "TikTok bridge unavailable. Refresh the app and try again.";
        this.updateState({ ...this.state, status: "ERROR", errorMessage });
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };

    this.socket.onerror = () => {
      this.updateState({
        ...this.state,
        status: "ERROR",
        errorMessage: "TikTok bridge unavailable. Refresh the app and try again.",
      });
    };
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.messageQueue = [];
    this.socket?.close();
    this.socket = null;
    this.updateState({ ...this.state, status: "DISCONNECTED" });
  }

  subscribe(listener: Listener): () => void {
    this.eventListeners.add(listener);
    return () => { this.eventListeners.delete(listener); };
  }

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => { this.stateListeners.delete(listener); };
  }

  getState(): TikTokBridgeState { return { ...this.state }; }

  send(type: SendType, username?: string): void {
    this.connect();
    const payload = JSON.stringify({ type, username });
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
    } else {
      this.messageQueue.push({ type, username });
    }
  }

  private handleMessage(message: BridgeMessage): void {
    if (message.type === "TIKTOK_EVENT") {
      for (const listener of this.eventListeners) listener(message.event);
    }
    if (message.type === "TIKTOK_STATUS" || message.type === "TIKTOK_METRICS") {
      this.updateState(message.state);
    }
  }

  private updateState(state: TikTokBridgeState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(this.state);
  }
}

export const tiktokBridgeClient = new TikTokBridgeClient();
