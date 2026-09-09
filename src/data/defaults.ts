import type {
  BattleConfig,
  BattleThemeId,
  ChestConfig,
  ReviveConfig,
  TierGameplayStats,
  TierId,
  VoteConfig,
} from "@/domain/types";

export const DEFAULT_BASE_HP = 100000;
export const DEFAULT_DURATION_SECONDS = 390;
export const DEFAULT_AUTO_SPAWN_INTERVAL = 1.5;
export const DEFAULT_CHEST_THRESHOLD = 10000;
export const DEFAULT_LOOP_INTERMISSION_SECONDS = 10;

export const DEFAULT_TIER_STATS: Record<TierId, TierGameplayStats> = {
  T1: {
    hp: 100,
    dps: 12,
    speed: 1.0,
    structureDps: 8,
    targetPriceEuro: 0.01,
  },
  T2: {
    hp: 350,
    dps: 65,
    speed: 0.9,
    structureDps: 25,
    range: 35,
    targetPriceEuro: 0.1,
  },
  T3: {
    hp: 650,
    healingPerSecond: 250,
    healingPool: 5000,
    speed: 0.85,
    targetPriceEuro: 0.5,
    collisionRadius: 7,
    frontageCost: 1,
    knockbackResistance: 0,
    healing: {
      healPerSecond: 250,
      maxHealPool: 5000,
      range: 70,
      acquisitionRange: 140,
      canHealSelf: false,
      canHealBase: false,
      preferredSupportDistance: 20,
      targetSwitchThreshold: 0.2,
      reevaluationInterval: 0.3,
      efficiencies: {
        T1: 1.0,
        T2: 1.0,
        T3: 1.0,
        T4: 0.5,
        T5: 0.25,
      },
    },
  },
  T4: {
    hp: 8000,
    dps: 220,
    speed: 0.8,
    structureDps: 400,
    aoeDamage: 1500,
    targetPriceEuro: 2,
    collisionRadius: 14,
    frontageCost: 3,
    knockbackResistance: 0.5,
    charge: {
      enabled: true,
      speedMultiplier: 1.8,
      impactDamage: 1500,
      impactRadius: 50,
      knockbackDistance: 25,
      maxDuration: 8,
    },
  },
  T5: {
    hp: 18000,
    dps: 450,
    speed: 0.7,
    structureDps: 300,
    aoeDamage: 900,
    abilityCooldown: 4,
    targetPriceEuro: 5,
    collisionRadius: 20,
    frontageCost: 4,
    knockbackResistance: 0.8,
    heavySlam: {
      enabled: true,
      damage: 900,
      radius: 60,
      cooldownSeconds: 4,
      knockbackDistance: 18,
      initialDelaySeconds: 2,
      windupSeconds: 0.5,
    },
    deployment: {
      speedMultiplier: 1.3,
      collisionPriority: 8,
    },
  },
  T6: {
    targetPriceEuro: 20,
    ultimate: {
      lightTierRemovalRatio: 0.90,
      t4CurrentHpDamageRatio: 0.55,
      t5MaxHpDamageRatio: 0.45,
      baseMaxHpDamageRatio: 0.08,
      knockbackDistance: 40,
      stunDurationSeconds: 0,
    },
  },
};

export const DEFAULT_CHEST_CONFIG: ChestConfig = {
  enabled: true,
  likeThreshold: DEFAULT_CHEST_THRESHOLD,
  carryOverflowLikes: true,
  contributionPointsPerChestGift: 1,
  tiePolicy: "SUDDEN_DEATH",
  reward: {
    type: "SPAWN_MULTIPLIER",
    multiplier: 2,
    durationSeconds: 15,
  },
  chestGiftMappings: {
    red: {
      giftName: "Cheer You Up",
      coinValue: 9,
      points: 1,
    },
    blue: {
      giftName: "Club Power",
      coinValue: 9,
      points: 1,
    },
  },
};

export const DEFAULT_REVIVE_CONFIG: ReviveConfig = {
  enabled: false,
  reviveHpPercent: 20,
  overtimeSeconds: 120,
};

export const DEFAULT_VOTE_CONFIG: VoteConfig = {
  enabled: true,
  durationSeconds: 18,
  duelCandidateCount: 6,
  duelCooldownRounds: 3,
};

export const DEFAULT_DUEL_ID = "ronaldo-vs-messi";
export const DEFAULT_THEME_ID: BattleThemeId = "pirates";

export function createDefaultBattleConfig(): BattleConfig {
  return {
    duelId: DEFAULT_DUEL_ID,
    battleThemeId: DEFAULT_THEME_ID,
    teamA: {
      side: "A",
      commanderId: "ronaldo",
      displayName: "Cristiano Ronaldo",
      primaryColor: "#dc2626",
      secondaryColor: "#f87171",
    },
    teamB: {
      side: "B",
      commanderId: "messi",
      displayName: "Lionel Messi",
      primaryColor: "#2563eb",
      secondaryColor: "#60a5fa",
    },
    combat: {
      baseHp: DEFAULT_BASE_HP,
      durationSeconds: DEFAULT_DURATION_SECONDS,
      autoSpawnIntervalSeconds: DEFAULT_AUTO_SPAWN_INTERVAL,
    },
    tiers: structuredClone(DEFAULT_TIER_STATS),
    chest: { ...DEFAULT_CHEST_CONFIG },
    revive: { ...DEFAULT_REVIVE_CONFIG },
    vote: { ...DEFAULT_VOTE_CONFIG },
  };
}
