import { WebSocket } from "ws";
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";
import type { NormalizedLiveEvent, LiveConnectionStatus } from "../../src/live/types";

type JsonRecord = Record<string, unknown>;
type BridgeMessage = { type: string; username?: string; state?: BridgeState; message?: string; catalog?: unknown; event?: NormalizedLiveEvent };
type ClientMessage = { type: string; username?: string };

export type BridgeState = {
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
};

const reconnectDelays = [1000, 2000, 5000, 10000];

export class TikTokBridge {
  private clients = new Set<WebSocket>();
  private seenEvents = new Map<string, number>();
  private activeStreaks = new Map<string, { repeatCount: number; expiresAt: number }>();
  private connection: TikTokLiveConnection | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private manualDisconnect = false;
  private sequence = 0;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private state: BridgeState = {
    status: "DISCONNECTED",
    username: null,
    roomId: null,
    connectedAt: null,
    lastEventAt: null,
    reconnects: 0,
    duplicateEventsDropped: 0,
    unknownGifts: 0,
    viewerCount: 0,
    peakViewerCount: 0,
  };

  handleConnection(client: WebSocket): void {
    this.clients.add(client);
    client.send(JSON.stringify({ type: "TIKTOK_STATUS", state: { ...this.state } }));
    client.on("message", (payload) => {
      let message: ClientMessage;
      try { message = JSON.parse(payload.toString()) as ClientMessage; } catch { return; }
      if (message.type === "CONNECT_TIKTOK" && message.username?.trim()) void this.connect(message.username.trim());
      if (message.type === "DISCONNECT_TIKTOK") void this.disconnectConnection(true);
      if (message.type === "RECONNECT_TIKTOK" && this.state.username) void this.disconnectConnection(false).then(() => this.connect(this.state.username ?? ""));
      if (message.type === "REQUEST_GIFT_CATALOG" && this.connection) void this.connection.fetchAvailableGifts().then((catalog) => this.broadcast({ type: "TIKTOK_GIFT_CATALOG", catalog }));
    });
    client.on("close", () => this.clients.delete(client));
  }

  startMetrics(): void {
    if (this.metricsTimer) return;
    this.metricsTimer = setInterval(() => this.broadcast({ type: "TIKTOK_METRICS", state: { ...this.state } }), 1000);
  }

  stopMetrics(): void {
    if (this.metricsTimer) { clearInterval(this.metricsTimer); this.metricsTimer = null; }
  }

  private record(value: unknown): JsonRecord {
    return value !== null && typeof value === "object" ? value as JsonRecord : {};
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private numberValue(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private userData(data: unknown): { userId?: string; username?: string; nickname?: string; avatarUrl?: string } {
    const root = this.record(data);
    const user = this.record(root.user ?? root.userInfo ?? root);
    return {
      userId: this.stringValue(user.userId) ?? this.stringValue(user.id),
      username: this.stringValue(user.uniqueId) ?? this.stringValue(user.username),
      nickname: this.stringValue(user.nickname) ?? this.stringValue(user.displayName),
      avatarUrl: this.stringValue(user.profilePictureUrl) ?? this.stringValue(user.avatarUrl),
    };
  }

  private eventId(data: unknown, fallback: string): string {
    const root = this.record(data);
    return this.stringValue(root.eventId) ?? this.stringValue(root.msgId) ?? this.stringValue(root.messageId) ?? fallback;
  }

  private broadcast(message: BridgeMessage): void {
    const serialized = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(serialized);
    }
  }

  private statusMessage(status: LiveConnectionStatus, message?: string): void {
    this.state.status = status;
    this.broadcast({ type: "TIKTOK_STATUS", state: { ...this.state }, message });
  }

  private cleanupCaches(): void {
    const now = Date.now();
    for (const [id, expiresAt] of this.seenEvents) if (expiresAt <= now) this.seenEvents.delete(id);
    for (const [id, streak] of this.activeStreaks) if (streak.expiresAt <= now) this.activeStreaks.delete(id);
  }

  private shouldDropDuplicate(id: string): boolean {
    this.cleanupCaches();
    if (this.seenEvents.has(id)) {
      this.state.duplicateEventsDropped++;
      this.broadcast({ type: "TIKTOK_METRICS", state: { ...this.state } });
      return true;
    }
    this.seenEvents.set(id, Date.now() + 5 * 60_000);
    return false;
  }

  private emitEvent(event: NormalizedLiveEvent): void {
    this.state.lastEventAt = Date.now();
    this.broadcast({ type: "TIKTOK_EVENT", event });
  }

  private base(data: unknown, id: string) {
    return {
      eventId: id,
      timestamp: Date.now(),
      sequenceNumber: ++this.sequence,
      source: "TIKTOK" as const,
      sourceEventId: id,
      ...this.userData(data),
    };
  }

  private normalizeChat(data: unknown): NormalizedLiveEvent {
    const root = this.record(data);
    return { ...this.base(data, this.eventId(data, `chat-${this.sequence + 1}`)), type: "COMMENT", text: this.stringValue(root.comment) ?? "" };
  }

  private normalizeLike(data: unknown): NormalizedLiveEvent {
    const root = this.record(data);
    const likeCount = Math.max(0, Math.floor(this.numberValue(root.likeCount) ?? 0));
    return { ...this.base(data, this.eventId(data, `like-${this.sequence + 1}`)), type: "LIKE", likeCount, totalLikeCount: this.numberValue(root.totalLikeCount) };
  }

  private normalizeGift(data: unknown): NormalizedLiveEvent | null {
    const root = this.record(data);
    const giftId = this.stringValue(root.giftId) ?? this.stringValue(this.record(root.giftDetails).giftId);
    if (!giftId) return null;
    const repeatCount = Math.max(0, Math.floor(this.numberValue(root.repeatCount) ?? 1));
    const id = this.eventId(data, `gift-${this.sequence + 1}`);
    const user = this.userData(data);
    const streakKey = `${this.state.roomId ?? "room"}:${user.userId ?? user.username ?? "user"}:${giftId}`;
    const streakable = root.repeatEnd !== undefined || root.comboId !== undefined;
    let quantity = repeatCount;
    if (streakable) {
      const previous = this.activeStreaks.get(streakKey)?.repeatCount ?? 0;
      quantity = Math.max(0, repeatCount - previous);
      this.activeStreaks.set(streakKey, { repeatCount, expiresAt: Date.now() + 30_000 });
      if (root.repeatEnd === true) this.activeStreaks.delete(streakKey);
    }
    if (quantity === 0) return null;
    return {
      ...this.base(data, id),
      type: "GIFT",
      giftId,
      giftName: this.stringValue(root.giftName) ?? this.stringValue(this.record(root.giftDetails).giftName) ?? "Unknown gift",
      repeatCount: quantity,
      repeatEnd: root.repeatEnd === true,
      giftType: this.numberValue(root.giftType),
      coinValue: this.numberValue(this.record(root.giftDetails).diamondCount) ?? this.numberValue(root.diamondCount),
    };
  }

  private normalizeSocial(data: unknown, type: "FOLLOW" | "SHARE" | "JOIN"): NormalizedLiveEvent {
    return { ...this.base(data, this.eventId(data, `${type.toLowerCase()}-${this.sequence + 1}`)), type };
  }

  private attachListeners(current: TikTokLiveConnection): void {
    current.on(WebcastEvent.CHAT, (data) => {
      const id = this.eventId(data, `chat-${this.sequence + 1}`);
      if (!this.shouldDropDuplicate(id)) this.emitEvent(this.normalizeChat(data));
    });
    current.on(WebcastEvent.LIKE, (data) => {
      const id = this.eventId(data, `like-${this.sequence + 1}`);
      if (!this.shouldDropDuplicate(id)) this.emitEvent(this.normalizeLike(data));
    });
    current.on(WebcastEvent.GIFT, (data) => {
      const id = this.eventId(data, `gift-${this.sequence + 1}`);
      if (this.shouldDropDuplicate(id)) return;
      const event = this.normalizeGift(data);
      if (event) this.emitEvent(event);
    });
    current.on(WebcastEvent.MEMBER, (data) => {
      const id = this.eventId(data, `member-${this.sequence + 1}`);
      if (!this.shouldDropDuplicate(id)) this.emitEvent(this.normalizeSocial(data, "JOIN"));
    });
    current.on(WebcastEvent.FOLLOW, (data) => {
      const id = this.eventId(data, `follow-${this.sequence + 1}`);
      if (!this.shouldDropDuplicate(id)) this.emitEvent(this.normalizeSocial(data, "FOLLOW"));
    });
    current.on(WebcastEvent.SHARE, (data) => {
      const id = this.eventId(data, `share-${this.sequence + 1}`);
      if (!this.shouldDropDuplicate(id)) this.emitEvent(this.normalizeSocial(data, "SHARE"));
    });
    current.on(WebcastEvent.ROOM_USER, (data) => {
      const root = this.record(data);
      const viewerCount = Math.max(0, Math.floor(this.numberValue(root.viewerCount) ?? this.numberValue(root.totalUser) ?? 0));
      this.state.viewerCount = viewerCount;
      this.state.peakViewerCount = Math.max(this.state.peakViewerCount, viewerCount);
      this.emitEvent({ ...this.base(data, this.eventId(data, `viewers-${this.sequence + 1}`)), type: "VIEWER_COUNT", viewerCount, peakViewerCount: this.state.peakViewerCount });
    });
    current.on(WebcastEvent.STREAM_END, () => {
      this.statusMessage("LIVE_ENDED", "TikTok LIVE ended");
    });
    current.on(ControlEvent.CONNECTED, (connected) => {
      this.state.roomId = connected.roomId;
      this.state.connectedAt = Date.now();
      this.state.lastEventAt = Date.now();
      this.reconnectAttempt = 0;
      this.statusMessage("CONNECTED");
      if (connected.availableGifts) this.broadcast({ type: "TIKTOK_GIFT_CATALOG", catalog: connected.availableGifts });
    });
    current.on(ControlEvent.DISCONNECTED, (data) => {
      if (!this.manualDisconnect) this.scheduleReconnect(this.stringValue(this.record(data).reason) ?? "TikTok disconnected");
      else this.statusMessage("DISCONNECTED", "Disconnected by operator");
    });
    current.on(ControlEvent.ERROR, (error) => {
      this.statusMessage("ERROR", error instanceof Error ? error.message : "TikTok adapter error");
      if (!this.manualDisconnect) this.scheduleReconnect("TikTok adapter error");
    });
  }

  private async connect(username: string): Promise<void> {
    if (this.connection) return;
    this.manualDisconnect = false;
    this.state.username = username.replace(/^@/, "");
    this.statusMessage("CONNECTING");
    const current = new TikTokLiveConnection(this.state.username, { enableExtendedGiftInfo: true });
    this.connection = current;
    this.attachListeners(current);
    try {
      const connected = await current.connect();
      this.state.roomId = connected.roomId;
      this.state.connectedAt = Date.now();
      this.statusMessage("CONNECTED");
      const catalog = await current.fetchAvailableGifts();
      this.broadcast({ type: "TIKTOK_GIFT_CATALOG", catalog });
    } catch (error) {
      this.connection = null;
      this.statusMessage("ERROR", error instanceof Error ? error.message : "Unable to connect");
      if (!this.manualDisconnect) this.scheduleReconnect("Unable to connect");
    }
  }

  private scheduleReconnect(reason: string): void {
    if (this.manualDisconnect || this.reconnectTimer || !this.state.username) return;
    this.state.reconnects++;
    this.statusMessage("RECONNECTING", reason);
    const delay = reconnectDelays[Math.min(this.reconnectAttempt, reconnectDelays.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.disconnectConnection(false).then(() => this.connect(this.state.username ?? ""));
    }, delay);
  }

  private async disconnectConnection(manual: boolean): Promise<void> {
    this.manualDisconnect = manual;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = null;
    }
    if (manual) {
      this.state.roomId = null;
      this.state.connectedAt = null;
      this.statusMessage("DISCONNECTED");
    }
  }
}
