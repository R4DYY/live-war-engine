import type {
  LiveEventAdapter,
  LiveConnectionStatus,
  NormalizedLiveEvent,
  LikeEvent,
  CommentEvent,
  GiftEvent,
  FollowEvent,
  ShareEvent,
  JoinEvent,
  LeaveEvent,
  ChestContributionEvent,
  ConnectionEvent,
  LiveEventSource,
  TeamSide,
} from "./types";
import { liveEventBus } from "./liveEventBus";

type Listener = (event: NormalizedLiveEvent) => void;

// ─── Simulator Adapter ──────────────────────────────────────────────
// Produces normalized events from developer button clicks.
// Same NormalizedLiveEvent shape that a future TikTokLiveAdapter will emit.

export interface SimulatorUser {
  userId: string;
  username: string;
  team: TeamSide;
}

export class SimulatorAdapter implements LiveEventAdapter {
  private status: LiveConnectionStatus = "DISCONNECTED";
  private listeners = new Set<Listener>();
  private source: LiveEventSource = "SIMULATOR";
  private currentUser: SimulatorUser = {
    userId: "test-user-01",
    username: "tao_test",
    team: "NONE",
  };
  private latencyMs = 0;
  private dropNext = false;

  async start(): Promise<void> {
    this.status = "CONNECTED";
    this.emitConnection("CONNECTED", "Simulator started");
  }

  stop(): void {
    this.status = "DISCONNECTED";
    this.emitConnection("DISCONNECTED", "Simulator stopped");
    this.listeners.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): LiveConnectionStatus {
    return this.status;
  }

  getCurrentUser(): SimulatorUser {
    return { ...this.currentUser };
  }

  setCurrentUser(user: SimulatorUser): void {
    this.currentUser = { ...user };
  }

  setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  getLatency(): number {
    return this.latencyMs;
  }

  dropNextEvent(): void {
    this.dropNext = true;
  }

  // ─── Event emitters ────────────────────────────────────────────────

  emitLike(likeCount: number): void {
    const event: LikeEvent = {
      eventId: crypto.randomUUID(),
      type: "LIKE",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      userId: this.currentUser.userId,
      username: this.currentUser.username,
      source: this.source,
      team: this.currentUser.team,
      likeCount,
    };
    this.broadcast(event);
  }

  emitComment(text: string): void {
    const event: CommentEvent = {
      eventId: crypto.randomUUID(),
      type: "COMMENT",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      userId: this.currentUser.userId,
      username: this.currentUser.username,
      source: this.source,
      team: this.currentUser.team,
      text,
    };
    this.broadcast(event);
  }

  emitGift(params: {
    giftId: string;
    giftName: string;
    repeatCount: number;
    comboId?: string;
    comboState?: "START" | "IN_PROGRESS" | "END";
    valueMetadata?: number;
  }): void {
    const event: GiftEvent = {
      eventId: crypto.randomUUID(),
      type: "GIFT",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      userId: this.currentUser.userId,
      username: this.currentUser.username,
      source: this.source,
      team: this.currentUser.team,
      ...params,
    };
    this.broadcast(event);
  }

  emitFollow(): void {
    const event: FollowEvent = {
      eventId: crypto.randomUUID(),
      type: "FOLLOW",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      userId: this.currentUser.userId,
      username: this.currentUser.username,
      source: this.source,
      team: this.currentUser.team,
    };
    this.broadcast(event);
  }

  emitShare(): void {
    const event: ShareEvent = {
      eventId: crypto.randomUUID(),
      type: "SHARE",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      userId: this.currentUser.userId,
      username: this.currentUser.username,
      source: this.source,
      team: this.currentUser.team,
    };
    this.broadcast(event);
  }

  emitJoin(): void {
    const event: JoinEvent = {
      eventId: crypto.randomUUID(),
      type: "JOIN",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      userId: this.currentUser.userId,
      username: this.currentUser.username,
      source: this.source,
      team: this.currentUser.team,
    };
    this.broadcast(event);
  }

  emitLeave(): void {
    const event: LeaveEvent = {
      eventId: crypto.randomUUID(),
      type: "LEAVE",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      userId: this.currentUser.userId,
      username: this.currentUser.username,
      source: this.source,
      team: this.currentUser.team,
    };
    this.broadcast(event);
  }

  emitChestContribution(points: number): void {
    const event: ChestContributionEvent = {
      eventId: crypto.randomUUID(),
      type: "CHEST_CONTRIBUTION",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      userId: this.currentUser.userId,
      username: this.currentUser.username,
      source: this.source,
      team: this.currentUser.team,
      points,
    };
    this.broadcast(event);
  }

  // Emit a pre-constructed event (for duplicate/replay/malformed tests)
  emitRaw(event: NormalizedLiveEvent): void {
    this.broadcast(event);
  }

  simulateDisconnect(): void {
    this.status = "DISCONNECTED";
    this.emitConnection("DISCONNECTED", "Simulated disconnect");
  }

  simulateReconnect(): void {
    this.status = "RECONNECTING";
    this.emitConnection("RECONNECTING", "Simulated reconnecting");
    setTimeout(() => {
      this.status = "CONNECTED";
      this.emitConnection("CONNECTED", "Reconnected");
    }, 500);
  }

  simulateError(message?: string): void {
    this.status = "ERROR";
    this.emitConnection("ERROR", message ?? "Simulated error");
  }

  private emitConnection(status: LiveConnectionStatus, message?: string): void {
    const event: ConnectionEvent = {
      eventId: crypto.randomUUID(),
      type: "CONNECTION",
      timestamp: Date.now(),
      sequenceNumber: liveEventBus.nextSequence(),
      source: this.source,
      status,
      message,
    };
    this.broadcast(event);
  }

  private broadcast(event: NormalizedLiveEvent): void {
    if (this.dropNext) {
      this.dropNext = false;
      return;
    }
    if (this.latencyMs > 0) {
      setTimeout(() => this.doBroadcast(event), this.latencyMs);
    } else {
      this.doBroadcast(event);
    }
  }

  private doBroadcast(event: NormalizedLiveEvent): void {
    liveEventBus.emit(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const simulatorAdapter = new SimulatorAdapter();
