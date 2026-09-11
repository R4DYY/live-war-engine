import type { NormalizedLiveEvent, GiftEvent } from "@/live/types";
import { liveEventBus } from "@/live/liveEventBus";
import {
  spawnUnits,
  triggerUltimate,
  getArenaState,
} from "@/simulation/arenaEngine";
import type { ArenaTeam } from "@/simulation/types";
import { mapGift } from "@/live/giftMapper";

// ─── Gift-to-Engine Bridge ──────────────────────────────────────────
// Simulator gifts use sim_t1..sim_t6 IDs directly.
// TikTok gifts go through the giftMapper → CombatGift → engine.

const SIM_GIFT_TIER_MAP: Record<string, string> = {
  sim_t1: "T1",
  sim_t2: "T2",
  sim_t3: "T3",
  sim_t4: "T4",
  sim_t5: "T5",
  sim_t6: "T6",
};

let active = false;
let unsubscribe: (() => void) | null = null;
let giftCount = 0;
let spawnCount = 0;

function resolveSimTeam(event: GiftEvent): ArenaTeam {
  if (event.team === "A") return "top";
  if (event.team === "B") return "bottom";
  return Math.random() < 0.5 ? "top" : "bottom";
}

function handleSimGift(event: GiftEvent): void {
  const tier = SIM_GIFT_TIER_MAP[event.giftId];
  if (!tier) return;

  const arenaState = getArenaState();
  if (!arenaState || arenaState.winner) return;

  const team = resolveSimTeam(event);
  const count = Math.max(1, event.repeatCount);

  if (tier === "T6") {
    triggerUltimate(team, "LIVE");
    spawnCount++;
    return;
  }

  for (let i = 0; i < count; i++) spawnUnits(team, 1, "LIVE", tier);
  spawnCount += count;
}

function handleTikTokGift(event: GiftEvent): void {
  console.log(
    `REAL_GIFT_RECEIVED giftId=${event.giftId} giftName=${event.giftName} diamondCount=${event.coinValue ?? "?"} repeatCount=${event.repeatCount} repeatEnd=${event.repeatEnd ?? "?"} user=${event.username ?? "?"}`
  );

  const result = mapGift({
    giftId: event.giftId,
    giftName: event.giftName,
    coinValue: event.coinValue,
    repeatCount: event.repeatCount,
    viewer: {
      id: event.userId,
      username: event.username,
      nickname: event.nickname,
      avatarUrl: event.avatarUrl,
    },
  });

  if (result.status === "UNKNOWN_GIFT" || !result.combatGift) return;

  const combatGift = result.combatGift;
  const arenaState = getArenaState();
  if (!arenaState || arenaState.winner) return;

  const team: ArenaTeam = combatGift.team === "A" ? "top" : "bottom";
  const count = combatGift.quantity;

  if (combatGift.tier === "T6") {
    triggerUltimate(team, "LIVE");
    spawnCount++;
    return;
  }

  for (let i = 0; i < count; i++) spawnUnits(team, 1, "LIVE", combatGift.tier);
  spawnCount += count;
}

function handleGiftEvent(event: GiftEvent): void {
  if (event.source === "TIKTOK") {
    handleTikTokGift(event);
  } else {
    handleSimGift(event);
  }
  giftCount++;
}

function handleEvent(event: NormalizedLiveEvent): void {
  if (event.type === "GIFT") handleGiftEvent(event);
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
