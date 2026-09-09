import type { ArenaTeam } from "./types";

// ─── Arena Geometry (logical coordinates) ──────────────────────────
// The arena is a vertical rectangle. Y=0 is the top, Y=ARENA_HEIGHT is the bottom.
// X ranges from 0 to ARENA_WIDTH.
export const ARENA_WIDTH = 400;
export const ARENA_HEIGHT = 700;

// ─── Base Positions ────────────────────────────────────────────────
export const BASE_Y_TOP = 40;
export const BASE_Y_BOTTOM = ARENA_HEIGHT - 40;
export const BASE_X = ARENA_WIDTH / 2;
export const BASE_RADIUS = 30;

// ─── Spawn Zones ───────────────────────────────────────────────────
export const SPAWN_Y_TOP = 80;
export const SPAWN_Y_BOTTOM = ARENA_HEIGHT - 80;
export const SPAWN_X_MIN = 40;
export const SPAWN_X_MAX = ARENA_WIDTH - 40;
export const SPAWN_JITTER_Y = 20;

// ─── Base Attack Zone ──────────────────────────────────────────────
export const BASE_ATTACK_RANGE = 40;

// ─── Unit Defaults ─────────────────────────────────────────────────
// Config speeds were designed for a 0–100 battlefield. Scale to arena height.
export const SPEED_SCALE = ARENA_HEIGHT / 100; // 7x
export const DEFAULT_UNIT_SPEED = 60;
export const DEFAULT_UNIT_DAMAGE = 25;
export const DEFAULT_UNIT_RANGE = 30;
export const DEFAULT_ATTACK_COOLDOWN = 1.0;
export const UNIT_RADIUS = 6;
export const UNIT_SEPARATION = 14;
export const T4_RADIUS = 14;
export const T4_SEPARATION = 32;
export const T4_FRONTAGE_COST = 3;
export const T4_KNOCKBACK_RESISTANCE = 0.5;
export const T4_CHARGE_SPEED_MULT = 1.8;
export const T4_IMPACT_RADIUS = 50;
export const T4_KNOCKBACK_DISTANCE = 25;
export const T4_MAX_CHARGE_DURATION = 8;

// ─── T5 Boss Constants ─────────────────────────────────────────────
export const T5_RADIUS = 20;
export const T5_FRONTAGE_COST = 4;
export const T5_KNOCKBACK_RESISTANCE = 0.8;
export const T5_SLAM_DAMAGE = 900;
export const T5_SLAM_RADIUS = 60;
export const T5_SLAM_COOLDOWN = 4;
export const T5_SLAM_KNOCKBACK = 18;
export const T5_SLAM_INITIAL_DELAY = 2;
export const T5_SLAM_WINDUP = 0.5;
export const T5_DEPLOYMENT_SPEED_MULT = 1.3;
export const T5_DEPLOYMENT_PRIORITY = 8;

// ─── T3 Healer Constants ─────────────────────────────────────────────
export const T3_RADIUS = 7;
export const T3_FRONTAGE_COST = 1;
export const T3_KNOCKBACK_RESISTANCE = 0;
export const T3_HP = 650;
export const T3_HEAL_PER_SECOND = 250;
export const T3_HEAL_POOL = 5000;
export const T3_HEALING_RANGE = 70;
export const T3_ACQUISITION_RANGE = 140;
export const T3_SPEED = 0.85;
export const T3_PREFERRED_SUPPORT_DISTANCE = 20;
export const T3_TARGET_SWITCH_THRESHOLD = 0.2;
export const T3_REEVAL_INTERVAL = 0.3;
export const T3_EFFICIENCIES: Record<string, number> = {
  T1: 1.0,
  T2: 1.0,
  T3: 1.0,
  T4: 0.5,
  T5: 0.25,
};

// ─── T6 Ultimate Constants ──────────────────────────────────────────
export const T6_LIGHT_TIER_REMOVAL_RATIO = 0.90;
export const T6_T4_CURRENT_HP_DAMAGE_RATIO = 0.55;
export const T6_T5_MAX_HP_DAMAGE_RATIO = 0.45;
export const T6_BASE_MAX_HP_DAMAGE_RATIO = 0.08;
export const T6_KNOCKBACK_DISTANCE = 40;
export const T6_STUN_DURATION = 0;
export const T6_VISUAL_DURATION = 2.0;

// ─── Spawning ──────────────────────────────────────────────────────
export const SPAWN_DURATION = 0.3;
export const MAX_UNITS_PER_TEAM = 500;

// ─── Timing ────────────────────────────────────────────────────────
export const MAX_DELTA = 0.1;
export const DEAD_CLEANUP_DELAY = 0.5;

// ─── Helpers ───────────────────────────────────────────────────────
export function getForwardDirectionY(team: ArenaTeam): number {
  return team === "top" ? 1 : -1;
}

export function getEnemyTeam(team: ArenaTeam): ArenaTeam {
  return team === "top" ? "bottom" : "top";
}

export function getSpawnY(team: ArenaTeam): number {
  return team === "top" ? SPAWN_Y_TOP : SPAWN_Y_BOTTOM;
}

export function getBaseY(team: ArenaTeam): number {
  return team === "top" ? BASE_Y_TOP : BASE_Y_BOTTOM;
}

export function getEnemyBaseY(team: ArenaTeam): number {
  return team === "top" ? BASE_Y_BOTTOM : BASE_Y_TOP;
}

export function isAtEnemyBase(y: number, team: ArenaTeam): boolean {
  const baseY = getEnemyBaseY(team);
  return Math.abs(y - baseY) < BASE_ATTACK_RANGE;
}
