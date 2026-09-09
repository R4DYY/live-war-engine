import { WebSocket } from "ws";
import { createWebSocketUrl, SchemaVersion } from "@eulerstream/euler-websocket-sdk";
import {
  WebcastChatMessage,
  WebcastControlMessage,
  WebcastGiftMessage,
  WebcastLikeMessage,
  WebcastMemberMessage,
  WebcastResponse,
  WebcastRoomUserSeqMessage,
  WebcastSocialMessage,
} from "@eulerstream/euler-websocket-sdk/v1";
import type { NormalizedLiveEvent, LiveConnectionStatus } from "../../src/live/types";

type JsonRecord = Record<string, unknown>;
type ClientMessage = { type: string; username?: string; payload?: { username?: string } };

type BridgeErrorCode =
  | "USERNAME_REQUIRED"
  | "LIVE_NOT_FOUND"
  | "ACCOUNT_NOT_LIVE"
  | "EULER_API_KEY_MISSING"
  | "TIKTOK_CONNECTION_FAILED"
  | "BRIDGE_ERROR";

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

const reconnectDelays = [1000, 2000, 5000, 10000, 10000];

export function normalizeBridgeUsername(raw: string): string | null {
  const username = raw.trim().replace(/^@+/, "");
  return username.length > 0 ? username : null;
}

function log(tag: string, message: string): void {
  console.log(`[${new Date().toISOString()}] ${tag} ${message}`);
}

export class TikTokBridge {
  private clients = new Set<WebSocket>();
  private seenEvents = new Map<string, number>();
  private activeStreaks = new Map<string, { repeatCount: number; expiresAt: number }>();
  private connection: WebSocket | null = null;
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
    log("BRIDGE_CLIENT_CONNECTED", client.readyState.toString());
    this.send(client, { type: "BRIDGE_STATUS", status: "CONNECTED" });
    this.send(client, { type: "TIKTOK_STATUS", state: { ...this.state } });

    client.on("message", (payload) => {
      let message: ClientMessage;
      try { message = JSON.parse(payload.toString()) as ClientMessage; } catch { return; }
      this.handleClientMessage(client, message);
    });
    client.on("close", () => {
      this.clients.delete(client);
      log("BRIDGE_CLIENT_DISCONNECTED", `clients=${this.clients.size}`);
    });
  }

  private handleClientMessage(client: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case "CONNECT_TIKTOK": {
        const username = normalizeBridgeUsername(message.payload?.username ?? message.username ?? "");
        if (!username) {
          this.send(client, { type: "TIKTOK_ERROR", code: "USERNAME_REQUIRED", message: "Username is required" });
          return;
        }
        log("TIKTOK_CONNECT_REQUEST", `username=${username}`);
        void this.connect(username);
        break;
      }
      case "DISCONNECT_TIKTOK":
        void this.disconnectConnection(true);
        break;
      case "RECONNECT_TIKTOK":
        if (this.state.username) void this.disconnectConnection(false).then(() => this.connect(this.state.username ?? ""));
        break;
      case "REQUEST_STATUS":
        this.send(client, { type: "TIKTOK_STATUS", state: { ...this.state } });
        break;
    }
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
    const picture = this.record(user.profilePicture);
    return {
      userId: this.stringValue(user.userId) ?? this.stringValue(user.id),
      username: this.stringValue(user.uniqueId) ?? this.stringValue(user.username),
      nickname: this.stringValue(user.nickname) ?? this.stringValue(user.displayName),
      avatarUrl: this.stringValue(picture.mUrls?.[0]) ?? this.stringValue(user.profilePictureUrl) ?? this.stringValue(user.avatarUrl),
    };
  }

  private eventId(data: unknown, fallback: string): string {
    const root = this.record(data);
    const event = this.record(root.event);
    return this.stringValue(event.msgId) ?? this.stringValue(root.eventId) ?? this.stringValue(root.msgId) ?? fallback;
  }

  private timestamp(data: unknown): number {
    const event = this.record(this.record(data).event);
    const value = Number(event.createTime);
    return Number.isFinite(value) && value > 0 ? value : Date.now();
  }

  private send(client: WebSocket, message: Record<string, unknown>): void {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
  }

  private broadcast(message: Record<string, unknown>): void {
    const serialized = JSON.stringify(message);
    for (const client of this.clients) if (client.readyState === WebSocket.OPEN) client.send(serialized);
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
      timestamp: this.timestamp(data),
      sequenceNumber: ++this.sequence,
      source: "TIKTOK" as const,
      sourceEventId: id,
      ...this.userData(data),
    };
  }

  private normalizeEvent(data: unknown, type: "COMMENT" | "LIKE" | "JOIN" | "FOLLOW" | "SHARE"): NormalizedLiveEvent {
    const root = this.record(data);
    if (type === "COMMENT") return { ...this.base(data, this.eventId(data, `chat-${this.sequence + 1}`)), type, text: this.stringValue(root.comment) ?? "" };
    if (type === "LIKE") return { ...this.base(data, this.eventId(data, `like-${this.sequence + 1}`)), type, likeCount: Math.max(0, Math.floor(this.numberValue(root.likeCount) ?? 0)), totalLikeCount: this.numberValue(root.totalLikeCount) };
    return { ...this.base(data, this.eventId(data, `${type.toLowerCase()}-${this.sequence + 1}`)), type };
  }

  private normalizeGift(data: unknown): NormalizedLiveEvent | null {
    const root = this.record(data);
    const details = this.record(root.giftDetails);
    const giftId = this.stringValue(root.giftId) ?? String(root.giftId ?? "");
    if (!giftId) return null;
    const repeatCount = Math.max(0, Math.floor(this.numberValue(root.repeatCount) ?? 1));
    const user = this.userData(data);
    const streakKey = `${this.state.roomId ?? "room"}:${user.userId ?? user.username ?? "user"}:${giftId}`;
    const repeatEnd = root.repeatEnd === true || root.repeatEnd === 1;
    const streakable = root.groupId !== undefined || root.repeatEnd !== undefined;
    let quantity = repeatCount;
    if (streakable) {
      const previous = this.activeStreaks.get(streakKey)?.repeatCount ?? 0;
      quantity = Math.max(0, repeatCount - previous);
      this.activeStreaks.set(streakKey, { repeatCount, expiresAt: Date.now() + 30_000 });
      if (repeatEnd) this.activeStreaks.delete(streakKey);
    }
    if (quantity === 0) return null;
    return {
      ...this.base(data, this.eventId(data, `gift-${this.sequence + 1}`)),
      type: "GIFT",
      giftId,
      giftName: this.stringValue(root.giftName) ?? this.stringValue(details.giftName) ?? "Unknown gift",
      repeatCount: quantity,
      repeatEnd,
      giftType: this.numberValue(root.giftType) ?? this.numberValue(details.giftType),
      coinValue: this.numberValue(root.diamondCount) ?? this.numberValue(details.diamondCount),
    };
  }

  private processEvent(type: string, data: unknown): void {
    const id = this.eventId(data, `${type}-${this.sequence + 1}`);
    if (this.shouldDropDuplicate(id)) return;
    if (type === "WebcastChatMessage") this.emitEvent(this.normalizeEvent(data, "COMMENT"));
    else if (type === "WebcastLikeMessage") this.emitEvent(this.normalizeEvent(data, "LIKE"));
    else if (type === "WebcastGiftMessage") {
      const event = this.normalizeGift(data);
      if (event) this.emitEvent(event);
    } else if (type === "WebcastMemberMessage") this.emitEvent(this.normalizeEvent(data, "JOIN"));
    else if (type === "WebcastSocialMessage") {
      const label = JSON.stringify(this.record(this.record(data).event?.eventDetails)).toLowerCase();
      this.emitEvent(this.normalizeEvent(data, label.includes("share") ? "SHARE" : "FOLLOW"));
    } else if (type === "WebcastRoomUserSeqMessage") {
      const viewerCount = Math.max(0, Math.floor(this.numberValue(this.record(data).viewerCount) ?? 0));
      this.state.viewerCount = viewerCount;
      this.state.peakViewerCount = Math.max(this.state.peakViewerCount, viewerCount);
      this.emitEvent({ ...this.base(data, id), type: "VIEWER_COUNT", viewerCount, peakViewerCount: this.state.peakViewerCount });
    } else if (type === "WebcastControlMessage" && this.record(data).action === 3) {
      this.state.roomId = null;
      this.state.connectedAt = null;
      this.statusMessage("LIVE_ENDED", "TikTok LIVE ended");
    }
  }

  private processPayload(payload: Buffer): void {
    const text = payload.toString("utf8");
    if (text.startsWith("{") || text.startsWith("[")) {
      const message = JSON.parse(text) as JsonRecord;
      const type = this.stringValue(message.type);
      if (type === "roomInfo") {
        const data = this.record(message.data);
        this.state.roomId = this.stringValue(data.roomId) ?? this.stringValue(data.roomIdStr) ?? this.state.roomId;
        this.state.viewerCount = this.numberValue(data.viewerCount) ?? this.state.viewerCount;
        this.state.peakViewerCount = Math.max(this.state.peakViewerCount, this.state.viewerCount);
        this.state.connectedAt ??= Date.now();
        this.statusMessage("CONNECTED");
      } else if (type) this.processEvent(type, message.data);
      return;
    }

    const response = WebcastResponse.decode(payload);
    for (const message of response.messages) {
      const data = this.decodeMessage(message.type, message.binary);
      if (data) this.processEvent(message.type, data);
    }
  }

  private decodeMessage(type: string, binary: Buffer): unknown {
    const decoders: Record<string, (data: Uint8Array) => unknown> = {
      WebcastChatMessage: (data) => WebcastChatMessage.decode(data),
      WebcastLikeMessage: (data) => WebcastLikeMessage.decode(data),
      WebcastGiftMessage: (data) => WebcastGiftMessage.decode(data),
      WebcastMemberMessage: (data) => WebcastMemberMessage.decode(data),
      WebcastSocialMessage: (data) => WebcastSocialMessage.decode(data),
      WebcastRoomUserSeqMessage: (data) => WebcastRoomUserSeqMessage.decode(data),
      WebcastControlMessage: (data) => WebcastControlMessage.decode(data),
    };
    return decoders[type]?.(binary);
  }

  private async connect(username: string): Promise<void> {
    if (this.connection) await this.disconnectConnection(false);
    const apiKey = process.env.EULER_API_KEY?.trim();
    if (!apiKey) {
      this.statusMessage("ERROR", "EULER_API_KEY is not configured on Railway");
      this.broadcast({ type: "TIKTOK_ERROR", code: "EULER_API_KEY_MISSING", message: "EULER_API_KEY is missing on the server" });
      return;
    }

    this.manualDisconnect = false;
    this.state.username = username;
    this.state.roomId = null;
    this.state.connectedAt = null;
    this.statusMessage("CONNECTING");
    const url = createWebSocketUrl({ uniqueId: username, apiKey, features: { schemaVersion: SchemaVersion.v1, bundleEvents: true } });
    const current = new WebSocket(url);
    this.connection = current;
    current.on("open", () => log("EULER_CONNECTED", `username=${username}`));
    current.on("message", (payload) => {
      try { this.processPayload(Buffer.isBuffer(payload) ? payload : Buffer.from(payload as Uint8Array)); }
      catch (error) { log("EULER_DECODE_ERROR", error instanceof Error ? error.message : "Unable to decode event"); }
    });
    current.on("error", (error) => {
      const message = error instanceof Error ? error.message : "Euler Stream connection error";
      this.broadcast({ type: "TIKTOK_ERROR", code: "TIKTOK_CONNECTION_FAILED", message });
      this.statusMessage("ERROR", message);
    });
    current.on("close", (code) => {
      this.connection = null;
      if (this.manualDisconnect) return;
      if (code === 4404) {
        this.statusMessage("LIVE_ENDED", "TikTok account is not live");
        this.broadcast({ type: "TIKTOK_ERROR", code: "ACCOUNT_NOT_LIVE", message: "TikTok account is not live" });
        return;
      }
      this.scheduleReconnect(`Euler Stream closed (${code})`);
    });
  }

  private scheduleReconnect(reason: string): void {
    if (this.manualDisconnect || this.reconnectTimer || !this.state.username) return;
    this.state.reconnects++;
    this.statusMessage("RECONNECTING", reason);
    const delay = reconnectDelays[Math.min(this.reconnectAttempt, reconnectDelays.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect(this.state.username ?? "");
    }, delay);
  }

  private async disconnectConnection(manual: boolean): Promise<void> {
    this.manualDisconnect = manual;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.reconnectAttempt = 0;
    const current = this.connection;
    this.connection = null;
    if (current) current.close();
    if (manual) {
      this.state.roomId = null;
      this.state.connectedAt = null;
      this.statusMessage("DISCONNECTED", "Disconnected by operator");
      this.broadcast({ type: "TIKTOK_DISCONNECTED", message: "Disconnected by operator" });
    }
  }
}
