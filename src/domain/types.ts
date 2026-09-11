// ─── Team ───────────────────────────────────────────────────────────
export type TeamSide = "A" | "B";

// ─── Commander ──────────────────────────────────────────────────────
export interface CommanderDefinition {
  id: string;
  displayName: string;
  shortName?: string;
  iconAsset?: string;
  portraitAsset?: string;
  fullBodyAsset?: string;
  metadata?: Record<string, unknown>;
}

// ─── Duel ───────────────────────────────────────────────────────────
export interface DuelDefinition {
  id: string;
  commanderAId: string;
  commanderBId: string;
  displayName: string;
  enabled: boolean;
}

// ─── Tiers ──────────────────────────────────────────────────────────
export type TierId = "T1" | "T2" | "T3" | "T4" | "T5" | "T6";

export type TierRole =
  | "basic"
  | "specialist"
  | "healer"
  | "breaker"
  | "boss"
  | "ultimate";

export const TIER_IDS: TierId[] = ["T1", "T2", "T3", "T4", "T5", "T6"];

export const TIER_ROLE_MAP: Record<TierId, TierRole> = {
  T1: "basic",
  T2: "specialist",
  T3: "healer",
  T4: "breaker",
  T5: "boss",
  T6: "ultimate",
};

export const TIER_ROLE_LABELS: Record<TierRole, string> = {
  basic: "Basic / Reinforcement",
  specialist: "Specialist",
  healer: "Healer / Support",
  breaker: "Breaker",
  boss: "Boss",
  ultimate: "Ultimate",
};

export interface TierGameplayStats {
  hp?: number;
  dps?: number;
  structureDps?: number;
  speed?: number;
  range?: number;
  healingPerSecond?: number;
  healingPool?: number;
  aoeDamage?: number;
  abilityCooldown?: number;
  targetPriceEuro?: number;
  collisionRadius?: number;
  frontageCost?: number;
  knockbackResistance?: number;
  charge?: {
    enabled: boolean;
    speedMultiplier: number;
    impactDamage: number;
    impactRadius: number;
    knockbackDistance: number;
    maxDuration: number;
  };
  heavySlam?: {
    enabled: boolean;
    damage: number;
    radius: number;
    cooldownSeconds: number;
    knockbackDistance: number;
    initialDelaySeconds: number;
    windupSeconds: number;
  };
  deployment?: {
    speedMultiplier: number;
    collisionPriority: number;
  };
  healing?: {
    healPerSecond: number;
    maxHealPool: number;
    range: number;
    acquisitionRange: number;
    canHealSelf: boolean;
    canHealBase: boolean;
    preferredSupportDistance: number;
    targetSwitchThreshold: number;
    reevaluationInterval: number;
    efficiencies: Record<string, number>;
  };
  ultimate?: {
    lightTierRemovalRatio: number;
    t4CurrentHpDamageRatio: number;
    t5MaxHpDamageRatio: number;
    baseMaxHpDamageRatio: number;
    knockbackDistance: number;
    stunDurationSeconds: number;
  };
}

export interface ThemeTierDefinition {
  tier: TierId;
  role: TierRole;
  displayName: string;
  assetId?: string;
  iconAsset?: string;
  stats: TierGameplayStats;
}

// ─── Battle Theme ───────────────────────────────────────────────────
export type BattleThemeId =
  | "medieval"
  | "arcane"
  | "modern"
  | "scifi"
  | "pirates";

export interface BattleThemeDefinition {
  id: BattleThemeId;
  displayName: string;
  arenaClassName?: string;
  backgroundAsset?: string;
  tiers: Record<TierId, ThemeTierDefinition>;
}

// ─── Team Config ────────────────────────────────────────────────────
export interface TeamConfig {
  side: TeamSide;
  commanderId: string;
  displayName: string;
  primaryColor: string;
  secondaryColor?: string;
}

// ─── Future Subsystem Configs ───────────────────────────────────────
export type ChestTiePolicy = "NO_REWARD" | "BOTH_TEAMS" | "RANDOM" | "SUDDEN_DEATH";

export interface ChestGiftMapping {
  giftName: string;
  coinValue: number;
  points: number;
}

export interface ChestGiftMappings {
  red: ChestGiftMapping;
  blue: ChestGiftMapping;
}

export type ChestRewardType =
  | "SPAWN_MULTIPLIER"
  | "BASE_REPAIR"
  | "SHIELD"
  | "RAGE"
  | "SPEED"
  | "GIANT"
  | "AIRSTRIKE";

export interface ChestRewardConfig {
  type: ChestRewardType;
  multiplier: number;
  durationSeconds: number;
}

export interface ChestConfig {
  enabled: boolean;
  likeThreshold: number;
  carryOverflowLikes: boolean;
  contributionPointsPerChestGift: number;
  tiePolicy: ChestTiePolicy;
  reward: ChestRewardConfig;
  chestGiftMappings: ChestGiftMappings;
}

export interface ReviveConfig {
  enabled: boolean;
  reviveHpPercent: number;
  overtimeSeconds: number;
}

export interface VoteConfig {
  enabled: boolean;
  durationSeconds: number;
  duelCandidateCount: number;
  duelCooldownRounds: number;
}

// ─── Battle Config ──────────────────────────────────────────────────
export interface BattleConfig {
  duelId: string;
  battleThemeId: BattleThemeId;
  teamA: TeamConfig;
  teamB: TeamConfig;
  combat: {
    baseHp: number;
    durationSeconds: number;
    autoSpawnIntervalSeconds: number;
    formationGap?: number;
    meleeFrontageSlots?: number;
    baseAttackSlots?: number;
  };
  tiers: Record<TierId, TierGameplayStats>;
  chest: ChestConfig;
  revive: ReviveConfig;
  vote: VoteConfig;
}

// ─── Engine Lifecycle ───────────────────────────────────────────────
export type EngineStatus = "IDLE" | "READY" | "RUNNING" | "PAUSED" | "ENDED";

export type LoopPhase =
  | "IDLE"
  | "PREPARING"
  | "BATTLE"
  | "RESULT"
  | "INTERMISSION"
  | "STOPPING"
  | "ERROR";


export type BattleEndReason =
  | "BASE_DESTROYED"
  | "TIMER"
  | "MANUAL_STOP"
  | "ABORT"
  | "RESET";

// ─── Team Runtime ───────────────────────────────────────────────────
export interface TeamRuntimeState {
  side: TeamSide;
  baseHp: number;
  maxBaseHp: number;
}

// ─── Battle Session ─────────────────────────────────────────────────
export interface BattleSession {
  id: string;
  roundNumber: number;
  status: EngineStatus;
  config: BattleConfig;
  startedAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
  loopMode: boolean;
  loopSessionId: string | null;
  teamA: TeamRuntimeState;
  teamB: TeamRuntimeState;
  winner: TeamSide | null;
  endReason: BattleEndReason | null;
}

// ─── Engine Events ──────────────────────────────────────────────────
export type EngineEventType =
  | "ENGINE_STARTED"
  | "ENGINE_RESET"
  | "CONFIG_UPDATED"
  | "BATTLE_STARTED"
  | "BATTLE_ENDED"
  | "BATTLE_STOPPED"
  | "LOOP_STARTED"
  | "LOOP_STOP_REQUESTED"
  | "LOOP_STOPPED"
  | "ROUND_PREPARING"
  | "ROUND_STARTED"
  | "INTERMISSION_STARTED"
  | "INTERMISSION_ENDED"
  | "ENGINE_ERROR"
  | "LOOP_ENABLED"
  | "LOOP_DISABLED"
  | "LOOP_RESTART"
  | "VALIDATION_ERROR"
  | "UNIT_SPAWNED"
  | "UNIT_DIED"
  | "BASE_DAMAGED"
  | "BASE_DESTROYED"
  | "BATTLE_RESULT"
  | "CHEST_CYCLE_STARTED"
  | "CHEST_PROGRESS"
  | "CHEST_CONTRIBUTION"
  | "CHEST_UNLOCKED"
  | "CHEST_REWARD_APPLIED"
  | "CHEST_REWARD_EXPIRED"
  | "CHEST_SUDDEN_DEATH_STARTED"
  | "CHEST_WINNER_RESOLVED"
  | "CHEST_OPENING_STARTED"
  | "CHEST_REWARD_SELECTED";

export interface EngineEvent {
  id: string;
  type: EngineEventType;
  timestamp: number;
  battleId?: string;
  loopSessionId?: string;
  payload?: Record<string, unknown>;
}

export interface LoopConfig {
  intermissionSeconds: number;
  gracefulStop: boolean;
}

export interface CompletedRoundSummary {
  battleId: string;
  loopSessionId: string | null;
  roundNumber: number;
  winner: TeamSide | null;
  endReason: BattleEndReason;
  startedAt: number;
  endedAt: number;
  baseHpA: number;
  baseHpB: number;
  duelId: string;
  battleThemeId: BattleThemeId;
}

export interface LoopSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  startingRoundNumber: number;
  roundsCompleted: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
}

export interface LoopRuntimeState {
  phase: LoopPhase;
  session: LoopSession | null;
  gracefulStopRequested: boolean;
  intermissionStartedAt: number | null;
  nextRoundAt: number | null;
  nextDuelId: string | null;
  lastSummary: CompletedRoundSummary | null;
  completedRounds: CompletedRoundSummary[];
  recentDuelIds: string[];
}

// ─── Future Input Commands ──────────────────────────────────────────
export type GameCommandType =
  | "DEPLOY_TIER"
  | "ADD_LIKES"
  | "CHEST_GIFT"
  | "CHEST_CONTRIBUTION"
  | "REVIVE"
  | "CAST_VOTE";

export interface GameCommand {
  type: GameCommandType;
  teamSide: TeamSide;
  payload?: Record<string, unknown>;
  timestamp: number;
}
