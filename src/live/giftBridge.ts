import type { NormalizedLiveEvent, GiftEvent } from "@/live/types";
import { liveEventBus } from "@/live/liveEventBus";
import {
  spawnUnits,
  triggerUltimate,
  getArenaState,
} from "@/simulation/arenaEngine";
import type { ArenaTeam } from "@/simulation/types";

// ─── Gift-to-Engine Bridge ──────────────────────────────────────────
// Subscribes to the LiveEventBus and translates normalized GIFT events
// into arena engine actions (spawn units, trigger ultimates).
//
// Gift ID mapping:
//   sim_t1 → spawn 1 T1 unit
//   sim_t2 → spawn 1 T2 unit
//   sim_t3 → spawn 1 T3 unit
//   sim_t4 → spawn 1 T4 unit
//   sim_t5 → spawn 1 T5 unit
//   sim_t6 → trigger Ultimate for that team
//
// Team mapping:
//   event.team "A" → "top" arena team
//   event.team "B" → "bottom" arena team
//   event.team "NONE" or undefined → random team (simulates unaligned gift)

const GIFT_TIER_MAP: Record<string, string> = {
  sim_t1: "T1",
  sim_t2: "T2",
  sim_t3: "T3",
  sim_t4: "T4",
  sim_t5: "T5",
  sim_t6: "T6",
};

const COIN_TIER_THRESHOLDS: Array<{ min: number; tier: string }> = [
  { min: 0, tier: "T1" },
  { min: 10, tier: "T2" },
  { min: 100, tier: "T3" },
  { min: 500, tier: "T4" },
  { min: 1000, tier: "T5" },
  { min: 5000, tier: "T6" },
];

function resolveTier(giftId: string, coinValue?: number): string | null {
  if (GIFT_TIER_MAP[giftId]) return GIFT_TIER_MAP[giftId];
  if (coinValue !== undefined && coinValue > 0) {
    for (let i = COIN_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
      if (coinValue >= COIN_TIER_THRESHOLDS[i].min) return COIN_TIER_THRESHOLDS[i].tier;
    }
  }
  return null;
}

let active = false;
let unsubscribe: (() => void) | null = null;
let giftCount = 0;
let spawnCount = 0;

function resolveTeam(event: GiftEvent): ArenaTeam {
  if (event.team === "A") return "top";
  if (event.team === "B") return "bottom";
  return Math.random() < 0.5 ? "top" : "bottom";
}

function handleGiftEvent(event: GiftEvent): void {
  const tier = resolveTier(event.giftId, event.coinValue);
  if (!tier) return;

  const arenaState = getArenaState();
  if (!arenaState || arenaState.winner) return;

  const team = resolveTeam(event);
  const count = Math.max(1, event.repeatCount);

  if (tier === "T6") {
    triggerUltimate(team, "LIVE");
    spawnCount++;
    return;
  }

  for (let i = 0; i < count; i++) {
    spawnUnits(team, 1, "LIVE", tier);
  }
  spawnCount += count;
}

function handleEvent(event: NormalizedLiveEvent): void {
  if (event.type === "GIFT") {
    giftCount++;
    handleGiftEvent(event);
  }
}

export function startGiftBridge(): void {
  if (active) return;
  active = true;
  unsubscribe = liveEventBus.subscribe(handleEvent);
}

export function stopGiftBridge(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  active = false;
}

export function isGiftBridgeActive(): boolean {
  return active;
}

export function getGiftBridgeStats(): { giftsReceived: number; unitsSpawned: number } {
  return { giftsReceived: giftCount, unitsSpawned: spawnCount };
}

export function resetGiftBridgeStats(): void {
  giftCount = 0;
  spawnCount = 0;
}

export { GIFT_TIER_MAP };
