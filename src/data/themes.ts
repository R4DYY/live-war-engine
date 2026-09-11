import type {
  BattleThemeDefinition,
  BattleThemeId,
  ThemeTierDefinition,
  TierId,
} from "@/domain/types";
import { DEFAULT_TIER_STATS } from "@/data/defaults";
import { TIER_ROLE_MAP } from "@/domain/types";

function makeTier(
  tier: TierId,
  displayName: string,
  assetId?: string
): ThemeTierDefinition {
  return {
    tier,
    role: TIER_ROLE_MAP[tier],
    displayName,
    assetId,
    stats: { ...DEFAULT_TIER_STATS[tier] },
  };
}

export const BATTLE_THEMES: Record<BattleThemeId, BattleThemeDefinition> = {
  medieval: {
    id: "medieval",
    displayName: "Medieval",
    arenaClassName: "arena-medieval",
    tiers: {
      T1: makeTier("T1", "Footman", "medieval_t1_footman"),
      T2: makeTier("T2", "Longbow Elite", "medieval_t2_longbow"),
      T3: makeTier("T3", "Battle Cleric", "medieval_t3_cleric"),
      T4: makeTier("T4", "Battering Ram", "medieval_t4_ram"),
      T5: makeTier("T5", "Royal Champion", "medieval_t5_champion"),
      T6: makeTier("T6", "Dragon Strike", "medieval_t6_dragon"),
    },
  },
  arcane: {
    id: "arcane",
    displayName: "Arcane",
    arenaClassName: "arena-arcane",
    tiers: {
      T1: makeTier("T1", "Apprentice Mage", "arcane_t1_apprentice"),
      T2: makeTier("T2", "Battle Mage", "arcane_t2_battlemage"),
      T3: makeTier("T3", "Lifeweaver", "arcane_t3_lifeweaver"),
      T4: makeTier("T4", "Arcane Golem", "arcane_t4_golem"),
      T5: makeTier("T5", "Archmage", "arcane_t5_archmage"),
      T6: makeTier("T6", "Meteor Storm", "arcane_t6_meteor"),
    },
  },
  modern: {
    id: "modern",
    displayName: "Modern",
    arenaClassName: "arena-modern",
    tiers: {
      T1: makeTier("T1", "Rifleman", "modern_t1_rifleman"),
      T2: makeTier("T2", "Sniper", "modern_t2_sniper"),
      T3: makeTier("T3", "Combat Medic", "modern_t3_medic"),
      T4: makeTier("T4", "Armored Vehicle", "modern_t4_vehicle"),
      T5: makeTier("T5", "Juggernaut", "modern_t5_juggernaut"),
      T6: makeTier("T6", "Airstrike", "modern_t6_airstrike"),
    },
  },
  scifi: {
    id: "scifi",
    displayName: "Sci-Fi",
    arenaClassName: "arena-scifi",
    tiers: {
      T1: makeTier("T1", "Neon Trooper", "scifi_t1_trooper"),
      T2: makeTier("T2", "Plasma Ranger", "scifi_t2_ranger"),
      T3: makeTier("T3", "Nano Medic", "scifi_t3_medic"),
      T4: makeTier("T4", "Combat Mech", "scifi_t4_mech"),
      T5: makeTier("T5", "Titan Mech", "scifi_t5_titan"),
      T6: makeTier("T6", "Orbital Strike", "scifi_t6_orbital"),
    },
  },
  pirates: {
    id: "pirates",
    displayName: "Pirates",
    arenaClassName: "arena-pirates",
    tiers: {
      T1: makeTier("T1", "Deckhand", "pirates_t1_deckhand"),
      T2: makeTier("T2", "Musketeer", "pirates_t2_musketeer"),
      T3: makeTier("T3", "Ship Surgeon", "pirates_t3_surgeon"),
      T4: makeTier("T4", "Cannon Cart", "pirates_t4_cannon"),
      T5: makeTier("T5", "Legendary Captain", "pirates_t5_captain"),
      T6: makeTier("T6", "Kraken Attack", "pirates_t6_kraken"),
    },
  },
};

export const BATTLE_THEME_IDS: BattleThemeId[] = Object.keys(
  BATTLE_THEMES
) as BattleThemeId[];

export function getTheme(id: BattleThemeId): BattleThemeDefinition {
  return BATTLE_THEMES[id];
}
