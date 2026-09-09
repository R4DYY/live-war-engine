import type { BattleSession, EngineStatus, LoopRuntimeState } from "@/domain/types";
import type { SimulationSnapshot } from "@/simulation/types";
import type { ChestSnapshot } from "@/engine/chestManager";

const CHANNEL_NAME = "lwe_battle_sync";
const BROADCAST_THROTTLE_MS = 100;

export interface SyncPayload {
  type: "STATE_UPDATE" | "REQUEST_SYNC";
  session: BattleSession | null;
  engineStatus: EngineStatus;
  loop: LoopRuntimeState;
  simSnapshot?: SimulationSnapshot;
  battleBackgroundUrl?: string | null;
  chestSnapshot?: ChestSnapshot | null;
}

type SyncListener = (payload: SyncPayload) => void;

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function broadcastState(payload: Omit<SyncPayload, "type">): void {
  const ch = getChannel();
  if (ch) {
    ch.postMessage({ ...payload, type: "STATE_UPDATE" } satisfies SyncPayload);
  }
}

let lastBroadcastTime = 0;
let pendingBroadcast: ReturnType<typeof setTimeout> | null = null;

export function throttledBroadcast(payload: Omit<SyncPayload, "type">): void {
  const now = Date.now();
  const elapsed = now - lastBroadcastTime;

  if (pendingBroadcast) {
    clearTimeout(pendingBroadcast);
    pendingBroadcast = null;
  }

  if (elapsed >= BROADCAST_THROTTLE_MS) {
    lastBroadcastTime = now;
    broadcastState(payload);
  } else {
    pendingBroadcast = setTimeout(() => {
      pendingBroadcast = null;
      lastBroadcastTime = Date.now();
      broadcastState(payload);
    }, BROADCAST_THROTTLE_MS - elapsed);
  }
}

export function requestSync(): void {
  const ch = getChannel();
  if (ch) {
    ch.postMessage({
      type: "REQUEST_SYNC",
      session: null,
      engineStatus: "IDLE",
      loop: {
        phase: "IDLE",
        session: null,
        gracefulStopRequested: false,
        intermissionStartedAt: null,
        nextRoundAt: null,
        nextDuelId: null,
        lastSummary: null,
        completedRounds: [],
      },
      battleBackgroundUrl: null,
    } satisfies SyncPayload);
  }
}

export function onSyncMessage(fn: SyncListener): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const handler = (e: MessageEvent<SyncPayload>) => {
    fn(e.data);
  };
  ch.addEventListener("message", handler);
  return () => {
    ch.removeEventListener("message", handler);
  };
}
