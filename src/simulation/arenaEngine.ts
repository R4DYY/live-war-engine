import type { BattleConfig, TierId, TeamSide } from "@/domain/types";
import type {
  ArenaUnit,
  ArenaTeam,
  PendingSpawn,
  BattleMetrics,
  SimulationSnapshot,
  UnitSource,
  VisualProjectile,
  TierMetrics,
  ImpactEffect,
  UltimateEvent,
} from "./types";
import { createEmptyMetrics } from "./types";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  BASE_X,
  BASE_RADIUS,
  SPAWN_Y_TOP,
  SPAWN_Y_BOTTOM,
  SPAWN_X_MIN,
  SPAWN_X_MAX,
  SPAWN_JITTER_Y,
  SPAWN_DURATION,
  MAX_UNITS_PER_TEAM,
  UNIT_RADIUS,
  T4_RADIUS,
  T4_FRONTAGE_COST,
  T4_KNOCKBACK_RESISTANCE,
  T4_CHARGE_SPEED_MULT,
  T4_IMPACT_RADIUS,
  T4_KNOCKBACK_DISTANCE,
  T4_MAX_CHARGE_DURATION,
  T5_RADIUS,
  T5_FRONTAGE_COST,
  T5_KNOCKBACK_RESISTANCE,
  T5_SLAM_DAMAGE,
  T5_SLAM_RADIUS,
  T5_SLAM_COOLDOWN,
  T5_SLAM_KNOCKBACK,
  T5_SLAM_INITIAL_DELAY,
  T5_SLAM_WINDUP,
  T5_DEPLOYMENT_PRIORITY,
  T3_RADIUS,
  T3_FRONTAGE_COST,
  T3_KNOCKBACK_RESISTANCE,
  T3_HEAL_PER_SECOND,
  T3_HEAL_POOL,
  T3_HEALING_RANGE,
  T3_ACQUISITION_RANGE,
  T3_PREFERRED_SUPPORT_DISTANCE,
  T3_TARGET_SWITCH_THRESHOLD,
  T3_REEVAL_INTERVAL,
  T3_EFFICIENCIES,
  T6_LIGHT_TIER_REMOVAL_RATIO,
  T6_T4_CURRENT_HP_DAMAGE_RATIO,
  T6_T5_MAX_HP_DAMAGE_RATIO,
  T6_BASE_MAX_HP_DAMAGE_RATIO,
  T6_KNOCKBACK_DISTANCE,
  T6_VISUAL_DURATION,
  SPEED_SCALE,
  DEFAULT_UNIT_DAMAGE,
  DEFAULT_ATTACK_COOLDOWN,
  DEAD_CLEANUP_DELAY,
  getBaseY,
  getEnemyBaseY,
  getForwardDirectionY,
  getEnemyTeam,
} from "./constants";

// ─── Mutable Simulation State ──────────────────────────────────────
interface ArenaState {
  units: ArenaUnit[];
  pendingSpawns: PendingSpawn[];
  projectiles: VisualProjectile[];
  impactEffects: ImpactEffect[];
  topBaseHp: number;
  bottomBaseHp: number;
  maxBaseHp: number;
  elapsed: number;
  realElapsed: number;
  autoSpawnEnabled: boolean;
  autoSpawnTimer: number;
  autoSpawnInterval: number;
  durationSeconds: number;
  nextId: number;
  nextProjectileId: number;
  nextImpactEffectId: number;
  winner: ArenaTeam | null;
  isDraw: boolean;
  endReason: string | null;
  config: BattleConfig;
  tierDamageAccumulator: {
    toUnits: Map<string, number>;
    toBase: Map<string, number>;
  };
  // Per-tier charge metrics
  chargeMetrics: Map<string, { impacts: number; damage: number; enemiesHit: number; enemiesKilled: number; displacement: number }>;
  // Per-tier slam metrics
  slamMetrics: Map<string, { slams: number; damage: number; enemiesHit: number; enemiesKilled: number; displacement: number; totalLifetime: number; deaths: number }>;
  // Per-tier heal metrics
  healMetrics: Map<string, { nominal: number; actual: number; poolConsumed: number; poolWasted: number; targetsHealed: number; timeSpent: number; byTier: Map<string, number>; totalLifetime: number; deaths: number }>;
  // Ultimate visual events
  ultimateEffects: UltimateEvent[];
  nextUltimateEffectId: number;
  // Chest spawn multiplier effects
  spawnMultipliers: { top: number; bottom: number };
  spawnMultiplierEndsAt: { top: number | null; bottom: number | null };
  // Chest team effects (shield, rage, giant)
  teamEffects: TeamEffect[];
}

export type TeamEffectType = "SHIELD" | "RAGE" | "GIANT";

export interface TeamEffect {
  id: number;
  team: ArenaTeam;
  type: TeamEffectType;
  multiplier: number;
  startedAt: number;
  endsAt: number;
  radius: number;
}

let state: ArenaState | null = null;

// ─── Team mapping ──────────────────────────────────────────────────
function teamSideToArena(side: TeamSide): ArenaTeam {
  return side === "A" ? "top" : "bottom";
}

function arenaToTeamSide(team: ArenaTeam): TeamSide {
  return team === "top" ? "A" : "B";
}

// ─── Init / Reset ──────────────────────────────────────────────────
export function initArena(config: BattleConfig): void {
  state = {
    units: [],
    pendingSpawns: [],
    projectiles: [],
    impactEffects: [],
    topBaseHp: config.combat.baseHp,
    bottomBaseHp: config.combat.baseHp,
    maxBaseHp: config.combat.baseHp,
    elapsed: 0,
    realElapsed: 0,
    autoSpawnEnabled: true,
    autoSpawnTimer: 0,
    autoSpawnInterval: config.combat.autoSpawnIntervalSeconds,
    durationSeconds: config.combat.durationSeconds,
    nextId: 1,
    nextProjectileId: 1,
    nextImpactEffectId: 1,
    winner: null,
    isDraw: false,
    endReason: null,
    config,
    tierDamageAccumulator: {
      toUnits: new Map(),
      toBase: new Map(),
    },
    chargeMetrics: new Map(),
    slamMetrics: new Map(),
    healMetrics: new Map(),
    ultimateEffects: [],
    nextUltimateEffectId: 1,
    spawnMultipliers: { top: 1, bottom: 1 },
    spawnMultiplierEndsAt: { top: null, bottom: null },
    teamEffects: [],
  };
}

export function resetArena(): void {
  state = null;
}

export function getArenaState(): ArenaState | null {
  return state;
}

// ─── Unit Factory ──────────────────────────────────────────────────
function createUnit(
  team: ArenaTeam,
  tier: string,
  source: UnitSource,
  now: number
): ArenaUnit {
  if (!state) throw new Error("Arena not initialized");

  const tierStats = state.config.tiers[tier as TierId];
  const spawnY = team === "top" ? SPAWN_Y_TOP : SPAWN_Y_BOTTOM;
  const jitterY = (Math.random() - 0.5) * SPAWN_JITTER_Y;
  const x = SPAWN_X_MIN + Math.random() * (SPAWN_X_MAX - SPAWN_X_MIN);

  const isT4 = tier === "T4";
  const isT5 = tier === "T5";
  const isT3 = tier === "T3";
  const radius = isT4 ? T4_RADIUS : isT5 ? T5_RADIUS : isT3 ? (tierStats?.collisionRadius ?? T3_RADIUS) : (tierStats?.collisionRadius ?? UNIT_RADIUS);
  const frontageCost = isT4 ? (tierStats?.frontageCost ?? T4_FRONTAGE_COST) : isT5 ? (tierStats?.frontageCost ?? T5_FRONTAGE_COST) : isT3 ? (tierStats?.frontageCost ?? T3_FRONTAGE_COST) : 1;
  const knockbackResistance = isT4 ? (tierStats?.knockbackResistance ?? T4_KNOCKBACK_RESISTANCE) : isT5 ? (tierStats?.knockbackResistance ?? T5_KNOCKBACK_RESISTANCE) : isT3 ? (tierStats?.knockbackResistance ?? T3_KNOCKBACK_RESISTANCE) : 0;
  const chargeCfg = tierStats?.charge;
  const slamCfg = tierStats?.heavySlam;
  const deployCfg = tierStats?.deployment;
  const healCfg = tierStats?.healing;

  const baseSpeed = (tierStats?.speed ?? 1) * SPEED_SCALE;
  const chargeSpeed = chargeCfg?.enabled ? baseSpeed * (chargeCfg.speedMultiplier ?? T4_CHARGE_SPEED_MULT) : baseSpeed;
  const deploymentSpeed = deployCfg ? baseSpeed * deployCfg.speedMultiplier : baseSpeed;

  const unit: ArenaUnit = {
    id: state.nextId++,
    team,
    tier,
    x,
    y: spawnY + jitterY,
    hp: tierStats?.hp ?? 100,
    maxHp: tierStats?.hp ?? 100,
    speed: baseSpeed,
    damage: isT3 ? 0 : (tierStats?.dps ?? DEFAULT_UNIT_DAMAGE),
    range: (tierStats?.range ?? 1) * SPEED_SCALE,
    structureDps: tierStats?.structureDps ?? (tierStats?.dps ?? DEFAULT_UNIT_DAMAGE) * 0.5,
    economicValue: tierStats?.targetPriceEuro ?? 0,
    radius,
    frontageCost,
    knockbackResistance,
    collisionPriority: 0,
    attackCooldown: DEFAULT_ATTACK_COOLDOWN,
    cooldownTimer: 0,
    state: "SPAWNING",
    movementState: "SPAWNING",
    combatState: "IDLE",
    targetId: null,
    target: null,
    source,
    spawnTime: now,
    deathTime: null,
    visualFireTimer: 0,
    // Breaker runtime
    chargeState: chargeCfg?.enabled ? "CHARGING" : "NONE",
    chargeTimer: 0,
    chargeSpeed,
    impactConsumed: false,
    impactDamage: chargeCfg?.impactDamage ?? 0,
    impactRadius: chargeCfg?.impactRadius ?? T4_IMPACT_RADIUS,
    knockbackDistance: chargeCfg?.knockbackDistance ?? T4_KNOCKBACK_DISTANCE,
    maxChargeDuration: chargeCfg?.maxDuration ?? T4_MAX_CHARGE_DURATION,
    // Boss runtime
    slamState: slamCfg?.enabled ? "READY" : "NONE",
    slamTimer: 0,
    slamCooldown: slamCfg?.cooldownSeconds ?? T5_SLAM_COOLDOWN,
    slamDamage: slamCfg?.damage ?? T5_SLAM_DAMAGE,
    slamRadius: slamCfg?.radius ?? T5_SLAM_RADIUS,
    slamKnockback: slamCfg?.knockbackDistance ?? T5_SLAM_KNOCKBACK,
    slamWindup: slamCfg?.windupSeconds ?? T5_SLAM_WINDUP,
    slamWindupTimer: 0,
    slamInitialDelay: slamCfg?.initialDelaySeconds ?? T5_SLAM_INITIAL_DELAY,
    slamCount: 0,
    deploymentSpeed,
    deploymentDone: !isT5,
    // Healer runtime
    healerState: isT3 ? "IDLE" : "IDLE",
    healPerSecond: healCfg?.healPerSecond ?? T3_HEAL_PER_SECOND,
    healPoolRemaining: healCfg?.maxHealPool ?? T3_HEAL_POOL,
    healPoolMax: healCfg?.maxHealPool ?? T3_HEAL_POOL,
    healingRange: healCfg?.range ?? T3_HEALING_RANGE,
    acquisitionRange: healCfg?.acquisitionRange ?? T3_ACQUISITION_RANGE,
    healTargetId: null,
    healEfficiencies: healCfg?.efficiencies ?? { ...T3_EFFICIENCIES },
    healTargetReevalTimer: 0,
    healTargetReevalInterval: healCfg?.reevaluationInterval ?? T3_REEVAL_INTERVAL,
    targetSwitchThreshold: healCfg?.targetSwitchThreshold ?? T3_TARGET_SWITCH_THRESHOLD,
    preferredSupportDistance: healCfg?.preferredSupportDistance ?? T3_PREFERRED_SUPPORT_DISTANCE,
    nominalHealAccumulator: 0,
    actualHealAccumulator: 0,
    healPoolConsumed: 0,
    targetsHealedCount: 0,
    healingByTier: new Map(),
  };

  const activeRage = state.teamEffects.find((effect) => effect.team === team && effect.type === "RAGE" && effect.endsAt > Date.now());
  if (activeRage) {
    unit.speed *= activeRage.multiplier;
    unit.chargeSpeed *= activeRage.multiplier;
    unit.deploymentSpeed *= activeRage.multiplier;
    unit.damage *= activeRage.multiplier;
    unit.structureDps *= activeRage.multiplier;
    unit.healPerSecond *= activeRage.multiplier;
  }

  const activeGiant = state.teamEffects.find((effect) => effect.team === team && effect.type === "GIANT" && effect.endsAt > Date.now());
  if (activeGiant && tier === "T1") {
    unit.maxHp *= 8;
    unit.hp = unit.maxHp;
    unit.radius *= 2;
    unit.speed *= 1.7;
    unit.chargeSpeed *= 1.7;
    unit.damage *= 2;
    unit.structureDps *= 2;
  }

  return unit;
}

// ─── Public Spawning ───────────────────────────────────────────────
export function spawnUnits(
  team: ArenaTeam,
  count: number,
  source: UnitSource = "SIMULATION",
  tier: string = "T1"
): void {
  if (!state || state.winner) return;

  const alive = state.units.filter(
    (u) => u.team === team && u.state !== "DEAD"
  ).length;
  const canSpawn = Math.min(count, MAX_UNITS_PER_TEAM - alive);

  for (let i = 0; i < canSpawn; i++) {
    state.units.push(createUnit(team, tier, source, state.elapsed));
  }
}

export function setSpawnMultiplier(team: ArenaTeam, multiplier: number, endsAtEpoch: number): void {
  if (!state) return;
  state.spawnMultipliers[team] = multiplier;
  state.spawnMultiplierEndsAt[team] = endsAtEpoch;
}

export function clearSpawnMultiplier(team: ArenaTeam): void {
  if (!state) return;
  state.spawnMultipliers[team] = 1;
  state.spawnMultiplierEndsAt[team] = null;
}

export function getSpawnMultiplier(team: ArenaTeam): number {
  if (!state) return 1;
  return state.spawnMultipliers[team];
}

export function applyTeamEffect(
  team: ArenaTeam,
  type: TeamEffectType,
  multiplier: number,
  endsAt: number,
  radius = 0
): TeamEffect | null {
  if (!state) return null;
  state.teamEffects = state.teamEffects.filter((effect) => effect.endsAt > Date.now());
  const effect: TeamEffect = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    team,
    type,
    multiplier,
    startedAt: Date.now(),
    endsAt,
    radius,
  };
  state.teamEffects.push(effect);
  return effect;
}

export function clearTeamEffects(): void {
  if (state) state.teamEffects = [];
}

export function getTeamEffects(): TeamEffect[] {
  if (!state) return [];
  const now = Date.now();
  state.teamEffects = state.teamEffects.filter((effect) => effect.endsAt > now);
  return state.teamEffects.map((effect) => ({ ...effect }));
}

function activeEffect(team: ArenaTeam, type: TeamEffectType): TeamEffect | null {
  if (!state) return null;
  return state.teamEffects.find((effect) => effect.team === team && effect.type === type && effect.endsAt > Date.now()) ?? null;
}

function rageMultiplier(team: ArenaTeam): number {
  return activeEffect(team, "RAGE")?.multiplier ?? 1;
}

function shieldReductionForUnit(unit: ArenaUnit): number {
  const shield = activeEffect(unit.team, "SHIELD");
  if (!shield || !state) return 0;
  const baseY = getBaseY(unit.team);
  const distanceToBase = Math.sqrt((unit.x - BASE_X) ** 2 + (unit.y - baseY) ** 2);
  return distanceToBase <= shield.radius ? Math.min(0.95, shield.multiplier) : 0;
}

function shieldReductionForBase(team: ArenaTeam): number {
  return activeEffect(team, "SHIELD")?.multiplier ?? 0;
}

export function healBase(team: ArenaTeam, percentOfMaxHp: number): number {
  if (!state) return 0;
  const amount = state.maxBaseHp * (percentOfMaxHp / 100);
  if (team === "top") {
    const before = state.topBaseHp;
    state.topBaseHp = Math.min(state.maxBaseHp, state.topBaseHp + amount);
    return state.topBaseHp - before;
  }
  const before = state.bottomBaseHp;
  state.bottomBaseHp = Math.min(state.maxBaseHp, state.bottomBaseHp + amount);
  return state.bottomBaseHp - before;
}

export function transformGiant(team: ArenaTeam): ArenaUnit | null {
  if (!state || state.winner) return null;
  let unit = state.units.find((candidate) => candidate.team === team && candidate.tier === "T1" && candidate.state !== "DEAD");
  if (!unit) {
    spawnUnits(team, 1, "LIVE", "T1");
    unit = [...state.units].reverse().find((candidate) => candidate.team === team && candidate.tier === "T1" && candidate.state !== "DEAD");
  }
  if (!unit) return null;
  unit.specialState = "GIANT";
  unit.specialStateEndsAt = Date.now() + 30000;
  unit.maxHp *= 8;
  unit.hp = unit.maxHp;
  unit.radius *= 2;
  unit.speed *= 1.7;
  unit.chargeSpeed *= 1.7;
  unit.damage *= 2;
  unit.structureDps *= 2;
  unit.movementState = "CHARGING";
  unit.state = "MOVING";
  unit.chargeState = "CHARGING";
  unit.collisionPriority = 12;
  return unit;
}

export function setAutoSpawn(enabled: boolean): void {
  if (state) state.autoSpawnEnabled = enabled;
}

export function forceBaseDamage(team: ArenaTeam, percent: number): void {
  if (!state) return;
  const dmg = state.maxBaseHp * (percent / 100);
  if (team === "top") {
    state.topBaseHp = Math.max(0, state.topBaseHp - dmg);
  } else {
    state.bottomBaseHp = Math.max(0, state.bottomBaseHp - dmg);
  }
}

// ─── Ultimate (T6) ──────────────────────────────────────────────────
export interface UltimateResult {
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

export function triggerUltimate(
  team: ArenaTeam,
  source: UnitSource = "SIMULATION"
): UltimateResult | null {
  if (!state || state.winner) return null;

  const cfg = state.config.tiers.T6?.ultimate;
  const lightRatio = cfg?.lightTierRemovalRatio ?? T6_LIGHT_TIER_REMOVAL_RATIO;
  const t4Ratio = cfg?.t4CurrentHpDamageRatio ?? T6_T4_CURRENT_HP_DAMAGE_RATIO;
  const t5Ratio = cfg?.t5MaxHpDamageRatio ?? T6_T5_MAX_HP_DAMAGE_RATIO;
  const baseRatio = cfg?.baseMaxHpDamageRatio ?? T6_BASE_MAX_HP_DAMAGE_RATIO;
  const knockbackDist = cfg?.knockbackDistance ?? T6_KNOCKBACK_DISTANCE;

  const enemyTeam = getEnemyTeam(team);
  const enemies = state.units.filter(
    (u) => u.team === enemyTeam && u.state !== "DEAD" && u.state !== "SPAWNING"
  );

  const unitsBefore = enemies.length;
  let t1Killed = 0;
  let t2Killed = 0;
  let t3Killed = 0;
  let t4Damage = 0;
  let t5Damage = 0;
  let survivorsDisplaced = 0;

  // T1–T3: deterministic removal by ratio (sort by id for determinism)
  const lightTiers: Record<string, ArenaUnit[]> = { T1: [], T2: [], T3: [] };
  for (const u of enemies) {
    if (u.tier in lightTiers) {
      lightTiers[u.tier].push(u);
    }
  }

  for (const tier of ["T1", "T2", "T3"] as const) {
    const group = lightTiers[tier].sort((a, b) => a.id - b.id);
    const killCount = Math.round(group.length * lightRatio);
    for (let i = 0; i < killCount; i++) {
      const u = group[i];
      u.hp = 0;
      u.state = "DEAD";
      u.movementState = "DEAD";
      u.combatState = "IDLE";
      u.deathTime = state.elapsed;
      u.targetId = null;
      u.target = null;
      u.chargeState = "NONE";
      u.slamState = "NONE";
      u.healTargetId = null;
      u.healerState = "IDLE";
      if (tier === "T1") t1Killed++;
      else if (tier === "T2") t2Killed++;
      else t3Killed++;
    }
  }

  // T4: damage based on current HP
  for (const u of enemies) {
    if (u.tier === "T4" && u.state !== "DEAD") {
      const dmg = u.hp * t4Ratio;
      u.hp -= dmg;
      t4Damage += dmg;
    }
  }

  // T5: damage based on max HP
  for (const u of enemies) {
    if (u.tier === "T5" && u.state !== "DEAD") {
      const dmg = u.maxHp * t5Ratio;
      u.hp -= dmg;
      t5Damage += dmg;
    }
  }

  // Base damage
  let baseDamage = 0;
  if (enemyTeam === "top") {
    baseDamage = state.maxBaseHp * baseRatio;
    state.topBaseHp = Math.max(0, state.topBaseHp - baseDamage);
  } else {
    baseDamage = state.maxBaseHp * baseRatio;
    state.bottomBaseHp = Math.max(0, state.bottomBaseHp - baseDamage);
  }

  // Knockback survivors toward their own base
  const knockbackDir = getForwardDirectionY(enemyTeam) * -1; // toward enemy's own base
  for (const u of enemies) {
    if (u.state === "DEAD") continue;
    applyDisplacement(u, knockbackDir, knockbackDist);
    resolveDisplacementCascade(u, knockbackDir, state.units);
    survivorsDisplaced++;
  }

  // Process deaths from T4/T5 damage
  for (const u of state.units) {
    if (u.hp <= 0 && u.state !== "DEAD") {
      u.state = "DEAD";
      u.movementState = "DEAD";
      u.combatState = "IDLE";
      u.deathTime = state.elapsed;
      u.targetId = null;
      u.target = null;
      u.chargeState = "NONE";
      u.slamState = "NONE";
      u.healTargetId = null;
      u.healerState = "IDLE";
    }
  }

  // Check battle end
  let battleEnded = false;
  if (state.topBaseHp <= 0 && state.bottomBaseHp <= 0) {
    state.isDraw = true;
    state.endReason = "BOTH_BASES_DESTROYED";
    state.winner = null;
    battleEnded = true;
  } else if (state.topBaseHp <= 0) {
    state.winner = "bottom";
    state.endReason = "BASE_DESTROYED";
    battleEnded = true;
  } else if (state.bottomBaseHp <= 0) {
    state.winner = "top";
    state.endReason = "BASE_DESTROYED";
    battleEnded = true;
  }

  // Create visual event
  const ultEvent: UltimateEvent = {
    id: state.nextUltimateEffectId++,
    team,
    theme: state.config.battleThemeId,
    source,
    bornAt: state.elapsed,
    ttl: T6_VISUAL_DURATION,
    unitsBefore,
    t1Killed,
    t2Killed,
    t3Killed,
    t4Damage,
    t5Damage,
    baseDamage,
    survivorsDisplaced,
    battleEnded,
  };
  state.ultimateEffects.push(ultEvent);

  return {
    unitsBefore,
    t1Killed,
    t2Killed,
    t3Killed,
    t4Damage,
    t5Damage,
    baseDamage,
    survivorsDisplaced,
    battleEnded,
  };
}

// ─── Spatial helpers ───────────────────────────────────────────────
function bodyDistance(a: ArenaUnit, b: ArenaUnit): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const centerDist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, centerDist - a.radius - b.radius);
}

function distance(a: ArenaUnit, b: ArenaUnit): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function bodyDistanceToPoint(u: ArenaUnit, px: number, py: number, bodyRadius: number): number {
  const dx = u.x - px;
  const dy = u.y - py;
  const centerDist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, centerDist - u.radius - bodyRadius);
}

function isForwardOf(unit: ArenaUnit, target: ArenaUnit): boolean {
  const dir = getForwardDirectionY(unit.team);
  return (target.y - unit.y) * dir >= -unit.radius * 2;
}

function getSeparation(a: ArenaUnit, b: ArenaUnit): number {
  return a.radius + b.radius + 2;
}

function getPassagePriority(unit: ArenaUnit): number {
  const tierPriority: Record<string, number> = {
    T1: 1,
    T2: 2,
    T3: 3,
    T4: 4,
    T5: 5,
    T6: 6,
  };
  return Math.max(unit.collisionPriority, tierPriority[unit.tier] ?? 1);
}

// ─── Targeting ──────────────────────────────────────────────────────
function findNearestForwardEnemy(unit: ArenaUnit, enemies: ArenaUnit[]): ArenaUnit | null {
  let closest: ArenaUnit | null = null;
  let minDist = Infinity;

  for (const e of enemies) {
    if (e.state === "DEAD") continue;
    if (!isForwardOf(unit, e)) continue;
    const d = distance(unit, e);
    if (d < minDist) {
      minDist = d;
      closest = e;
    }
  }

  return closest;
}

function findNearestEnemy(unit: ArenaUnit, enemies: ArenaUnit[]): ArenaUnit | null {
  let closest: ArenaUnit | null = null;
  let minDist = Infinity;

  for (const e of enemies) {
    if (e.state === "DEAD") continue;
    const d = distance(unit, e);
    if (d < minDist) {
      minDist = d;
      closest = e;
    }
  }

  return closest;
}

function validateTarget(unit: ArenaUnit): boolean {
  if (unit.targetId === null) return false;
  if (unit.targetId === 0) return true;
  const target = findById(unit.targetId);
  if (!target || target.state === "DEAD") return false;
  if (target.hp <= 0) return false;
  if (unit.tier === "T2") {
    if (!isForwardOf(unit, target)) return false;
    const bd = bodyDistance(unit, target);
    if (bd > unit.range) return false;
  }
  if (unit.tier === "T4" || unit.tier === "T5") {
    const bd = bodyDistance(unit, target);
    if (bd > unit.range) return false;
  }
  return true;
}

function acquireTarget(unit: ArenaUnit, enemies: ArenaUnit[]): void {
  const enemyTeam = getEnemyTeam(unit.team);
  const baseY = getEnemyBaseY(unit.team);
  const distToBase = bodyDistanceToPoint(unit, BASE_X, baseY, BASE_RADIUS);

  if (unit.tier === "T1" || unit.tier === "T4" || unit.tier === "T5") {
    // T1/T4/T5: nearest enemy or base
    const nearestEnemy = findNearestEnemy(unit, enemies);
    const enemyDist = nearestEnemy ? distance(unit, nearestEnemy) : Infinity;

    if (nearestEnemy && enemyDist <= unit.range) {
      unit.targetId = nearestEnemy.id;
      unit.target = { type: "UNIT", id: nearestEnemy.id, team: enemyTeam };
    } else if (distToBase <= unit.range) {
      unit.targetId = 0;
      unit.target = { type: "BASE", id: 0, team: enemyTeam };
    } else if (nearestEnemy && enemyDist < distToBase) {
      unit.targetId = nearestEnemy.id;
      unit.target = { type: "UNIT", id: nearestEnemy.id, team: enemyTeam };
    } else {
      unit.targetId = 0;
      unit.target = { type: "BASE", id: 0, team: enemyTeam };
    }
  } else if (unit.tier === "T2") {
    // T2 Specialist: nearest forward enemy within range, else base if in range
    const nearestForward = findNearestForwardEnemy(unit, enemies);

    if (nearestForward) {
      const bd = bodyDistance(unit, nearestForward);
      if (bd <= unit.range) {
        unit.targetId = nearestForward.id;
        unit.target = { type: "UNIT", id: nearestForward.id, team: enemyTeam };
        return;
      }
    }

    if (distToBase <= unit.range) {
      unit.targetId = 0;
      unit.target = { type: "BASE", id: 0, team: enemyTeam };
    } else {
      unit.targetId = null;
      unit.target = null;
    }
  }
}

// ─── Healing Target Scoring (pure) ──────────────────────────────────
export function computeHealingTargetScore(
  economicValue: number,
  currentHp: number,
  maxHp: number
): number {
  if (currentHp >= maxHp) return 0;
  const missingHpRatio = (maxHp - currentHp) / maxHp;
  return economicValue * missingHpRatio;
}

// ─── Healer Targeting ──────────────────────────────────────────────
function findHealingCandidates(healer: ArenaUnit, allies: ArenaUnit[]): ArenaUnit[] {
  const candidates: ArenaUnit[] = [];
  for (const a of allies) {
    if (a.id === healer.id) continue;
    if (a.state === "DEAD" || a.hp <= 0) continue;
    if (a.hp >= a.maxHp) continue;
    if (a.tier === "T6") continue;
    const d = distance(healer, a);
    if (d <= healer.acquisitionRange) {
      candidates.push(a);
    }
  }
  return candidates;
}

function selectHealingTarget(healer: ArenaUnit, allies: ArenaUnit[]): ArenaUnit | null {
  const candidates = findHealingCandidates(healer, allies);
  if (candidates.length === 0) return null;

  let best: ArenaUnit | null = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    const score = computeHealingTargetScore(c.economicValue, c.hp, c.maxHp);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  // Hysteresis: check if current target is still valid and new target isn't meaningfully better
  if (healer.healTargetId !== null) {
    const current = findById(healer.healTargetId);
    if (current && current.state !== "DEAD" && current.hp > 0 && current.hp < current.maxHp) {
      const currentScore = computeHealingTargetScore(current.economicValue, current.hp, current.maxHp);
      if (best && best.id !== current.id) {
        if (bestScore < currentScore * (1 + healer.targetSwitchThreshold)) {
          return current;
        }
      } else {
        return current;
      }
    }
  }

  return best;
}

// ─── Heal Resolution (pure) ───────────────────────────────────────
export function resolveHealing(
  targetMissingHp: number,
  nominalRequested: number,
  efficiency: number,
  poolRemaining: number
): { actualHpRestored: number; nominalPoolConsumed: number } {
  if (poolRemaining <= 0 || targetMissingHp <= 0 || nominalRequested <= 0) {
    return { actualHpRestored: 0, nominalPoolConsumed: 0 };
  }

  const availableNominal = Math.min(nominalRequested, poolRemaining);
  const actualFromAvailable = availableNominal * efficiency;
  const actualHeal = Math.min(actualFromAvailable, targetMissingHp);
  const nominalConsumed = actualHeal / efficiency;

  return {
    actualHpRestored: actualHeal,
    nominalPoolConsumed: nominalConsumed,
  };
}

// ─── Healer Update ─────────────────────────────────────────────────
function updateHealer(healer: ArenaUnit, allies: ArenaUnit[], dt: number): void {
  if (!state) return;
  if (healer.state === "DEAD" || healer.state === "SPAWNING") return;

  // Reevaluate target periodically
  healer.healTargetReevalTimer += dt;
  const shouldReeval = healer.healTargetReevalTimer >= healer.healTargetReevalInterval;

  // Validate current target
  if (healer.healTargetId !== null) {
    const target = findById(healer.healTargetId);
    if (!target || target.state === "DEAD" || target.hp <= 0 || target.hp >= target.maxHp) {
      healer.healTargetId = null;
    } else {
      const d = distance(healer, target);
      if (d > healer.acquisitionRange) {
        healer.healTargetId = null;
      }
    }
  }

  // Acquire new target if needed or reevaluate
  if (healer.healTargetId === null || shouldReeval) {
    healer.healTargetReevalTimer = 0;
    const target = selectHealingTarget(healer, allies);
    if (target) {
      if (healer.healTargetId !== target.id) {
        if (healer.healTargetId === null) {
          healer.targetsHealedCount++;
          const m = state.healMetrics.get("T3") ?? { nominal: 0, actual: 0, poolConsumed: 0, poolWasted: 0, targetsHealed: 0, timeSpent: 0, byTier: new Map(), totalLifetime: 0, deaths: 0 };
          m.targetsHealed++;
          state.healMetrics.set("T3", m);
        }
        healer.healTargetId = target.id;
      }
    } else {
      healer.healTargetId = null;
    }
  }

  // Check exhausted state
  if (healer.healPoolRemaining <= 0) {
    healer.healerState = "EXHAUSTED";
    healer.healTargetId = null;
    return;
  }

  // If we have a target, move toward it or heal
  if (healer.healTargetId !== null) {
    const target = findById(healer.healTargetId);
    if (target && target.state !== "DEAD" && target.hp < target.maxHp) {
      const d = bodyDistance(healer, target);
      if (d <= healer.healingRange) {
        // In range — heal
        healer.healerState = "HEALING";
        const efficiency = healer.healEfficiencies[target.tier] ?? 1.0;
        const nominalRequested = healer.healPerSecond * dt;
        const targetMissingHp = target.maxHp - target.hp;
        const { actualHpRestored, nominalPoolConsumed } = resolveHealing(
          targetMissingHp,
          nominalRequested,
          efficiency,
          healer.healPoolRemaining
        );

        target.hp = Math.min(target.maxHp, target.hp + actualHpRestored);
        healer.healPoolRemaining = Math.max(0, healer.healPoolRemaining - nominalPoolConsumed);
        healer.nominalHealAccumulator += nominalPoolConsumed;
        healer.actualHealAccumulator += actualHpRestored;
        healer.healPoolConsumed += nominalPoolConsumed;

        // Track healing by target tier
        healer.healingByTier.set(target.tier, (healer.healingByTier.get(target.tier) ?? 0) + actualHpRestored);

        // Track heal metrics
        const tierKey = healer.tier;
        const m = state.healMetrics.get(tierKey) ?? { nominal: 0, actual: 0, poolConsumed: 0, poolWasted: 0, targetsHealed: 0, timeSpent: 0, byTier: new Map(), totalLifetime: 0, deaths: 0 };
        m.nominal += nominalPoolConsumed;
        m.actual += actualHpRestored;
        m.poolConsumed += nominalPoolConsumed;
        m.timeSpent += dt;
        m.byTier.set(target.tier, (m.byTier.get(target.tier) ?? 0) + actualHpRestored);
        state.healMetrics.set(tierKey, m);

        return;
      } else {
        // Move toward target, positioning slightly behind it
        healer.healerState = "SEEKING";
        const dir = getForwardDirectionY(healer.team);
        const desiredY = target.y - dir * (healer.preferredSupportDistance + target.radius);
        moveToward(healer, target.x, desiredY, dt);
        return;
      }
    }
  }

  // No target — move with formation toward enemy base
  healer.healerState = "IDLE";
  const baseY = getEnemyBaseY(healer.team);
  moveToward(healer, BASE_X, baseY, dt);
}

// ─── AoE Query ─────────────────────────────────────────────────────
function queryEnemiesInArea(
  attacker: ArenaUnit,
  centerY: number,
  radius: number,
  enemies: ArenaUnit[]
): ArenaUnit[] {
  const result: ArenaUnit[] = [];
  for (const e of enemies) {
    if (e.state === "DEAD" || e.hp <= 0) continue;
    const dy = Math.abs(e.y - centerY);
    if (dy <= radius + e.radius) {
      result.push(e);
    }
  }
  return result;
}

// ─── Displacement ──────────────────────────────────────────────────
function applyDisplacement(
  target: ArenaUnit,
  direction: number,
  distance: number
): void {
  const effectiveDistance = distance * (1 - target.knockbackResistance);
  const newY = target.y + direction * effectiveDistance;
  target.y = Math.max(
    target.radius,
    Math.min(ARENA_HEIGHT - target.radius, newY)
  );
  target.movementState = "DISPLACED";
}

function resolveDisplacementCascade(
  displacedUnit: ArenaUnit,
  direction: number,
  allUnits: ArenaUnit[]
): void {
  // Push allied units that overlap after displacement
  const queue: ArenaUnit[] = [displacedUnit];
  const processed = new Set<number>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (processed.has(current.id)) continue;
    processed.add(current.id);

    for (const other of allUnits) {
      if (other.id === current.id || other.state === "DEAD" || other.state === "SPAWNING") continue;
      if (other.team !== current.team) continue;

      const sep = getSeparation(current, other);
      const dy = other.y - current.y;
      const dx = other.x - current.x;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < sep && dist > 0.01) {
        const overlap = sep - dist;
        // Push in the same direction as the knockback
        other.y += direction * overlap * 0.5;
        other.y = Math.max(other.radius, Math.min(ARENA_HEIGHT - other.radius, other.y));
        current.y -= direction * overlap * 0.5;
        current.y = Math.max(current.radius, Math.min(ARENA_HEIGHT - current.radius, current.y));
        queue.push(other);
      }
    }
  }
}

// ─── Charge Impact ─────────────────────────────────────────────────
function triggerChargeImpact(
  breaker: ArenaUnit,
  enemies: ArenaUnit[],
  allUnits: ArenaUnit[]
): { hit: number; killed: number; damage: number; displaced: number } {
  if (!state) return { hit: 0, killed: 0, damage: 0, displaced: 0 };

  const impactY = breaker.y + getForwardDirectionY(breaker.team) * breaker.radius;
  const targets = queryEnemiesInArea(breaker, impactY, breaker.impactRadius, enemies);

  let totalDamage = 0;
  let killed = 0;
  let displaced = 0;
  const knockbackDir = getForwardDirectionY(breaker.team);

  for (const target of targets) {
    target.hp -= breaker.impactDamage;
    totalDamage += breaker.impactDamage;
    if (target.hp <= 0) {
      killed++;
    } else {
      applyDisplacement(target, knockbackDir, breaker.knockbackDistance);
      resolveDisplacementCascade(target, knockbackDir, allUnits);
      displaced++;
    }
  }

  // Visual impact effect
  state.impactEffects.push({
    id: state.nextImpactEffectId++,
    x: breaker.x,
    y: impactY,
    team: breaker.team,
    radius: breaker.impactRadius,
    bornAt: state.elapsed,
    ttl: 0.6,
  });

  // Track charge metrics
  const tierKey = breaker.tier;
  const m = state.chargeMetrics.get(tierKey) ?? { impacts: 0, damage: 0, enemiesHit: 0, enemiesKilled: 0, displacement: 0 };
  m.impacts++;
  m.damage += totalDamage;
  m.enemiesHit += targets.length;
  m.enemiesKilled += killed;
  m.displacement += displaced;
  state.chargeMetrics.set(tierKey, m);

  return { hit: targets.length, killed, damage: totalDamage, displaced };
}

// ─── Boss Heavy Slam ───────────────────────────────────────────────
function triggerBossSlam(
  boss: ArenaUnit,
  enemies: ArenaUnit[],
  allUnits: ArenaUnit[]
): { hit: number; killed: number; damage: number; displaced: number } {
  if (!state) return { hit: 0, killed: 0, damage: 0, displaced: 0 };

  const targets = queryEnemiesInArea(boss, boss.y, boss.slamRadius, enemies);

  let totalDamage = 0;
  let killed = 0;
  let displaced = 0;
  const knockbackDir = getForwardDirectionY(boss.team);

  for (const target of targets) {
    target.hp -= boss.slamDamage;
    totalDamage += boss.slamDamage;
    if (target.hp <= 0) {
      killed++;
    } else {
      applyDisplacement(target, knockbackDir, boss.slamKnockback);
      resolveDisplacementCascade(target, knockbackDir, allUnits);
      displaced++;
    }
  }

  // Visual slam effect
  state.impactEffects.push({
    id: state.nextImpactEffectId++,
    x: boss.x,
    y: boss.y,
    team: boss.team,
    radius: boss.slamRadius,
    bornAt: state.elapsed,
    ttl: 0.7,
  });

  boss.slamCount++;

  // Track slam metrics
  const tierKey = boss.tier;
  const m = state.slamMetrics.get(tierKey) ?? { slams: 0, damage: 0, enemiesHit: 0, enemiesKilled: 0, displacement: 0, totalLifetime: 0, deaths: 0 };
  m.slams++;
  m.damage += totalDamage;
  m.enemiesHit += targets.length;
  m.enemiesKilled += killed;
  m.displacement += displaced;
  state.slamMetrics.set(tierKey, m);

  return { hit: targets.length, killed, damage: totalDamage, displaced };
}

// ─── Tick ──────────────────────────────────────────────────────────
// Update order:
// 1. Auto-spawn (T1 only)
// 2. Transition spawning → moving/charging/deploying
// 3. Build live unit lists
// 4. Target validation & acquisition
// 5. Movement (charge, deployment, advance, or hold) — T3 skipped
// 5b. Healer updates (targeting, movement, healing)
// 6. Collision/separation (with friendly yielding for charging T4 / deploying T5)
// 7. Charge impact detection
// 7b. Boss Heavy Slam lifecycle (ready → windup → impact → cooldown)
// 8. Combat damage (continuous DPS, simultaneous)
// 9. Base damage (structure DPS)
// 10. Deaths (cancel charge + slam state)
// 11. Dead cleanup
// 12. Visual projectiles & impact effects
// 13. Win conditions
export function tickArena(dt: number, realDt: number = dt): void {
  if (!state || state.winner) return;

  state.elapsed += dt;
  state.realElapsed += realDt;
  state.teamEffects = state.teamEffects.filter((effect) => effect.endsAt > Date.now());

  // 1. Auto-spawn (T1 only) with chest multiplier
  if (state.autoSpawnEnabled) {
    // Expire chest multipliers
    const now = Date.now();
    if (state.spawnMultiplierEndsAt.top !== null && now >= state.spawnMultiplierEndsAt.top) {
      state.spawnMultipliers.top = 1;
      state.spawnMultiplierEndsAt.top = null;
    }
    if (state.spawnMultiplierEndsAt.bottom !== null && now >= state.spawnMultiplierEndsAt.bottom) {
      state.spawnMultipliers.bottom = 1;
      state.spawnMultiplierEndsAt.bottom = null;
    }

    state.autoSpawnTimer += dt;
    if (state.autoSpawnTimer >= state.autoSpawnInterval) {
      state.autoSpawnTimer -= state.autoSpawnInterval;
      const topMult = state.spawnMultipliers.top;
      const botMult = state.spawnMultipliers.bottom;
      // Each auto-spawn tick spawns multiplier count of T1s
      spawnUnits("top", Math.round(topMult), "AUTO", "T1");
      spawnUnits("bottom", Math.round(botMult), "AUTO", "T1");
    }
  }

  // 2. Transition spawning → moving/charging/deploying
  for (const u of state.units) {
    if (u.state === "SPAWNING" && state.elapsed - u.spawnTime >= SPAWN_DURATION) {
      if (u.chargeState === "CHARGING") {
        u.movementState = "CHARGING";
        u.collisionPriority = 10;
      } else if (u.tier === "T5" && !u.deploymentDone) {
        u.movementState = "MOVING";
        u.collisionPriority = T5_DEPLOYMENT_PRIORITY;
      } else {
        u.movementState = "MOVING";
      }
      u.state = "MOVING";
    }
  }

  // 3. Build live unit lists
  const topLive: ArenaUnit[] = [];
  const bottomLive: ArenaUnit[] = [];
  for (const u of state.units) {
    if (u.state === "DEAD" || u.state === "SPAWNING") continue;
    if (u.team === "top") topLive.push(u);
    else bottomLive.push(u);
  }
  const allLive = [...topLive, ...bottomLive];

  // 4. Target validation & acquisition (skip T3 — healers don't attack)
  for (const u of allLive) {
    if (u.tier === "T3") continue;
    if (!validateTarget(u)) {
      acquireTarget(u, u.team === "top" ? bottomLive : topLive);
    }
  }

  // 5. Movement (T3 healers use their own movement logic)
  for (const u of allLive) {
    if (u.state === "DEAD") continue;
    if (u.tier === "T3") continue; // handled in step 5b

    // Charging T4: move forward at charge speed, ignore normal targeting
    if (u.chargeState === "CHARGING") {
      u.chargeTimer += dt;
      if (u.chargeTimer >= u.maxChargeDuration) {
        endCharge(u);
      } else {
        const baseY = getEnemyBaseY(u.team);
        moveToward(u, u.x, baseY, dt, u.chargeSpeed);
        u.movementState = "CHARGING";
        continue;
      }
    }

    // Deploying T5: use deployment speed until reaching frontline area
    if (u.tier === "T5" && !u.deploymentDone) {
      // Check if we've reached near enemies or enemy base — end deployment
      const enemies = u.team === "top" ? bottomLive : topLive;
      let nearEnemy = false;
      for (const e of enemies) {
        if (e.state === "DEAD") continue;
        if (bodyDistance(u, e) <= u.radius + e.radius + 20) {
          nearEnemy = true;
          break;
        }
      }
      const baseY = getEnemyBaseY(u.team);
      const distToBase = bodyDistanceToPoint(u, BASE_X, baseY, BASE_RADIUS);
      if (distToBase <= 20) nearEnemy = true;

      if (nearEnemy) {
        u.deploymentDone = true;
        u.collisionPriority = 0;
      } else {
        moveToward(u, u.x, baseY, dt, u.deploymentSpeed);
        u.movementState = "MOVING";
        continue;
      }
    }

    const hasValidUnitTarget = u.targetId !== null && u.targetId !== 0;
    const hasBaseTarget = u.targetId === 0;

    if (hasValidUnitTarget) {
      const target = findById(u.targetId!);
      if (target && target.state !== "DEAD") {
        const bd = bodyDistance(u, target);
        if (bd <= u.range) {
          u.combatState = "ATTACKING_UNIT";
          if (u.tier === "T1" || u.tier === "T4" || u.tier === "T5") {
            u.state = "FIGHTING";
          }
          continue;
        }
        u.combatState = "IDLE";
        moveToward(u, target.x, target.y, dt);
        if (u.tier === "T1" || u.tier === "T4" || u.tier === "T5") {
          u.state = "MOVING";
        }
        u.movementState = "MOVING";
        continue;
      }
      u.targetId = null;
      u.target = null;
      u.combatState = "IDLE";
    }

    if (hasBaseTarget) {
      const baseY = getEnemyBaseY(u.team);
      const distToBase = bodyDistanceToPoint(u, BASE_X, baseY, BASE_RADIUS);
      if (distToBase <= u.range) {
        u.combatState = "ATTACKING_BASE";
        if (u.tier === "T1" || u.tier === "T4" || u.tier === "T5") {
          u.state = "ATTACKING_BASE";
        }
        continue;
      }
      u.combatState = "IDLE";
      moveToward(u, BASE_X, baseY, dt);
      if (u.tier === "T1" || u.tier === "T4" || u.tier === "T5") {
        u.state = "MOVING";
      }
      u.movementState = "MOVING";
      continue;
    }

    u.combatState = "IDLE";
    const baseY = getEnemyBaseY(u.team);
    moveToward(u, BASE_X, baseY, dt);
    if (u.tier === "T1" || u.tier === "T4" || u.tier === "T5") {
      u.state = "MOVING";
    }
    u.movementState = "MOVING";
  }

  // 5b. Healer updates (targeting, movement, healing)
  for (const u of allLive) {
    if (u.tier !== "T3") continue;
    const allies = u.team === "top" ? topLive : bottomLive;
    updateHealer(u, allies, dt);
  }

  // 6. Resolve unit separation (with friendly yielding for charging T4)
  resolveUnitSeparation(allLive);

  // 7. Charge impact detection
  for (const u of allLive) {
    if (u.state === "DEAD" || u.state === "SPAWNING") continue;
    if (u.chargeState !== "CHARGING" || u.impactConsumed) continue;

    const enemies = u.team === "top" ? bottomLive : topLive;
    let hasEnemyContact = false;

    for (const e of enemies) {
      if (e.state === "DEAD") continue;
      const bd = bodyDistance(u, e);
      if (bd <= 0) {
        hasEnemyContact = true;
        break;
      }
    }

    // Also check if near enemy base
    const baseY = getEnemyBaseY(u.team);
    const distToBase = bodyDistanceToPoint(u, BASE_X, baseY, BASE_RADIUS);
    if (distToBase <= 0) {
      hasEnemyContact = true;
    }

    if (hasEnemyContact) {
      triggerChargeImpact(u, enemies, allLive);
      u.impactConsumed = true;
      endCharge(u);
    }
  }

  // 7b. Boss Heavy Slam lifecycle
  for (const u of allLive) {
    if (u.state === "DEAD" || u.state === "SPAWNING") continue;
    if (u.slamState === "NONE") continue;
    if (!u.deploymentDone) continue;
    if (u.hp <= 0) continue;

    const enemies = u.team === "top" ? bottomLive : topLive;

    if (u.slamState === "READY") {
      // Check initial delay
      u.slamTimer += dt;
      if (u.slamTimer < u.slamInitialDelay) continue;

      // Check if enemies are within slam radius
      const slamTargets = queryEnemiesInArea(u, u.y, u.slamRadius, enemies);
      if (slamTargets.length === 0) continue;

      // Begin windup
      u.slamState = "WINDUP";
      u.slamWindupTimer = u.slamWindup;
    }

    if (u.slamState === "WINDUP") {
      u.slamWindupTimer -= dt;
      if (u.slamWindupTimer <= 0) {
        // Impact
        triggerBossSlam(u, enemies, allLive);
        u.slamState = "COOLDOWN";
        u.slamTimer = 0;
      }
    }

    if (u.slamState === "COOLDOWN") {
      u.slamTimer += dt;
      if (u.slamTimer >= u.slamCooldown) {
        u.slamState = "READY";
        u.slamTimer = 0;
      }
    }
  }

  // 8. Combat damage — continuous DPS, applied simultaneously
  const damageMap = new Map<number, number>();
  const tierDamageToUnits = new Map<string, number>();

  for (const u of allLive) {
    if (u.combatState !== "ATTACKING_UNIT" || u.targetId === null) continue;
    const dmg = u.damage * rageMultiplier(u.team) * dt;
    const prev = damageMap.get(u.targetId) ?? 0;
    damageMap.set(u.targetId, prev + dmg);
    tierDamageToUnits.set(u.tier, (tierDamageToUnits.get(u.tier) ?? 0) + dmg);
  }

  for (const [targetId, dmg] of damageMap) {
    const target = findById(targetId);
    if (target && target.state !== "DEAD") {
      target.hp -= dmg * (1 - shieldReductionForUnit(target));
    }
  }

  // 9. Base damage — structure DPS
  const tierDamageToBase = new Map<string, number>();
  for (const u of allLive) {
    if (u.combatState !== "ATTACKING_BASE") continue;
    const baseDmg = u.structureDps * rageMultiplier(u.team) * dt;
    if (u.team === "top") {
      state.bottomBaseHp = Math.max(0, state.bottomBaseHp - baseDmg * (1 - shieldReductionForBase("bottom")));
    } else {
      state.topBaseHp = Math.max(0, state.topBaseHp - baseDmg * (1 - shieldReductionForBase("top")));
    }
    tierDamageToBase.set(u.tier, (tierDamageToBase.get(u.tier) ?? 0) + baseDmg);
  }

  // Track tier damage
  const acc = state.tierDamageAccumulator;
  for (const [tier, dmg] of tierDamageToUnits) {
    acc.toUnits.set(tier, (acc.toUnits.get(tier) ?? 0) + dmg);
  }
  for (const [tier, dmg] of tierDamageToBase) {
    acc.toBase.set(tier, (acc.toBase.get(tier) ?? 0) + dmg);
  }

  // 10. Process deaths
  for (const u of state.units) {
    if (u.hp <= 0 && u.state !== "DEAD") {
      u.state = "DEAD";
      u.movementState = "DEAD";
      u.combatState = "IDLE";
      u.deathTime = state.elapsed;
      u.targetId = null;
      u.target = null;
      u.chargeState = "NONE";
      u.slamState = "NONE";
      u.healTargetId = null;
      u.healerState = "IDLE";
      // Track boss lifetime on death
      if (u.tier === "T5") {
        const lifetime = state.elapsed - u.spawnTime;
        const m = state.slamMetrics.get("T5") ?? { slams: 0, damage: 0, enemiesHit: 0, enemiesKilled: 0, displacement: 0, totalLifetime: 0, deaths: 0 };
        m.totalLifetime += lifetime;
        m.deaths++;
        state.slamMetrics.set("T5", m);
      }
      // Track healer lifetime on death
      if (u.tier === "T3") {
        const lifetime = state.elapsed - u.spawnTime;
        const hm = state.healMetrics.get("T3") ?? { nominal: 0, actual: 0, poolConsumed: 0, poolWasted: 0, targetsHealed: 0, timeSpent: 0, byTier: new Map(), totalLifetime: 0, deaths: 0 };
        hm.totalLifetime += lifetime;
        hm.deaths++;
        hm.poolWasted += u.healPoolRemaining;
        state.healMetrics.set("T3", hm);
      }
    }
  }

  // 11. Cleanup old dead units
  state.units = state.units.filter(
    (u) =>
      u.state !== "DEAD" ||
      u.deathTime === null ||
      state!.elapsed - u.deathTime < DEAD_CLEANUP_DELAY
  );

  // 12. Visual projectiles — spawn for attacking T2 units
  for (const u of allLive) {
    if (u.tier === "T1" || u.tier === "T4" || u.tier === "T5" || u.tier === "T3") continue;
    if (u.combatState !== "ATTACKING_UNIT" && u.combatState !== "ATTACKING_BASE") continue;
    u.visualFireTimer -= dt;
    if (u.visualFireTimer <= 0) {
      u.visualFireTimer = 0.7 + Math.random() * 0.8;
      let toX: number, toY: number;
      if (u.combatState === "ATTACKING_UNIT" && u.targetId !== null) {
        const target = findById(u.targetId);
        if (target) {
          toX = target.x;
          toY = target.y;
        } else {
          continue;
        }
      } else {
        toX = BASE_X;
        toY = getEnemyBaseY(u.team);
      }
      state.projectiles.push({
        id: state.nextProjectileId++,
        fromX: u.x,
        fromY: u.y,
        toX,
        toY,
        team: u.team,
        tier: u.tier,
        bornAt: state.elapsed,
        ttl: 0.4,
      });
    }
  }

  // Cleanup expired projectiles
  state.projectiles = state.projectiles.filter(
    (p) => state!.elapsed - p.bornAt < p.ttl
  );
  if (state.projectiles.length > 200) {
    state.projectiles = state.projectiles.slice(-200);
  }

  // Cleanup expired impact effects
  state.impactEffects = state.impactEffects.filter(
    (e) => state!.elapsed - e.bornAt < e.ttl
  );

  // Cleanup expired ultimate effects
  state.ultimateEffects = state.ultimateEffects.filter(
    (e) => state!.elapsed - e.bornAt < e.ttl
  );

  // 13. Check win conditions
  if (state.topBaseHp <= 0 && state.bottomBaseHp <= 0) {
    state.isDraw = true;
    state.endReason = "BOTH_BASES_DESTROYED";
    state.winner = null;
  } else if (state.topBaseHp <= 0) {
    state.winner = "bottom";
    state.endReason = "BASE_DESTROYED";
  } else if (state.bottomBaseHp <= 0) {
    state.winner = "top";
    state.endReason = "BASE_DESTROYED";
  } else if (state.durationSeconds > 0 && state.realElapsed >= state.durationSeconds) {
    if (state.topBaseHp === state.bottomBaseHp) {
      state.isDraw = true;
      state.endReason = "TIMER";
    } else {
      state.winner = state.topBaseHp > state.bottomBaseHp ? "top" : "bottom";
      state.endReason = "TIMER";
    }
  }
}

function endCharge(u: ArenaUnit): void {
  u.chargeState = "IMPACT_CONSUMED";
  u.movementState = "MOVING";
  u.collisionPriority = 0;
}

// ─── Snapshot ──────────────────────────────────────────────────────
export function getSnapshot(isPaused: boolean, speed: number): SimulationSnapshot {
  if (!state) {
    const empty = createEmptyMetrics();
    return {
      units: [],
      projectiles: [],
      impactEffects: [],
      ultimateEffects: [],
      topBaseHp: 0,
      bottomBaseHp: 0,
      maxBaseHp: 0,
      metrics: empty,
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

  const topAlive = state.units.filter(
    (u) => u.team === "top" && u.state !== "DEAD"
  );
  const bottomAlive = state.units.filter(
    (u) => u.team === "bottom" && u.state !== "DEAD"
  );
  const topFighting = topAlive.filter(
    (u) => u.combatState === "ATTACKING_UNIT" || u.combatState === "ATTACKING_BASE"
  );
  const bottomFighting = bottomAlive.filter(
    (u) => u.combatState === "ATTACKING_UNIT" || u.combatState === "ATTACKING_BASE"
  );

  const topByTier = buildTierMetrics(state.units, "top", state);
  const bottomByTier = buildTierMetrics(state.units, "bottom", state);

  const metrics: BattleMetrics = {
    topSpawned: state.units.filter((u) => u.team === "top").length,
    topAlive: topAlive.length,
    topFighting: topFighting.length,
    topDied: state.units.filter(
      (u) => u.team === "top" && u.state === "DEAD"
    ).length,
    bottomSpawned: state.units.filter((u) => u.team === "bottom").length,
    bottomAlive: bottomAlive.length,
    bottomFighting: bottomFighting.length,
    bottomDied: state.units.filter(
      (u) => u.team === "bottom" && u.state === "DEAD"
    ).length,
    topBaseDamageDealt: state.maxBaseHp - state.bottomBaseHp,
    bottomBaseDamageDealt: state.maxBaseHp - state.topBaseHp,
    topPending: state.pendingSpawns.filter((p) => p.team === "top").length,
    bottomPending: state.pendingSpawns.filter((p) => p.team === "bottom").length,
    topByTier,
    bottomByTier,
  };

  return {
    units: state.units.map((u) => ({ ...u })),
    projectiles: state.projectiles.map((p) => ({ ...p })),
    impactEffects: state.impactEffects.map((e) => ({ ...e })),
    ultimateEffects: state.ultimateEffects.map((e) => ({ ...e })),
    topBaseHp: state.topBaseHp,
    bottomBaseHp: state.bottomBaseHp,
    maxBaseHp: state.maxBaseHp,
    metrics,
    winner: state.winner,
    isDraw: state.isDraw,
    endReason: state.endReason,
    isRunning: state.winner === null && !state.isDraw,
    isPaused,
    autoSpawnEnabled: state.autoSpawnEnabled,
    elapsedSeconds: state.realElapsed,
    simElapsedSeconds: state.elapsed,
    speed,
  };
}

function buildTierMetrics(units: ArenaUnit[], team: ArenaTeam, st: ArenaState): Record<string, TierMetrics> {
  const result: Record<string, TierMetrics> = {};
  const acc = st.tierDamageAccumulator;
  const chargeM = st.chargeMetrics;
  for (const u of units) {
    if (u.team !== team) continue;
    if (!result[u.tier]) {
      result[u.tier] = {
        spawned: 0, alive: 0, fighting: 0, died: 0,
        damageToUnits: 0, damageToBase: 0,
        chargeImpacts: 0, chargeDamage: 0,
        chargeEnemiesHit: 0, chargeEnemiesKilled: 0,
        displacementApplied: 0,
        slamCount: 0, slamDamage: 0,
        slamEnemiesHit: 0, slamEnemiesKilled: 0,
        slamDisplacement: 0, avgLifetime: 0,
        healNominal: 0, healActual: 0, healPoolConsumed: 0, healPoolWasted: 0,
        healTargetsHealed: 0, healTimeSpent: 0, healByTier: {}, avgHealerLifetime: 0,
      };
    }
    result[u.tier].spawned++;
    if (u.state !== "DEAD") {
      result[u.tier].alive++;
      if (u.combatState === "ATTACKING_UNIT" || u.combatState === "ATTACKING_BASE") {
        result[u.tier].fighting++;
      }
    } else {
      result[u.tier].died++;
    }
  }
  for (const tier of Object.keys(result)) {
    result[tier].damageToUnits = acc.toUnits.get(tier) ?? 0;
    result[tier].damageToBase = acc.toBase.get(tier) ?? 0;
    const cm = chargeM.get(tier);
    if (cm) {
      result[tier].chargeImpacts = cm.impacts;
      result[tier].chargeDamage = cm.damage;
      result[tier].chargeEnemiesHit = cm.enemiesHit;
      result[tier].chargeEnemiesKilled = cm.enemiesKilled;
      result[tier].displacementApplied = cm.displacement;
    }
    const sm = st.slamMetrics.get(tier);
    if (sm) {
      result[tier].slamCount = sm.slams;
      result[tier].slamDamage = sm.damage;
      result[tier].slamEnemiesHit = sm.enemiesHit;
      result[tier].slamEnemiesKilled = sm.enemiesKilled;
      result[tier].slamDisplacement = sm.displacement;
      result[tier].avgLifetime = sm.deaths > 0 ? sm.totalLifetime / sm.deaths : 0;
    }
    const hm = st.healMetrics.get(tier);
    if (hm) {
      result[tier].healNominal = hm.nominal;
      result[tier].healActual = hm.actual;
      result[tier].healPoolConsumed = hm.poolConsumed;
      result[tier].healPoolWasted = hm.poolWasted;
      result[tier].healTargetsHealed = hm.targetsHealed;
      result[tier].healTimeSpent = hm.timeSpent;
      const byTier: Record<string, number> = {};
      for (const [k, v] of hm.byTier) byTier[k] = v;
      result[tier].healByTier = byTier;
      result[tier].avgHealerLifetime = hm.deaths > 0 ? hm.totalLifetime / hm.deaths : 0;
    }
  }
  return result;
}

// ─── Internal Helpers ──────────────────────────────────────────────
function findById(id: number): ArenaUnit | undefined {
  return state?.units.find((u) => u.id === id);
}

function moveToward(
  unit: ArenaUnit,
  tx: number,
  ty: number,
  dt: number,
  speedOverride?: number
): void {
  const dx = tx - unit.x;
  const dy = ty - unit.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const speed = speedOverride ?? unit.speed;
  const step = speed * dt;
  const ratio = Math.min(step / dist, 1);
  unit.x += dx * ratio;
  unit.y += dy * ratio;

  unit.x = Math.max(unit.radius, Math.min(ARENA_WIDTH - unit.radius, unit.x));
  unit.y = Math.max(unit.radius, Math.min(ARENA_HEIGHT - unit.radius, unit.y));
}

function resolveUnitSeparation(liveUnits: ArenaUnit[]): void {
  // Higher-tier units keep their path and push lower-tier allies aside.
  const sorted = [...liveUnits].sort((a, b) => getPassagePriority(b) - getPassagePriority(a));

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (a.state === "DEAD" || b.state === "DEAD") continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sep = getSeparation(a, b);

      if (dist < sep && dist > 0.01) {
        const overlap = sep - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        if (a.team === b.team) {
          // Friendly: stronger units push weaker allies out of their path
          const aPriority = getPassagePriority(a);
          const bPriority = getPassagePriority(b);
          if (aPriority > bPriority) {
            b.x += nx * overlap;
            b.y += ny * overlap;
            b.x = Math.max(b.radius, Math.min(ARENA_WIDTH - b.radius, b.x));
            b.y = Math.max(b.radius, Math.min(ARENA_HEIGHT - b.radius, b.y));
          } else if (bPriority > aPriority) {
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            a.x = Math.max(a.radius, Math.min(ARENA_WIDTH - a.radius, a.x));
            a.y = Math.max(a.radius, Math.min(ARENA_HEIGHT - a.radius, a.y));
          } else {
            // Equal priority: split
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
            a.x = Math.max(a.radius, Math.min(ARENA_WIDTH - a.radius, a.x));
            a.y = Math.max(a.radius, Math.min(ARENA_HEIGHT - a.radius, a.y));
            b.x = Math.max(b.radius, Math.min(ARENA_WIDTH - b.radius, b.x));
            b.y = Math.max(b.radius, Math.min(ARENA_HEIGHT - b.radius, b.y));
          }
        }
        // Enemies: no separation push (they fight in contact)
      }
    }
  }
}

// ─── Team Side conversion exports ──────────────────────────────────
export { teamSideToArena, arenaToTeamSide };
