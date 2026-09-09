import type {
  BattleConfig,
  BattleEndReason,
  BattleSession,
  EngineStatus,
  TeamRuntimeState,
  TeamSide,
} from "@/domain/types";

export function createTeamRuntime(
  side: TeamSide,
  baseHp: number
): TeamRuntimeState {
  return { side, baseHp, maxBaseHp: baseHp };
}

export function createBattleSession(
  config: BattleConfig,
  roundNumber: number,
  loopMode: boolean
): BattleSession {
  const snapshot = structuredClone(config);
  return {
    id: crypto.randomUUID(),
    roundNumber,
    status: "READY",
    config: snapshot,
    startedAt: null,
    endsAt: null,
    endedAt: null,
    loopMode,
    loopSessionId: null,
    teamA: createTeamRuntime("A", snapshot.combat.baseHp),
    teamB: createTeamRuntime("B", snapshot.combat.baseHp),
    winner: null,
    endReason: null,
  };
}

export function startBattle(
  session: BattleSession,
  timestamp: number
): BattleSession {
  return {
    ...session,
    status: "RUNNING",
    startedAt: timestamp,
    endsAt: timestamp + session.config.combat.durationSeconds * 1000,
  };
}

export function endBattle(
  session: BattleSession,
  timestamp: number,
  reason: BattleEndReason
): BattleSession {
  return {
    ...session,
    status: "ENDED",
    endedAt: timestamp,
    endReason: reason,
  };
}

export function resetSession(): null {
  return null;
}

export function getRemainingMs(session: BattleSession, now: number): number {
  if (!session.endsAt || session.status !== "RUNNING") return 0;
  return Math.max(0, session.endsAt - now);
}

export function isBattleExpired(session: BattleSession, now: number): boolean {
  return session.status === "RUNNING" && getRemainingMs(session, now) <= 0;
}

export function getBaseHpPercent(runtime: TeamRuntimeState): number {
  if (runtime.maxBaseHp === 0) return 0;
  return Math.round((runtime.baseHp / runtime.maxBaseHp) * 100);
}

export function getStatusLabel(status: EngineStatus): string {
  const labels: Record<EngineStatus, string> = {
    IDLE: "Offline",
    READY: "Ready",
    RUNNING: "Running",
    PAUSED: "Paused",
    ENDED: "Ended",
  };
  return labels[status];
}
