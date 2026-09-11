// ─── Arena Unit States ─────────────────────────────────────────────
export type ArenaTeam = "top" | "bottom";

export type MovementState = "SPAWNING" | "MOVING" | "BLOCKED" | "DEAD" | "CHARGING" | "DISPLACED";
export type CombatState = "IDLE" | "ATTACKING_UNIT" | "ATTACKING_BASE";
export type UnitState = MovementState | "FIGHTING" | "ATTACKING_BASE" | "DEAD";

export type UnitSource = "AUTO" | "SIMULATION" | "VIEWER_GIFT" | "LIVE";

export type AttackTargetType = "UNIT" | "BASE";
export interface AttackTarget {
  type: AttackTargetType;
  id: number; // unit ID, or 0 for base
  team: ArenaTeam; // target team (enemy team)
}

// ─── Breaker Charge State ──────────────────────────────────────────
export type ChargeState = "NONE" | "CHARGING" | "IMPACT_CONSUMED";

// ─── Boss Slam State ───────────────────────────────────────────────
export type SlamState = "NONE" | "READY" | "WINDUP" | "COOLDOWN";

// ─── Healer State ──────────────────────────────────────────────────
export type HealerState = "IDLE" | "SEEKING" | "HEALING" | "EXHAUSTED";

// ─── Displacement Intent ──────────────────────────────────────────
export interface DisplacementIntent {
  targetId: number;
  direction: number; // +1 or -1 (Y-axis direction)
  distance: number; // logical units
  sourceId: number;
}

// ─── Visual Impact Effect ──────────────────────────────────────────
export interface ImpactEffect {
  id: number;
  x: number;
  y: number;
  team: ArenaTeam;
  radius: number;
  bornAt: number;
  ttl: number;
}

// ─── Ultimate Event ──────────────────────────────────────────────────
export interface UltimateEvent {
  id: number;
  team: ArenaTeam; // triggering team
  theme: string;
  source: UnitSource;
  bornAt: number;
  ttl: number;
  // resolution metrics
  unitsBefore: number;
  t1Killed: number;
  t2Killed: number;
  t3Killed: number;
  t4Damage: number;
  t5Damage: number;
  baseDamage: number;
  survivorsDisplaced: number;
  battleEnded: boolean;
}

// ─── Arena Unit ────────────────────────────────────────────────────
export interface ArenaUnit {
  id: number;
  team: ArenaTeam;
  tier: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  range: number;
  structureDps: number;
  economicValue: number;
  radius: number;
  frontageCost: number;
  knockbackResistance: number;
  collisionPriority: number;
  attackCooldown: number;
  cooldownTimer: number;
  state: UnitState;
  movementState: MovementState;
  combatState: CombatState;
  targetId: number | null;
  target: AttackTarget | null;
  source: UnitSource;
  spawnTime: number;
  deathTime: number | null;
  visualFireTimer: number;
  // Breaker runtime
  chargeState: ChargeState;
  chargeTimer: number;
  chargeSpeed: number;
  impactConsumed: boolean;
  impactDamage: number;
  impactRadius: number;
  knockbackDistance: number;
  maxChargeDuration: number;
  // Boss runtime
  slamState: SlamState;
  slamTimer: number;
  slamCooldown: number;
  slamDamage: number;
  slamRadius: number;
  slamKnockback: number;
  slamWindup: number;
  slamWindupTimer: number;
  slamInitialDelay: number;
  slamCount: number;
  deploymentSpeed: number;
  deploymentDone: boolean;
  // Healer runtime
  healerState: HealerState;
  healPerSecond: number;
  healPoolRemaining: number;
  healPoolMax: number;
  healingRange: number;
  acquisitionRange: number;
  healTargetId: number | null;
  healEfficiencies: Record<string, number>;
  healTargetReevalTimer: number;
  healTargetReevalInterval: number;
  targetSwitchThreshold: number;
  preferredSupportDistance: number;
  nominalHealAccumulator: number;
  actualHealAccumulator: number;
  healPoolConsumed: number;
  targetsHealedCount: number;
  healingByTier: Map<string, number>;
  specialState?: "GIANT";
  specialStateEndsAt?: number;
}

// ─── Pending Spawn ─────────────────────────────────────────────────
export interface PendingSpawn {
  team: ArenaTeam;
  tier: string;
  source: UnitSource;
  queuedAt: number;
}

// ─── Visual Projectile ─────────────────────────────────────────────
export interface VisualProjectile {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  team: ArenaTeam;
  tier: string;
  bornAt: number;
  ttl: number;
}

// ─── Per-Tier Metrics ──────────────────────────────────────────────
export interface TierMetrics {
  spawned: number;
  alive: number;
  fighting: number;
  died: number;
  damageToUnits: number;
  damageToBase: number;
  chargeImpacts: number;
  chargeDamage: number;
  chargeEnemiesHit: number;
  chargeEnemiesKilled: number;
  displacementApplied: number;
  slamCount: number;
  slamDamage: number;
  slamEnemiesHit: number;
  slamEnemiesKilled: number;
  slamDisplacement: number;
  avgLifetime: number;
  // Healer metrics
  healNominal: number;
  healActual: number;
  healPoolConsumed: number;
  healPoolWasted: number;
  healTargetsHealed: number;
  healTimeSpent: number;
  healByTier: Record<string, number>;
  avgHealerLifetime: number;
}

// ─── Battle Metrics ────────────────────────────────────────────────
export interface BattleMetrics {
  topSpawned: number;
  topAlive: number;
  topFighting: number;
  topDied: number;
  bottomSpawned: number;
  bottomAlive: number;
  bottomFighting: number;
  bottomDied: number;
  topBaseDamageDealt: number;
  bottomBaseDamageDealt: number;
  topPending: number;
  bottomPending: number;
  topByTier: Record<string, TierMetrics>;
  bottomByTier: Record<string, TierMetrics>;
}

// ─── Simulation Snapshot ───────────────────────────────────────────
export interface SimulationSnapshot {
  units: ArenaUnit[];
  projectiles: VisualProjectile[];
  impactEffects: ImpactEffect[];
  ultimateEffects: UltimateEvent[];
  topBaseHp: number;
  bottomBaseHp: number;
  maxBaseHp: number;
  metrics: BattleMetrics;
  winner: ArenaTeam | null;
  isDraw: boolean;
  endReason: string | null;
  isRunning: boolean;
  isPaused: boolean;
  autoSpawnEnabled: boolean;
  elapsedSeconds: number;
  simElapsedSeconds: number;
  speed: number;
}

// ─── Factory ───────────────────────────────────────────────────────
export function createEmptyMetrics(): BattleMetrics {
  return {
    topSpawned: 0,
    topAlive: 0,
    topFighting: 0,
    topDied: 0,
    bottomSpawned: 0,
    bottomAlive: 0,
    bottomFighting: 0,
    bottomDied: 0,
    topBaseDamageDealt: 0,
    bottomBaseDamageDealt: 0,
    topPending: 0,
    bottomPending: 0,
    topByTier: {},
    bottomByTier: {},
  };
}

export function createEmptySnapshot(): SimulationSnapshot {
  return {
    units: [],
    projectiles: [],
    impactEffects: [],
    ultimateEffects: [],
    topBaseHp: 1000,
    bottomBaseHp: 1000,
    maxBaseHp: 1000,
    metrics: createEmptyMetrics(),
    winner: null,
    isDraw: false,
    endReason: null,
    isRunning: false,
    isPaused: false,
    autoSpawnEnabled: true,
    elapsedSeconds: 0,
    simElapsedSeconds: 0,
    speed: 1,
  };
}
