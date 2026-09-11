import { create } from "zustand";
import type {
  BattleConfig,
  BattleEndReason,
  BattleSession,
  BattleThemeId,
  CompletedRoundSummary,
  EngineEvent,
  EngineStatus,
  LoopConfig,
  LoopRuntimeState,
  LoopSession,
  TeamSide,
} from "@/domain/types";
import type { SimulationSnapshot } from "@/simulation/types";
import { createEmptySnapshot } from "@/simulation/types";
import { createDefaultBattleConfig, DEFAULT_LOOP_INTERMISSION_SECONDS } from "@/data/defaults";
import { getDuel } from "@/data/duels";
import { getCommander } from "@/data/commanders";
import { createBattleSession, startBattle, endBattle } from "@/engine/battleEngine";
import { validateBattleConfig, type ValidationError } from "@/engine/validation";
import { createEvent, appendEvent } from "@/engine/events";
import { saveDraftConfig, loadDraftConfig } from "@/state/persistence";
import { broadcastState, throttledBroadcast, onSyncMessage } from "@/state/sync";
import type { SyncPayload } from "@/state/sync";
import { chestManager } from "@/engine/chestManager";
import { startChestBridge, stopChestBridge } from "@/engine/chestBridge";
import { resolveBackground } from "@/engine/backgroundManager";
import type { ChestEvent, ChestOpenOptions, ChestSnapshot } from "@/engine/chestManager";
import {
  startSimulation,
  stopSimulation,
  resetSimulation,
  onSnapshot,
  onBattleEnd,
  manualSpawn as simManualSpawn,
  setAutoSpawn as simSetAutoSpawn,
  forceBaseDamage as simForceBaseDamage,
  triggerUltimate as simTriggerUltimate,
  pauseSimulation,
  resumeSimulation,
  stepSimulation,
  setSimulationSpeed as simSetSpeed,
  getIsPaused,
} from "@/simulation/simulationManager";

const DEFAULT_LOOP_CONFIG: LoopConfig = {
  intermissionSeconds: DEFAULT_LOOP_INTERMISSION_SECONDS,
  gracefulStop: true,
};

function createIdleLoop(): LoopRuntimeState {
  return {
    phase: "IDLE",
    session: null,
    gracefulStopRequested: false,
    intermissionStartedAt: null,
    nextRoundAt: null,
    nextDuelId: null,
    lastSummary: null,
    completedRounds: [],
    recentDuelIds: [],
  };
}

interface EngineStore {
  draftConfig: BattleConfig;
  engineStatus: EngineStatus;
  session: BattleSession | null;
  roundNumber: number;
  loop: LoopRuntimeState;
  loopConfig: LoopConfig;
  events: EngineEvent[];
  validationErrors: ValidationError[];
  simSnapshot: SimulationSnapshot;
  simPaused: boolean;
  simSpeed: number;
  battleBackgroundUrl: string | null;
  chestSnapshot: ChestSnapshot | null;

  setDraftConfig: (config: Partial<BattleConfig>) => void;
  selectDuel: (duelId: string) => void;
  setNextDuel: (duelId: string) => void;
  selectTheme: (themeId: BattleThemeId) => void;
  setCombatField: (field: keyof BattleConfig["combat"], value: number) => void;
  resetConfigToDefaults: () => void;

  startSingleBattle: () => void;
  startInfiniteLoop: () => void;
  stopLoopAfterRound: () => void;
  abortCurrentBattle: () => void;
  stopBattle: () => void;
  resetEngine: () => void;
  toggleLoopMode: () => void;
  handleBattleEnd: () => void;
  handleSimulationEnd: (winner: TeamSide | null, reason: string, isDraw: boolean) => void;
  loopRestart: () => void;

  manualSpawn: (team: TeamSide, count?: number, tier?: string) => void;
  setAutoSpawn: (enabled: boolean) => void;
  forceBaseDamage: (team: TeamSide, percent: number) => void;
  triggerUltimate: (team: TeamSide) => void;
  togglePause: () => void;
  stepOneTick: () => void;
  setSpeed: (speed: number) => void;
  forceOpenChest: (options: ChestOpenOptions) => void;

  pushEvent: (type: EngineEvent["type"], payload?: Record<string, unknown>) => void;
  clearEvents: () => void;
  applySyncPayload: (payload: SyncPayload) => void;
}

function broadcast(store: Pick<EngineStore, "session" | "engineStatus" | "loop" | "simSnapshot" | "battleBackgroundUrl" | "chestSnapshot">): void {
  broadcastState({
    session: store.session,
    engineStatus: store.engineStatus,
    loop: store.loop,
    simSnapshot: store.simSnapshot,
    battleBackgroundUrl: store.battleBackgroundUrl,
    chestSnapshot: store.chestSnapshot,
  });
}

export const useEngineStore = create<EngineStore>((set, get) => {
  let transitionTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTransition = (): void => {
    if (transitionTimer !== null) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
  };

  const finishLoop = (reason: "USER_REQUEST" | "ENGINE_RESET" | "ERROR"): void => {
    clearTransition();
    const current = get().loop;
    const endedAt = Date.now();
    set({
      loop: {
        ...current,
        phase: "IDLE",
        session: current.session ? { ...current.session, endedAt } : null,
        gracefulStopRequested: false,
        intermissionStartedAt: null,
        nextRoundAt: null,
      },
    });
    get().pushEvent("LOOP_STOPPED", { reason });
    broadcast(get());
  };

  const startRound = (loopSession: LoopSession | null, roundNumber: number): void => {
    const { draftConfig, loop } = get();
    const selectedDuel = loop.nextDuelId ? getDuel(loop.nextDuelId) : undefined;
    const draftForRound = selectedDuel
      ? {
          ...draftConfig,
          duelId: selectedDuel.id,
          teamA: { ...draftConfig.teamA, commanderId: selectedDuel.commanderAId, displayName: getCommander(selectedDuel.commanderAId)?.displayName ?? selectedDuel.commanderAId },
          teamB: { ...draftConfig.teamB, commanderId: selectedDuel.commanderBId, displayName: getCommander(selectedDuel.commanderBId)?.displayName ?? selectedDuel.commanderBId },
        }
      : draftConfig;
    const errors = validateBattleConfig(draftForRound);
    if (errors.length > 0) {
      set({ validationErrors: errors, loop: { ...get().loop, phase: "ERROR" } });
      get().pushEvent("ENGINE_ERROR", { reason: "INVALID_NEXT_CONFIG", errors: errors.map((e) => e.message) });
      finishLoop("ERROR");
      return;
    }

    const session = startBattle(
      {
        ...createBattleSession(draftForRound, roundNumber, loopSession !== null),
        loopSessionId: loopSession?.id ?? null,
      },
      Date.now()
    );

    set({
      session,
      engineStatus: "RUNNING",
      roundNumber,
      validationErrors: [],
      loop: {
        ...get().loop,
        phase: "BATTLE",
        session: loopSession,
        nextDuelId: null,
        intermissionStartedAt: null,
        nextRoundAt: null,
        recentDuelIds: [session.config.duelId, ...get().loop.recentDuelIds.filter((id) => id !== session.config.duelId)].slice(0, 3),
      },
      simPaused: false,
      simSnapshot: createEmptySnapshot(),
    });

    startSimulation(session.config);
    chestManager.init(session.config.chest);
    set({ chestSnapshot: chestManager.getSnapshot() });
    resolveBackground(session.config.battleThemeId).then((url) => {
      if (get().session?.id === session.id) {
        set({ battleBackgroundUrl: url });
        broadcast(get());
      }
    });
    startChestBridge((evt: ChestEvent) => {
      get().pushEvent(evt.type as EngineEvent["type"], evt.payload);
      set({ chestSnapshot: chestManager.getSnapshot() });
      throttledBroadcast({
        session: get().session,
        engineStatus: get().engineStatus,
        loop: get().loop,
        simSnapshot: get().simSnapshot,
        battleBackgroundUrl: get().battleBackgroundUrl,
        chestSnapshot: get().chestSnapshot,
      });
    });
    broadcast(get());
    get().pushEvent("BATTLE_STARTED", { battleId: session.id, round: roundNumber });
    if (loopSession) {
      get().pushEvent("ROUND_STARTED", { battleId: session.id, round: roundNumber });
    }
  };

  const scheduleNextRound = (): void => {
    clearTransition();
    const endsAt = Date.now() + get().loopConfig.intermissionSeconds * 1000;
    set({
      loop: {
        ...get().loop,
        phase: "INTERMISSION",
        intermissionStartedAt: Date.now(),
        nextRoundAt: endsAt,
      },
    });
    get().pushEvent("INTERMISSION_STARTED", { round: get().roundNumber, nextRoundAt: endsAt });
    broadcast(get());

    transitionTimer = setTimeout(() => {
      transitionTimer = null;
      const { loop } = get();
      if (loop.phase !== "INTERMISSION" || loop.gracefulStopRequested || !loop.session) return;
      get().pushEvent("INTERMISSION_ENDED", { nextRound: get().roundNumber + 1 });
      set({ loop: { ...loop, phase: "PREPARING", intermissionStartedAt: null, nextRoundAt: null } });
      get().pushEvent("ROUND_PREPARING", { round: get().roundNumber + 1 });
      broadcast(get());
      startRound(loop.session, get().roundNumber + 1);
    }, get().loopConfig.intermissionSeconds * 1000);
  };

  const scheduleNextRoundAfterResult = (): void => {
    clearTransition();
    transitionTimer = setTimeout(() => {
      transitionTimer = null;
      const { loop } = get();
      if (loop.phase !== "RESULT" || !loop.session || loop.gracefulStopRequested) return;
      scheduleNextRound();
    }, 4000);
  };

  onSnapshot((snapshot) => {
    set({ simSnapshot: snapshot });
    const { session } = get();
    if (session && session.status === "RUNNING") {
      set({
        session: {
          ...session,
          teamA: { ...session.teamA, baseHp: snapshot.topBaseHp },
          teamB: { ...session.teamB, baseHp: snapshot.bottomBaseHp },
        },
      });
    }
    throttledBroadcast({
      session: get().session,
      engineStatus: get().engineStatus,
      loop: get().loop,
      simSnapshot: snapshot,
      battleBackgroundUrl: get().battleBackgroundUrl,
      chestSnapshot: get().chestSnapshot,
    });
  });

  onBattleEnd((winner, reason, isDraw) => get().handleSimulationEnd(winner, reason, isDraw));

  onSyncMessage((payload: SyncPayload) => {
    if (payload.type === "REQUEST_SYNC") {
      broadcast(get());
    } else {
      get().applySyncPayload(payload);
    }
  });

  return {
    draftConfig: loadDraftConfig(),
    engineStatus: "IDLE",
    session: null,
    roundNumber: 0,
    loop: createIdleLoop(),
    loopConfig: DEFAULT_LOOP_CONFIG,
    events: [],
    validationErrors: [],
    simSnapshot: createEmptySnapshot(),
    simPaused: false,
    simSpeed: 1,
    battleBackgroundUrl: null,
    chestSnapshot: null,

    setDraftConfig: (partial) => {
      set((s) => {
        const config = { ...s.draftConfig, ...partial };
        saveDraftConfig(config);
        return { draftConfig: config };
      });
      get().pushEvent("CONFIG_UPDATED");
    },

    selectDuel: (duelId) => {
      const duel = getDuel(duelId);
      if (!duel) return;
      const cmdA = getCommander(duel.commanderAId);
      const cmdB = getCommander(duel.commanderBId);
      set((s) => {
        const config: BattleConfig = {
          ...s.draftConfig,
          duelId,
          teamA: { ...s.draftConfig.teamA, commanderId: duel.commanderAId, displayName: cmdA?.displayName ?? duel.commanderAId },
          teamB: { ...s.draftConfig.teamB, commanderId: duel.commanderBId, displayName: cmdB?.displayName ?? duel.commanderBId },
        };
        saveDraftConfig(config);
        return { draftConfig: config };
      });
      get().pushEvent("CONFIG_UPDATED");
    },

    setNextDuel: (duelId) => {
      if (!getDuel(duelId)) return;
      set((s) => ({ loop: { ...s.loop, nextDuelId: duelId } }));
      broadcast(get());
    },

    selectTheme: (battleThemeId) => {
      set((s) => {
        const config = { ...s.draftConfig, battleThemeId };
        saveDraftConfig(config);
        return { draftConfig: config };
      });
      get().pushEvent("CONFIG_UPDATED");
    },

    setCombatField: (field, value) => {
      set((s) => {
        const config = { ...s.draftConfig, combat: { ...s.draftConfig.combat, [field]: value } };
        saveDraftConfig(config);
        return { draftConfig: config };
      });
    },

    resetConfigToDefaults: () => {
      const config = createDefaultBattleConfig();
      saveDraftConfig(config);
      set({ draftConfig: config, validationErrors: [] });
      get().pushEvent("CONFIG_UPDATED", { reason: "reset_to_defaults" });
    },

    startSingleBattle: () => {
      const { engineStatus } = get();
      if (engineStatus === "RUNNING" || get().loop.phase !== "IDLE") return;
      clearTransition();
      set({ loop: createIdleLoop(), roundNumber: 0 });
      startRound(null, 1);
    },

    startInfiniteLoop: () => {
      const { engineStatus, loop, session } = get();
      if (engineStatus === "RUNNING" || loop.phase !== "IDLE") return;
      const errors = validateBattleConfig(get().draftConfig);
      if (errors.length > 0) {
        set({ validationErrors: errors });
        get().pushEvent("VALIDATION_ERROR", { errors: errors.map((e) => e.message) });
        return;
      }
      clearTransition();
      const loopSession: LoopSession = {
        id: crypto.randomUUID(),
        startedAt: Date.now(),
        endedAt: null,
        startingRoundNumber: session ? session.roundNumber + 1 : 1,
        roundsCompleted: 0,
        teamAWins: 0,
        teamBWins: 0,
        draws: 0,
      };
      set({
        roundNumber: session?.roundNumber ?? 0,
        validationErrors: [],
        loop: { ...createIdleLoop(), phase: "RESULT", session: loopSession },
      });
      get().pushEvent("LOOP_STARTED", { loopSessionId: loopSession.id });
      if (session && engineStatus === "ENDED") {
        scheduleNextRoundAfterResult();
        return;
      }
      get().pushEvent("ROUND_PREPARING", { round: 1 });
      startRound(loopSession, 1);
    },

    stopLoopAfterRound: () => {
      const { loop } = get();
      if (!loop.session || loop.phase === "IDLE") return;
      if (loop.phase === "INTERMISSION" || loop.phase === "PREPARING") {
        finishLoop("USER_REQUEST");
        return;
      }
      if (loop.phase === "BATTLE") {
        set({ loop: { ...loop, phase: "STOPPING", gracefulStopRequested: true } });
        get().pushEvent("LOOP_STOP_REQUESTED", { round: get().roundNumber });
        broadcast(get());
      }
    },

    abortCurrentBattle: () => {
      const { session, loop } = get();
      if (!session || session.status !== "RUNNING") {
        if (loop.session) finishLoop("USER_REQUEST");
        return;
      }
      clearTransition();
      stopSimulation();
      stopChestBridge();
      chestManager.reset();
      const ended = endBattle(session, Date.now(), "ABORT");
      set({ session: ended, engineStatus: "ENDED", simSnapshot: createEmptySnapshot(), battleBackgroundUrl: null, chestSnapshot: null });
      get().pushEvent("BATTLE_ENDED", { battleId: session.id, reason: "ABORT" });
      if (loop.session) finishLoop("USER_REQUEST");
      else broadcast(get());
    },

    stopBattle: () => {
      if (get().loop.session) {
        get().stopLoopAfterRound();
        return;
      }
      get().abortCurrentBattle();
    },

    resetEngine: () => {
      clearTransition();
      resetSimulation();
      stopChestBridge();
      chestManager.reset();
      set({ session: null, engineStatus: "IDLE", roundNumber: 0, loop: createIdleLoop(), validationErrors: [], simSnapshot: createEmptySnapshot(), simPaused: false, battleBackgroundUrl: null, chestSnapshot: null });
      broadcast(get());
      get().pushEvent("ENGINE_RESET");
    },

    toggleLoopMode: () => {
      if (get().loop.phase === "IDLE") get().startInfiniteLoop();
      else get().stopLoopAfterRound();
    },

    handleBattleEnd: () => {},

    handleSimulationEnd: (winner, reason, isDraw) => {
      const { session, loop, simSnapshot } = get();
      if (!session || session.status !== "RUNNING") return;
      stopSimulation();
      stopChestBridge();
      chestManager.reset();
      const endReason = (reason === "BASE_DESTROYED" || reason === "TIMER" || reason === "MANUAL_STOP" || reason === "ABORT" || reason === "RESET" ? reason : "TIMER") as BattleEndReason;
      const ended = endBattle(session, Date.now(), endReason);
      const endedWithResult = { ...ended, winner, teamA: { ...ended.teamA, baseHp: simSnapshot.topBaseHp }, teamB: { ...ended.teamB, baseHp: simSnapshot.bottomBaseHp } };
      const endedAt = ended.endedAt ?? Date.now();
      const summary: CompletedRoundSummary = {
        battleId: session.id,
        loopSessionId: loop.session?.id ?? null,
        roundNumber: session.roundNumber,
        winner,
        endReason,
        startedAt: session.startedAt ?? endedAt,
        endedAt,
        baseHpA: simSnapshot.topBaseHp,
        baseHpB: simSnapshot.bottomBaseHp,
        duelId: session.config.duelId,
        battleThemeId: session.config.battleThemeId,
      };
      const completed = loop.session ? [...loop.completedRounds, summary].slice(-500) : loop.completedRounds;
      const updatedLoopSession = loop.session ? {
        ...loop.session,
        roundsCompleted: loop.session.roundsCompleted + 1,
        teamAWins: loop.session.teamAWins + (winner === "A" ? 1 : 0),
        teamBWins: loop.session.teamBWins + (winner === "B" ? 1 : 0),
        draws: loop.session.draws + (isDraw || winner === null ? 1 : 0),
      } : null;
      set({
        session: endedWithResult,
        engineStatus: "ENDED",
        simSnapshot: { ...simSnapshot, isRunning: false },
        chestSnapshot: null,
        loop: { ...loop, session: updatedLoopSession, lastSummary: summary, completedRounds: completed, phase: loop.session ? "RESULT" : "IDLE" },
      });
      get().pushEvent("BATTLE_ENDED", { battleId: session.id, round: session.roundNumber, reason: endReason, winner, isDraw });
      if (loop.session && !loop.gracefulStopRequested && loop.phase !== "STOPPING") scheduleNextRoundAfterResult();
      else if (loop.session) finishLoop("USER_REQUEST");
      else broadcast(get());
    },

    loopRestart: () => {
      const { loop } = get();
      if (loop.phase === "INTERMISSION" && loop.nextRoundAt && Date.now() >= loop.nextRoundAt && loop.session) {
        set({ loop: { ...loop, phase: "PREPARING" } });
        startRound(loop.session, get().roundNumber + 1);
      }
    },

    manualSpawn: (team: TeamSide, count?: number, tier?: string) => simManualSpawn(team, count ?? 1, "SIMULATION", tier ?? "T1"),
    setAutoSpawn: (enabled) => simSetAutoSpawn(enabled),
    forceBaseDamage: (team, percent) => simForceBaseDamage(team, percent),
    triggerUltimate: (team) => simTriggerUltimate(team),
    togglePause: () => {
      if (getIsPaused()) {
        resumeSimulation();
        set({ simPaused: false });
      } else {
        pauseSimulation();
        set({ simPaused: true });
      }
    },
    stepOneTick: () => stepSimulation(),
    setSpeed: (speed) => {
      simSetSpeed(speed);
      set({ simSpeed: speed });
    },
    forceOpenChest: (options) => {
      chestManager.forceOpenWithReward({ ...options, source: "ADMIN" });
      set({ chestSnapshot: chestManager.getSnapshot() });
    },
    pushEvent: (type, payload) => {
      const { session, loop } = get();
      const event = createEvent(type, session?.id, payload, loop.session?.id);
      set((s) => ({ events: appendEvent(s.events, event) }));
    },
    clearEvents: () => set({ events: [] }),
    applySyncPayload: (payload) => {
      const safeLoop = payload.loop ?? createIdleLoop();
      set({ session: payload.session, engineStatus: payload.engineStatus, loop: safeLoop, ...(payload.simSnapshot ? { simSnapshot: payload.simSnapshot } : {}), ...(payload.battleBackgroundUrl !== undefined ? { battleBackgroundUrl: payload.battleBackgroundUrl } : {}), ...(payload.chestSnapshot !== undefined ? { chestSnapshot: payload.chestSnapshot } : {}) });
    },
  };
});
