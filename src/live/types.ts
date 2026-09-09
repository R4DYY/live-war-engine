// ─── Normalized Live Event Model ────────────────────────────────────
// Platform-independent event types. Both the SimulatorAdapter and a
// future TikTokLiveAdapter produce these identical shapes.

export type LiveEventSource = "SIMULATOR" | "TIKTOK";

export type LiveConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "ERROR"
  | "LIVE_ENDED";

export type TeamSide = "A" | "B" | "NONE";

// ─── Common metadata ────────────────────────────────────────────────
export interface LiveEventBase {
  eventId: string;
  type: string;
  timestamp: number;
  sequenceNumber: number;
  userId?: string;
  username?: string;
  nickname?: string;
  avatarUrl?: string;
  sourceEventId?: string;
  source: LiveEventSource;
  team?: TeamSide;
}

// ─── Like ───────────────────────────────────────────────────────────
export interface LikeEvent extends LiveEventBase {
  type: "LIKE";
  likeCount: number;
  totalLikeCount?: number;
}

// ─── Comment ────────────────────────────────────────────────────────
export interface CommentEvent extends LiveEventBase {
  type: "COMMENT";
  text: string;
}

// ─── Gift ───────────────────────────────────────────────────────────
export interface GiftEvent extends LiveEventBase {
  type: "GIFT";
  giftId: string;
  giftName: string;
  repeatCount: number;
  comboId?: string;
  comboState?: "START" | "IN_PROGRESS" | "END";
  valueMetadata?: number;
  giftType?: number;
  repeatEnd?: boolean;
  coinValue?: number;
}

// ─── Follow ─────────────────────────────────────────────────────────
export interface FollowEvent extends LiveEventBase {
  type: "FOLLOW";
}

// ─── Share ──────────────────────────────────────────────────────────
export interface ShareEvent extends LiveEventBase {
  type: "SHARE";
}

// ─── Join ───────────────────────────────────────────────────────────
export interface JoinEvent extends LiveEventBase {
  type: "JOIN";
}

// ─── Leave ──────────────────────────────────────────────────────────
export interface LeaveEvent extends LiveEventBase {
  type: "LEAVE";
}

// ─── Chest Contribution ─────────────────────────────────────────────
export interface ChestContributionEvent extends LiveEventBase {
  type: "CHEST_CONTRIBUTION";
  points: number;
}

// ─── Connection ─────────────────────────────────────────────────────
export interface ViewerCountEvent extends LiveEventBase {
  type: "VIEWER_COUNT";
  viewerCount: number;
  peakViewerCount?: number;
}

export interface ConnectionEvent extends LiveEventBase {
  type: "CONNECTION";
  status: LiveConnectionStatus;
  message?: string;
}

// ─── Discriminated union ─────────────────────────────────────────────
export type NormalizedLiveEvent =
  | LikeEvent
  | CommentEvent
  | GiftEvent
  | FollowEvent
  | ShareEvent
  | JoinEvent
  | LeaveEvent
  | ChestContributionEvent
  | ViewerCountEvent
  | ConnectionEvent;

export type LiveEventType = NormalizedLiveEvent["type"];

// ─── Adapter contract ──────────────────────────────────────────────
export interface LiveEventAdapter {
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  subscribe(listener: (event: NormalizedLiveEvent) => void): () => void;
  getStatus(): LiveConnectionStatus;
}

// ─── Gift slot data model ───────────────────────────────────────────
export interface GiftSlot {
  tier: string;
  role: string;
  simulatorGiftId: string;
  simulatorGiftName: string;
  targetPriceEuro: number;
  realGiftId?: string;
  realGiftName?: string;
}

// ─── Replay recording ──────────────────────────────────────────────
export interface RecordedEvent {
  offsetMs: number;
  event: NormalizedLiveEvent;
}

export interface ReplayRecording {
  id: string;
  events: RecordedEvent[];
  createdAt: number;
  label?: string;
}

// ─── Pipeline stages (future-proof UI) ──────────────────────────────
export type PipelineStage =
  | "RAW"
  | "NORMALIZED"
  | "VIEWER_TEAM"
  | "GIFT_MAPPING"
  | "GAME_COMMAND"
  | "ENGINE_RESULT";

export interface PipelineStep {
  stage: PipelineStage;
  label: string;
  status: "pending" | "active" | "done" | "skipped";
  detail?: string;
}

// ─── Simulator metrics ──────────────────────────────────────────────
export interface SimulatorMetrics {
  eventsTotal: number;
  likes: number;
  comments: number;
  gifts: number;
  follows: number;
  shares: number;
  joins: number;
  uniqueViewers: number;
  giftCombos: number;
  errors: number;
  droppedEvents: number;
  eventsPerSec: number;
}

// ─── Generated viewer ───────────────────────────────────────────────
export interface GeneratedViewer {
  userId: string;
  username: string;
  team: TeamSide;
}
