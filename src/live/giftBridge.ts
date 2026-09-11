import type { NormalizedLiveEvent, GiftEvent } from "@/live/types";
import { liveEventBus } from "@/live/liveEventBus";
import {
  spawnUnits,
  triggerUltimate,
  getArenaState,
} from "@/simulation/arenaEngine";
import type { ArenaTeam } from "@/simulation/types";
import { mapGift, type CombatGift } from "@/live/giftMapper";
import { useWarriorStore } from "@/live/warriorStore";
import { useGiftToastStore } from "@/live/giftToastStore";

const SIM_GIFT_TIER_MAP: Record<string, string> = {
  sim_t1: "T1",
  sim_t2: "T2",
  sim_t3: "T3",
  sim_t4: "T4",
  sim_t5: "T5",
  sim_t6: "T6",
};

const SIM_GIFT_NAME: Record<string, string> = {
  sim_t1: "Sim T1 Basic",
  sim_t2: "Sim T2 Specialist",
  sim_t3: "Sim T3 Healer",
  sim_t4: "Sim T4 Breaker",
  sim_t5: "Sim T5 Boss",
  sim_t6: "Sim T6 Ultimate",
};

const SIM_GIFT_COINS: Record<string, number> = {
  T1: 1, T2: 10, T3: 30, T4: 199, T5: 500, T6: 1999,
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

function applyCombatGift(combatGift: CombatGift, source: "TIKTOK" | "SIMULATOR"): void {
  const arenaState = getArenaState();
  const team: ArenaTeam = combatGift.team === "A" ? "top" : "bottom";
  const count = combatGift.quantity;

  if (arenaState && !arenaState.winner) {
    if (combatGift.tier === "T6") {
      triggerUltimate(team, source === "TIKTOK" ? "LIVE" : "SIMULATION");
      spawnCount++;
    } else {
      for (let i = 0; i < count; i++) spawnUnits(team, 1, source === "TIKTOK" ? "LIVE" : "SIMULATION", combatGift.tier);
      spawnCount += count;
    }
  }

  useWarriorStore.getState().recordContribution(combatGift);
  useGiftToastStore.getState().addToast(combatGift);
}

function handleSimGift(event: GiftEvent): void {
  const tier = SIM_GIFT_TIER_MAP[event.giftId];
  if (!tier) return;

  const teamSide = event.team === "A" ? "A" : event.team === "B" ? "B" : Math.random() < 0.5 ? "A" : "B";
  const count = Math.max(1, event.repeatCount);

  const combatGift: CombatGift = {
    type: "COMBAT_GIFT",
    source: "SIMULATOR",
    team: teamSide,
    tier: tier as CombatGift["tier"],
    quantity: count,
    giftId: event.giftId,
    giftName: SIM_GIFT_NAME[event.giftId] ?? event.giftName,
    expectedCoins: SIM_GIFT_COINS[tier] ?? 0,
    viewer: {
      id: event.userId,
      username: event.username,
      nickname: event.nickname,
      avatarUrl: event.avatarUrl,
    },
  };

  applyCombatGift(combatGift, "SIMULATOR");
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

  applyCombatGift(result.combatGift, "TIKTOK");
}

function handleGiftEvent(event: GiftEvent): void {
  if (event.source === "TIKTOK") handleTikTokGift(event);
  else handleSimGift(event);
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
