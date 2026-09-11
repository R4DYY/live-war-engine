import type { TeamSide } from "@/live/types";

export type GiftTier = "T1" | "T2" | "T3" | "T4" | "T5" | "T6";

export interface CombatGiftMapping {
  giftId?: string;
  giftName: string;
  team: TeamSide;
  tier: GiftTier;
  action: "SPAWN_UNIT";
  expectedCoins: number;
}

export interface CombatGift {
  type: "COMBAT_GIFT";
  source: "TIKTOK";
  team: TeamSide;
  tier: GiftTier;
  quantity: number;
  giftId: string;
  giftName: string;
  expectedCoins: number;
  viewer: {
    id?: string;
    username?: string;
    nickname?: string;
    avatarUrl?: string;
  };
}

export interface GiftMappingResult {
  status: "MAPPED" | "UNKNOWN_GIFT";
  combatGift?: CombatGift;
  mapping?: CombatGiftMapping;
}

const MAPPING_TABLE: CombatGiftMapping[] = [
  { giftName: "Rose", team: "A", tier: "T1", action: "SPAWN_UNIT", expectedCoins: 1 },
  { giftName: "Ice Cream Cone", team: "B", tier: "T1", action: "SPAWN_UNIT", expectedCoins: 1 },
  { giftName: "Rosa", team: "A", tier: "T2", action: "SPAWN_UNIT", expectedCoins: 10 },
  { giftName: "Friendship Necklace", team: "B", tier: "T2", action: "SPAWN_UNIT", expectedCoins: 10 },
  { giftName: "Doughnut", team: "A", tier: "T3", action: "SPAWN_UNIT", expectedCoins: 30 },
  { giftName: "Energy Capsule", team: "B", tier: "T3", action: "SPAWN_UNIT", expectedCoins: 30 },
  { giftName: "Hearts", team: "A", tier: "T4", action: "SPAWN_UNIT", expectedCoins: 199 },
  { giftName: "Sunglasses", team: "B", tier: "T4", action: "SPAWN_UNIT", expectedCoins: 199 },
  { giftName: "Money Gun", team: "A", tier: "T5", action: "SPAWN_UNIT", expectedCoins: 500 },
  { giftName: "VR Goggles", team: "B", tier: "T5", action: "SPAWN_UNIT", expectedCoins: 500 },
  { giftName: "Star of Red Carpet", team: "A", tier: "T6", action: "SPAWN_UNIT", expectedCoins: 1999 },
  { giftName: "Mystery Firework", team: "B", tier: "T6", action: "SPAWN_UNIT", expectedCoins: 1999 },
];

const byGiftId = new Map<string, CombatGiftMapping>();
const byNormalizedName = new Map<string, CombatGiftMapping>();

function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/['']/g, "'");
}

for (const mapping of MAPPING_TABLE) {
  byNormalizedName.set(normalizeName(mapping.giftName), mapping);
  if (mapping.giftId) byGiftId.set(mapping.giftId, mapping);
}

export function registerGiftId(giftId: string, giftName: string): void {
  const existing = byNormalizedName.get(normalizeName(giftName));
  if (existing && !existing.giftId) {
    const updated = { ...existing, giftId };
    byGiftId.set(giftId, updated);
    byNormalizedName.set(normalizeName(giftName), updated);
  }
}

export function mapGift(input: {
  giftId?: string;
  giftName?: string;
  coinValue?: number;
  repeatCount: number;
  viewer: { id?: string; username?: string; nickname?: string; avatarUrl?: string };
}): GiftMappingResult {
  const { giftId, giftName, coinValue, repeatCount, viewer } = input;

  let mapping: CombatGiftMapping | undefined;
  if (giftId) mapping = byGiftId.get(giftId);
  if (!mapping && giftName) mapping = byNormalizedName.get(normalizeName(giftName));

  if (!mapping) {
    console.log(
      `UNKNOWN_GIFT giftId=${giftId ?? "?"} giftName=${giftName ?? "?"} coins=${coinValue ?? "?"}`
    );
    return { status: "UNKNOWN_GIFT" };
  }

  if (coinValue !== undefined && coinValue > 0 && coinValue !== mapping.expectedCoins) {
    console.log(
      `GIFT_PRICE_MISMATCH giftId=${giftId ?? "?"} giftName=${giftName ?? "?"} expectedCoins=${mapping.expectedCoins} receivedCoins=${coinValue}`
    );
  }

  const combatGift: CombatGift = {
    type: "COMBAT_GIFT",
    source: "TIKTOK",
    team: mapping.team,
    tier: mapping.tier,
    quantity: Math.max(1, Math.floor(repeatCount)),
    giftId: giftId ?? mapping.giftId ?? mapping.giftName,
    giftName: mapping.giftName,
    expectedCoins: mapping.expectedCoins,
    viewer,
  };

  console.log(
    `GIFT_MAPPING_RESULT giftId=${combatGift.giftId} giftName=${combatGift.giftName} team=${combatGift.team} tier=${combatGift.tier} expectedCoins=${combatGift.expectedCoins} quantity=${combatGift.quantity}`
  );

  return { status: "MAPPED", combatGift, mapping };
}

export function getMappingTable(): readonly CombatGiftMapping[] {
  return MAPPING_TABLE;
}
