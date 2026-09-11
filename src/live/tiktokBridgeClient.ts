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

export type BridgeConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "ERROR";

export interface BridgeState {
  status: BridgeConnectionStatus;
  errorMessage?: string;
}

export interface TikTokGiftCatalogItem {
  giftId: string;
  giftName: string;
  diamondCount?: number;
  imageUrl?: string;
}

export type BridgeErrorCode =
  | "USERNAME_REQUIRED"
  | "LIVE_NOT_FOUND"
  | "ACCOUNT_NOT_LIVE"
  | "EULER_API_KEY_MISSING"
  | "TIKTOK_CONNECTION_FAILED"
  | "BRIDGE_ERROR"
  | "BRIDGE_URL_NOT_CONFIGURED";

type BridgeMessage =
  | { type: "BRIDGE_STATUS"; status: BridgeConnectionStatus; message?: string }
  | { type: "TIKTOK_STATUS"; state: TikTokBridgeState; message?: string }
  | { type: "TIKTOK_CONNECTED"; username: string; roomId: string; connectedAt: number }
  | { type: "TIKTOK_DISCONNECTED"; message?: string }
  | { type: "TIKTOK_ERROR"; code: BridgeErrorCode; message: string }
  | { type: "TIKTOK_EVENT"; event: NormalizedLiveEvent }
  | { type: "TIKTOK_GIFT_CATALOG"; catalog: unknown }
  | { type: "TIKTOK_METRICS"; state: TikTokBridgeState }
  | { type: "TIKTOK_LIVE_ENDED" };

type Listener = (event: NormalizedLiveEvent) => void;
type StateListener = (state: TikTokBridgeState) => void;
type BridgeStateListener = (state: BridgeState) => void;

type SendType = "CONNECT_TIKTOK" | "DISCONNECT_TIKTOK" | "RECONNECT_TIKTOK" | "REQUEST_STATUS" | "REQUEST_GIFT_CATALOG";

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 10000];

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

export function validateUsername(raw: string): string | null {
  const normalized = normalizeUsername(raw);
  return normalized.length > 0 ? normalized : null;
}

export function resolveBridgeUrl(): string | null {
  const envUrl = import.meta.env.VITE_LIVE_BRIDGE_URL;
  if (envUrl) {
    if (import.meta.env.PROD && !envUrl.startsWith("wss://")) {
      console.error("[bridge] VITE_LIVE_BRIDGE_URL must use wss:// in production, got:", envUrl);
      return null;
    }
    return envUrl;
  }
  return null;
}

export class TikTokBridgeClient {
  private socket: WebSocket | null = null;
  private eventListeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private bridgeStateListeners = new Set<BridgeStateListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private connectionGeneration = 0;
  private messageQueue: Array<{ type: SendType; payload?: Record<string, unknown> }> = [];
  private bridgeState: BridgeState = { status: "DISCONNECTED" };
  private state: TikTokBridgeState = {
    status: "DISCONNECTED", username: null, roomId: null, connectedAt: null,
    lastEventAt: null, reconnects: 0, duplicateEventsDropped: 0,
    unknownGifts: 0, viewerCount: 0, peakViewerCount: 0,
  };

  connect(): void {
    this.manuallyClosed = false;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    if (this.reconnectTimer) return;

    const url = resolveBridgeUrl();
    if (!url) {
      this.updateBridgeState({ status: "ERROR", errorMessage: "LIVE BRIDGE URL NOT CONFIGURED" });
      return;
    }

    this.updateBridgeState({ status: "CONNECTING" });
    const generation = ++this.connectionGeneration;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      if (generation !== this.connectionGeneration) return;
      this.reconnectAttempt = 0;
      this.updateBridgeState({ status: "CONNECTED" });
      const queue = this.messageQueue;
      this.messageQueue = [];
      for (const msg of queue) socket.send(JSON.stringify(this.createMessage(msg.type, msg.payload)));
      socket.send(JSON.stringify(this.createMessage("REQUEST_STATUS")));
    };

    socket.onmessage = (message: MessageEvent<string>) => {
      if (generation !== this.connectionGeneration) return;
      try {
        this.handleMessage(JSON.parse(message.data) as BridgeMessage);
      } catch {
        return;
      }
    };

    socket.onclose = () => {
      if (generation !== this.connectionGeneration) return;
      this.socket = null;
      if (!this.manuallyClosed) {
        this.updateBridgeState({ status: "RECONNECTING" });
        const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        this.reconnectAttempt++;
        if (!this.reconnectTimer) this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, delay);
      } else {
        this.updateBridgeState({ status: "DISCONNECTED" });
      }
    };

    socket.onerror = () => {
      if (generation === this.connectionGeneration) this.updateBridgeState({ status: "ERROR", errorMessage: "TikTok bridge connection error" });
    };
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.connectionGeneration++;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.messageQueue = [];
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.updateBridgeState({ status: "DISCONNECTED" });
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

  subscribeBridgeState(listener: BridgeStateListener): () => void {
    this.bridgeStateListeners.add(listener);
    listener(this.bridgeState);
    return () => { this.bridgeStateListeners.delete(listener); };
  }

  getState(): TikTokBridgeState { return { ...this.state }; }
  getBridgeState(): BridgeState { return { ...this.bridgeState }; }

  send(type: SendType, payload?: Record<string, unknown>): void {
    this.connect();
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(this.createMessage(type, payload)));
    } else {
      this.messageQueue.push({ type, payload });
    }
  }

  private createMessage(type: SendType, payload?: Record<string, unknown>): Record<string, unknown> {
    if (!payload) return { type };
    return type === "CONNECT_TIKTOK"
      ? { type, username: payload.username, payload }
      : { type, payload };
  }

  sendConnect(username: string): void {
    const normalized = validateUsername(username);
    if (!normalized) {
      this.updateBridgeState({ status: "ERROR", errorMessage: "USERNAME_REQUIRED: username is required" });
      return;
    }
    this.send("CONNECT_TIKTOK", { username: normalized });
  }

  private handleMessage(message: BridgeMessage): void {
    switch (message.type) {
      case "BRIDGE_STATUS":
        this.updateBridgeState({ status: message.status, errorMessage: message.message });
        break;
      case "TIKTOK_EVENT":
        for (const listener of this.eventListeners) listener(message.event);
        break;
      case "TIKTOK_STATUS":
      case "TIKTOK_METRICS":
        this.updateState(message.state);
        break;
      case "TIKTOK_CONNECTED":
        this.updateState({
          ...this.state,
          status: "CONNECTED",
          username: message.username,
          roomId: message.roomId,
          connectedAt: message.connectedAt,
          lastEventAt: Date.now(),
        });
        break;
      case "TIKTOK_DISCONNECTED":
        this.updateState({ ...this.state, status: "DISCONNECTED", roomId: null, connectedAt: null });
        break;
      case "TIKTOK_ERROR":
        this.updateState({ ...this.state, status: "ERROR", errorMessage: message.message });
        this.updateBridgeState({ status: "ERROR", errorMessage: `${message.code}: ${message.message}` });
        break;
      case "TIKTOK_LIVE_ENDED":
        this.updateState({ ...this.state, status: "LIVE_ENDED", errorMessage: "TikTok LIVE ended" });
        break;
      case "TIKTOK_GIFT_CATALOG":
        break;
    }
  }

  private updateState(state: TikTokBridgeState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(this.state);
  }

  private updateBridgeState(state: BridgeState): void {
    this.bridgeState = state;
    for (const listener of this.bridgeStateListeners) listener(this.bridgeState);
  }
}

export const tiktokBridgeClient = new TikTokBridgeClient();
