import type { BattleConfig, TeamSide } from "@/domain/types";
import type { SimulationSnapshot, UnitSource } from "./types";
import { MAX_DELTA } from "./constants";
import {
  initArena,
  resetArena,
  tickArena,
  getSnapshot,
  spawnUnits,
  setAutoSpawn as engineSetAutoSpawn,
  forceBaseDamage as engineForceBaseDamage,
  triggerUltimate as engineTriggerUltimate,
  teamSideToArena,
  getArenaState,
} from "./arenaEngine";

// ─── Callbacks ─────────────────────────────────────────────────────
type SnapshotListener = (snap: SimulationSnapshot) => void;
type BattleEndListener = (
  winner: TeamSide | null,
  reason: string,
  isDraw: boolean
) => void;

let snapshotListener: SnapshotListener | null = null;
let endListener: BattleEndListener | null = null;

// ─── Loop State ────────────────────────────────────────────────────
let rafId: number | null = null;
let lastTimestamp: number | null = null;
let isPaused = false;
let speed = 1;
let endEmitted = false;

// ─── Public API ────────────────────────────────────────────────────
export function onSnapshot(fn: SnapshotListener): void {
  snapshotListener = fn;
}

export function onBattleEnd(fn: BattleEndListener): void {
  endListener = fn;
}

export function startSimulation(config: BattleConfig): void {
  stopSimulation();
  initArena(config);
  isPaused = false;
  endEmitted = false;
  lastTimestamp = null;
  emitSnapshot();
  rafId = requestAnimationFrame(gameLoop);
}

export function stopSimulation(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lastTimestamp = null;
  resetArena();
}

export function pauseSimulation(): void {
  isPaused = true;
  emitSnapshot();
}

export function resumeSimulation(): void {
  isPaused = false;
  lastTimestamp = null;
  emitSnapshot();
}

export function stepSimulation(): void {
  if (!isPaused) return;
  tickArena(1 / 60, 1 / 60);
  checkEnd();
  emitSnapshot();
}

export function setSimulationSpeed(s: number): void {
  speed = Math.max(0.25, Math.min(4, s));
  emitSnapshot();
}

export function manualSpawn(
  team: TeamSide,
  count: number,
  source: UnitSource = "SIMULATION",
  tier: string = "T1"
): void {
  spawnUnits(teamSideToArena(team), count, source, tier);
}

export function setAutoSpawn(enabled: boolean): void {
  engineSetAutoSpawn(enabled);
}

export function forceBaseDamage(team: TeamSide, percent: number): void {
  engineForceBaseDamage(teamSideToArena(team), percent);
}

export function triggerUltimate(team: TeamSide): void {
  engineTriggerUltimate(teamSideToArena(team), "SIMULATION");
}

export function getIsPaused(): boolean {
  return isPaused;
}

export function getSpeed(): number {
  return speed;
}

export function resetSimulation(): void {
  stopSimulation();
}

// ─── Game Loop ─────────────────────────────────────────────────────
function gameLoop(timestamp: number): void {
  if (lastTimestamp === null) {
    lastTimestamp = timestamp;
    rafId = requestAnimationFrame(gameLoop);
    return;
  }

  const rawDt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (!isPaused) {
    const realDt = Math.min(rawDt, MAX_DELTA);
    const dt = Math.min(realDt * speed, MAX_DELTA);
    tickArena(dt, realDt);
    checkEnd();
  }

  emitSnapshot();
  rafId = requestAnimationFrame(gameLoop);
}

function checkEnd(): void {
  if (endEmitted) return;
  const arenaState = getArenaState();
  if (!arenaState) return;

  if (arenaState.winner !== null || arenaState.isDraw) {
    endEmitted = true;
    if (endListener) {
      const winnerSide =
        arenaState.winner !== null
          ? arenaState.winner === "top"
            ? "A"
            : "B"
          : null;
      endListener(
        winnerSide as TeamSide | null,
        arenaState.endReason ?? "UNKNOWN",
        arenaState.isDraw
      );
    }
  }
}

function emitSnapshot(): void {
  if (snapshotListener) {
    snapshotListener(getSnapshot(isPaused, speed));
  }
}
