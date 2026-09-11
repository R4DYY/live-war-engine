import { useState, useEffect } from "react";
import { useEngineStore } from "@/state/engineStore";
import { useLiveStore } from "@/live/useLiveStore";
import { useCountdown, formatTime } from "@/hooks/useCountdown";
import { getStatusLabel } from "@/engine/battleEngine";
import { BATTLE_THEMES, BATTLE_THEME_IDS } from "@/data/themes";
import { DUELS } from "@/data/duels";
import type { BattleThemeId } from "@/domain/types";
import { chestManager } from "@/engine/chestManager";
import type { ChestRewardChoice, ChestVisualState } from "@/engine/chestManager";
import { Panel, PanelHeader, StatRow, Metric, AlertPill, ConfirmButton } from "@/features/control-room/ui";
import {
  Play, Pause, Square, Ban, RotateCcw, Repeat, Gift,
  Trophy, Wifi, WifiOff, Activity, ChevronDown, ChevronRight,
  Swords, Zap, CheckCircle2, Settings2, Radio,
} from "lucide-react";

const REWARD_OPTIONS: Array<{ value: ChestRewardChoice; label: string }> = [
  { value: "BASE_REPAIR", label: "HEAL" },
  { value: "SPAWN_MULTIPLIER", label: "MEGA ARMY" },
  { value: "GIANT", label: "GIANT TROOP" },
  { value: "SHIELD", label: "WAR SHIELD" },
  { value: "RAGE", label: "RAGE MODE" },
];

const EVENT_FILTERS = ["ALL", "BATTLE", "GIFTS", "LIKES", "CHEST", "COMMENTS", "SYSTEM", "ERRORS"] as const;
type EventFilter = (typeof EVENT_FILTERS)[number];

function categorizeEvent(type: string): EventFilter {
  if (type.includes("ERROR")) return "ERRORS";
  if (type.includes("CHEST")) return "CHEST";
  if (type.includes("GIFT") || type.includes("SPAWN")) return "GIFTS";
  if (type.includes("LIKE")) return "LIKES";
  if (type.includes("COMMENT")) return "COMMENTS";
  if (type.includes("START") || type.includes("END") || type.includes("ROUND") || type.includes("BATTLE")) return "BATTLE";
  return "SYSTEM";
}

function humanizeEvent(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LiveOpsTab() {
  const engineStatus = useEngineStore((s) => s.engineStatus);
  const phase = useEngineStore((s) => s.loop.phase);
  const session = useEngineStore((s) => s.session);
  const roundNumber = useEngineStore((s) => s.roundNumber);
  const loop = useEngineStore((s) => s.loop);
  const draftConfig = useEngineStore((s) => s.draftConfig);
  const simSnapshot = useEngineStore((s) => s.simSnapshot);
  const validationErrors = useEngineStore((s) => s.validationErrors);
  const events = useEngineStore((s) => s.events);

  const startSingleBattle = useEngineStore((s) => s.startSingleBattle);
  const startInfiniteLoop = useEngineStore((s) => s.startInfiniteLoop);
  const stopLoopAfterRound = useEngineStore((s) => s.stopLoopAfterRound);
  const abortCurrentBattle = useEngineStore((s) => s.abortCurrentBattle);
  const resetEngine = useEngineStore((s) => s.resetEngine);
  const togglePause = useEngineStore((s) => s.togglePause);
  const simPaused = useEngineStore((s) => s.simPaused);
  const selectDuel = useEngineStore((s) => s.selectDuel);
  const selectTheme = useEngineStore((s) => s.selectTheme);
  const setCombatField = useEngineStore((s) => s.setCombatField);
  const forceOpenChest = useEngineStore((s) => s.forceOpenChest);
  const manualSpawn = useEngineStore((s) => s.manualSpawn);
  const triggerUltimate = useEngineStore((s) => s.triggerUltimate);
  const simSpeed = useEngineStore((s) => s.simSpeed);
  const setSpeed = useEngineStore((s) => s.setSpeed);

  const live = useLiveStore();
  const { remainingMs, intermissionMs, isInIntermission } = useCountdown();

  const [eventFilter, setEventFilter] = useState<EventFilter>("ALL");
  const [chestCycle, setChestCycle] = useState(chestManager.getCycle());
  const [chestState, setChestState] = useState<ChestVisualState>(chestManager.getVisualState());
  const [chestReward, setChestReward] = useState<ChestRewardChoice>("SPAWN_MULTIPLIER");
  const [chestRecipient, setChestRecipient] = useState<"AUTO" | "A" | "B">("AUTO");
  const [quickTeam, setQuickTeam] = useState<"A" | "B">("A");
  const [quickTier, setQuickTier] = useState<string>("T1");
  const [quickQty, setQuickQty] = useState(1);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showManualChest, setShowManualChest] = useState(false);

  useEffect(() => {
    const update = () => {
      setChestCycle(chestManager.getCycle());
      setChestState(chestManager.getVisualState());
    };
    const unsub = chestManager.subscribe(() => update());
    const timer = setInterval(update, 500);
    return () => { unsub(); clearInterval(timer); };
  }, []);

  const isActive = phase !== "IDLE";
  const isRunning = engineStatus === "RUNNING";
  const isEnded = engineStatus === "ENDED";
  const canStart = !isActive && !isRunning;
  const activeConfig = session?.config;
  const chestConfig = chestManager.getConfig();
  const autoSpawn = simSnapshot.autoSpawnEnabled;

  const statusColor = isRunning ? "var(--accent)" : isEnded ? "var(--warning)" : "var(--text-muted)";
  const liveStatus = live.status;
  const liveColor = liveStatus === "CONNECTED" ? "var(--accent)" : liveStatus === "RECONNECTING" ? "var(--warning)" : liveStatus === "ERROR" ? "var(--danger)" : "var(--text-muted)";

  // System health alerts
  const alerts: Array<{ severity: "INFO" | "WARNING" | "CRITICAL"; message: string }> = [];
  if (liveStatus === "ERROR" || liveStatus === "DISCONNECTED") {
    alerts.push({ severity: "CRITICAL", message: liveStatus === "ERROR" ? "Live source error" : "Live source disconnected" });
  }
  if (simPaused && isRunning) {
    alerts.push({ severity: "WARNING", message: "Engine paused" });
  }
  if (validationErrors.length > 0) {
    alerts.push({ severity: "WARNING", message: `${validationErrors.length} validation error(s)` });
  }
  if (chestState === "REWARD_ACTIVE" && chestCycle?.rewardEffects.length) {
    alerts.push({ severity: "INFO", message: `Chest reward active: ${chestCycle.rewardEffects.length} effect(s)` });
  }
  const allHealthy = alerts.length === 0;

  // Filtered events
  const filteredEvents = [...events].reverse().filter((e) => eventFilter === "ALL" || categorizeEvent(e.type) === eventFilter).slice(0, 20);

  // Win streak
  const winStreak = loop.session
    ? loop.session.teamAWins > loop.session.teamBWins
      ? `A ×${loop.session.teamAWins}`
      : loop.session.teamBWins > loop.session.teamAWins
      ? `B ×${loop.session.teamBWins}`
      : "Tied"
    : "—";

  const openChest = () => {
    forceOpenChest({
      rewardType: chestReward,
      multiplier: chestReward === "SPAWN_MULTIPLIER" ? 2 : undefined,
      team: chestRecipient,
    });
  };

  return (
    <div className="grid grid-cols-12 gap-4 max-w-[1600px]">
      {/* ── LEFT COLUMN: Setup + Battle Control ── */}
      <div className="col-span-12 lg:col-span-3 space-y-4">
        {/* LIVE SETUP */}
        <Panel>
          <PanelHeader icon={<Settings2 size={13} />} title="Live Setup" />
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-1">Session Mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={startSingleBattle}
                  disabled={!canStart}
                  className={`px-2 py-1.5 rounded text-[11px] font-bold border transition-all disabled:opacity-40 ${
                    !loop.session ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={startInfiniteLoop}
                  disabled={!canStart}
                  className={`px-2 py-1.5 rounded text-[11px] font-bold border transition-all disabled:opacity-40 ${
                    loop.session ? "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"
                  }`}
                >
                  Auto Loop
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-1">Duel</label>
              <select value={draftConfig.duelId} onChange={(e) => selectDuel(e.target.value)} disabled={isActive} className="input-field">
                {DUELS.filter((d) => d.enabled).map((d) => (
                  <option key={d.id} value={d.id}>{d.displayName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-1">Theme</label>
              <select value={draftConfig.battleThemeId} onChange={(e) => selectTheme(e.target.value as BattleThemeId)} disabled={isActive} className="input-field">
                {BATTLE_THEME_IDS.map((id) => (
                  <option key={id} value={id}>{BATTLE_THEMES[id].displayName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-1">Base HP</label>
                <input type="number" value={draftConfig.combat.baseHp} onChange={(e) => setCombatField("baseHp", Math.max(1, Number(e.target.value) || 1))} disabled={isActive} className="input-field" min={1} />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-1">Duration</label>
                <input type="number" value={draftConfig.combat.durationSeconds} onChange={(e) => setCombatField("durationSeconds", Math.max(1, Number(e.target.value) || 1))} disabled={isActive} className="input-field" min={1} />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-1">Spawn</label>
                <input type="number" value={draftConfig.combat.autoSpawnIntervalSeconds} onChange={(e) => setCombatField("autoSpawnIntervalSeconds", Math.max(0.1, Number(e.target.value) || 0.1))} disabled={isActive} className="input-field" min={0.1} step={0.1} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] mb-1">Game Speed</label>
              <div className="grid grid-cols-5 gap-1">
                {[0.5, 1, 1.5, 2, 3].map((s) => (
                  <button key={s} onClick={() => setSpeed(s)} className={`px-1 py-1.5 rounded text-[10px] font-bold border transition-all ${simSpeed === s ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-secondary)]"}`}>{s}x</button>
                ))}
              </div>
            </div>

            {activeConfig && (activeConfig.duelId !== draftConfig.duelId || activeConfig.battleThemeId !== draftConfig.battleThemeId) && (
              <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--warning)]/30 p-2">
                <p className="text-[10px] font-semibold text-[var(--warning)] uppercase">Next Battle Config</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Changes apply when the next battle starts.</p>
              </div>
            )}
            {activeConfig && (
              <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2">
                <p className="text-[10px] font-semibold text-[var(--accent)] uppercase">Current Battle</p>
                <p className="text-xs mt-0.5">{activeConfig.teamA.displayName} vs {activeConfig.teamB.displayName}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{BATTLE_THEMES[activeConfig.battleThemeId]?.displayName}</p>
              </div>
            )}
          </div>
        </Panel>

        {/* BATTLE CONTROL */}
        <Panel>
          <PanelHeader icon={<Swords size={13} />} title="Battle Control" badge={getStatusLabel(engineStatus)} badgeColor={statusColor} />
          <div className="space-y-2">
            {canStart && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={startSingleBattle} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-[var(--accent)] text-black hover:brightness-110 transition-all">
                  <Play size={13} /> Start Battle
                </button>
                <button onClick={startInfiniteLoop} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-[var(--warning)] text-black hover:brightness-110 transition-all">
                  <Repeat size={13} /> Start Loop
                </button>
              </div>
            )}

            {isRunning && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={togglePause} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">
                  {simPaused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
                </button>
                <button onClick={abortCurrentBattle} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/25 transition-all">
                  <Ban size={12} /> Abort
                </button>
              </div>
            )}

            {isActive && (
              <button onClick={stopLoopAfterRound} disabled={phase === "STOPPING"} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/30 hover:bg-[var(--warning)]/25 transition-all disabled:opacity-40">
                <Square size={12} /> {phase === "STOPPING" ? "Stopping..." : "Stop After Round"}
              </button>
            )}

            <ConfirmButton
              onConfirm={resetEngine}
              confirmLabel="Confirm Reset?"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--danger)]/40 hover:text-[var(--danger)]"
            >
              <RotateCcw size={12} /> Reset Engine
            </ConfirmButton>

            {isRunning && (
              <div className="text-center py-1">
                <span className="text-2xl font-mono font-bold tabular-nums">{formatTime(remainingMs)}</span>
              </div>
            )}
            {isInIntermission && (
              <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--warning)]/30 p-2 text-center">
                <p className="text-[10px] text-[var(--text-muted)] uppercase">Next battle in</p>
                <p className="text-lg font-mono font-bold text-[var(--warning)]">{formatTime(intermissionMs)}</p>
              </div>
            )}
          </div>
        </Panel>

        {/* QUICK ACTIONS */}
        <Panel>
          <button onClick={() => setShowQuickActions(!showQuickActions)} className="flex items-center gap-1.5 w-full text-left">
            {showQuickActions ? <ChevronDown size={12} className="text-[var(--text-muted)]" /> : <ChevronRight size={12} className="text-[var(--text-muted)]" />}
            <Zap size={13} className="text-[var(--warning)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Quick Actions</span>
          </button>
          {showQuickActions && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Team</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["A", "B"] as const).map((t) => (
                    <button key={t} onClick={() => setQuickTeam(t)} className={`px-2 py-1.5 rounded text-[11px] font-bold border transition-all ${quickTeam === t ? (t === "A" ? "bg-red-900/40 text-red-400 border-red-700/40" : "bg-blue-900/40 text-blue-400 border-blue-700/40") : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>Team {t}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Tier</p>
                <div className="grid grid-cols-6 gap-1">
                  {["T1", "T2", "T3", "T4", "T5", "T6"].map((t) => (
                    <button key={t} onClick={() => setQuickTier(t)} className={`px-1 py-1 rounded text-[10px] font-bold border transition-all ${quickTier === t ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Quantity</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 5, 10].map((n) => (
                    <button key={n} onClick={() => setQuickQty(n)} className={`px-2 py-1.5 rounded text-[11px] font-bold border transition-all ${quickQty === n ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>x{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => quickTier === "T6" ? triggerUltimate(quickTeam) : manualSpawn(quickTeam, quickQty, quickTier as "T1" | "T2" | "T3" | "T4" | "T5")} disabled={!isRunning} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[var(--accent)] text-black hover:brightness-110 transition-all disabled:opacity-40">
                <Swords size={12} /> Trigger
              </button>
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[var(--border)]">
                <button onClick={() => live.sendLike(100)} className="px-2 py-1.5 rounded text-[11px] font-medium bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">+100 Likes</button>
                <button onClick={() => live.sendLike(1000)} className="px-2 py-1.5 rounded text-[11px] font-medium bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">+1K Likes</button>
                <button onClick={() => live.sendChestContribution("A", 1)} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/30 text-amber-400 border border-amber-800/20 hover:bg-amber-950/50 transition-all">Chest A +1</button>
                <button onClick={() => live.sendChestContribution("B", 1)} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/30 text-amber-400 border border-amber-800/20 hover:bg-amber-950/50 transition-all">Chest B +1</button>
              </div>
              <button onClick={() => live.forceUnlockChest()} disabled={!isRunning} className="w-full px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/40 text-amber-400 border border-amber-800/30 hover:bg-amber-950/60 transition-all disabled:opacity-40">Force Unlock Chest</button>
            </div>
          )}
        </Panel>
      </div>

      {/* ── CENTER COLUMN: Status + Engagement + Chest ── */}
      <div className="col-span-12 lg:col-span-5 space-y-4">
        {/* SYSTEM HEALTH */}
        <Panel>
          <PanelHeader icon={<Activity size={13} />} title="System Health" badge={allHealthy ? "HEALTHY" : `${alerts.length} ALERT${alerts.length > 1 ? "S" : ""}`} badgeColor={allHealthy ? "var(--accent)" : "var(--warning)"} />
          {allHealthy ? (
            <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
              <CheckCircle2 size={14} />
              All systems healthy
            </div>
          ) : (
            <div className="space-y-1.5">
              {alerts.map((a, i) => <AlertPill key={i} severity={a.severity} message={a.message} />)}
            </div>
          )}
        </Panel>

        {/* TIKTOK / LIVE SOURCE */}
        <Panel>
          <PanelHeader icon={<Radio size={13} />} title="Live Source" badge={liveStatus} badgeColor={liveColor} />
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {(["SIMULATOR", "TIKTOK"] as const).map((source) => (
                <button key={source} onClick={() => live.setSource(source)} className={`rounded border px-2 py-1.5 text-[10px] font-bold tracking-wide transition-all ${live.source === source ? "border-[var(--accent)]/50 bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)]"}`}>
                  {source}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2">
              <div className="flex items-center gap-2">
                {liveStatus === "CONNECTED" ? <Wifi size={14} className="text-[var(--accent)]" /> : <WifiOff size={14} className="text-[var(--text-muted)]" />}
                <span className="text-xs font-medium text-[var(--text-secondary)]">{live.source === "TIKTOK" ? `TikTok @${live.tiktok.username ?? "—"}` : "Simulator Adapter"}</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{liveStatus}</span>
            </div>

            {live.source === "TIKTOK" && (
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
                <input value={live.username} onChange={(e) => live.setUsername(e.target.value)} placeholder="TikTok username" className="input-field" />
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => live.connectTikTok(live.username)} className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-2 py-1.5 text-[10px] font-bold text-[var(--accent)]">CONNECT</button>
                  <button onClick={live.disconnectTikTok} className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-[10px] font-bold text-[var(--text-muted)]">DISCONNECT</button>
                  <button onClick={live.reconnectTikTok} className="rounded border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-1.5 text-[10px] font-bold text-[var(--warning)]">RECONNECT</button>
                </div>
                {live.tiktok.errorMessage && (
                  <p className="rounded border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2 py-1.5 text-[10px] leading-relaxed text-[var(--danger)]">
                    {live.tiktok.errorMessage}
                  </p>
                )}
                {live.bridge.errorMessage && live.bridge.status === "ERROR" && (
                  <p className="rounded border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2 py-1.5 text-[10px] leading-relaxed text-[var(--danger)]">
                    {live.bridge.errorMessage}
                  </p>
                )}
                <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-muted)] uppercase tracking-wide">Bridge</span>
                    <span className={`font-bold ${live.bridge.status === "CONNECTED" ? "text-[var(--accent)]" : live.bridge.status === "CONNECTING" || live.bridge.status === "RECONNECTING" ? "text-[var(--warning)]" : live.bridge.status === "ERROR" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                      {live.bridge.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-muted)] uppercase tracking-wide">TikTok</span>
                    <span className={`font-bold ${liveStatus === "CONNECTED" ? "text-[var(--accent)]" : liveStatus === "CONNECTING" || liveStatus === "RECONNECTING" ? "text-[var(--warning)]" : liveStatus === "ERROR" ? "text-[var(--danger)]" : liveStatus === "LIVE_ENDED" ? "text-[var(--warning)]" : "text-[var(--text-muted)]"}`}>
                      {liveStatus === "LIVE_ENDED" ? "LIVE ENDED" : liveStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-muted)] uppercase tracking-wide">Username</span>
                    <span className="font-mono text-[var(--text-secondary)]">{live.tiktok.username ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-muted)] uppercase tracking-wide">Room ID</span>
                    <span className="font-mono text-[var(--text-secondary)]">{live.tiktok.roomId ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-muted)] uppercase tracking-wide">Last Event</span>
                    <span className="font-mono text-[var(--text-secondary)]">
                      {live.eventStream.length > 0 ? humanizeEvent(live.eventStream[live.eventStream.length - 1].type) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-muted)] uppercase tracking-wide">Last Event Time</span>
                    <span className="font-mono text-[var(--text-secondary)]">
                      {live.tiktok.lastEventAt ? `${((Date.now() - live.tiktok.lastEventAt) / 1000).toFixed(1)}s ago` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-muted)] uppercase tracking-wide">Viewers</span>
                    <span className="font-mono text-[var(--text-secondary)]">{live.tiktok.viewerCount}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              <Metric label="Total Events" value={live.metrics.eventsTotal} />
              <Metric label="Events/s" value={live.metrics.eventsPerSec} />
              <Metric label="Viewers" value={live.source === "TIKTOK" ? live.tiktok.viewerCount : live.metrics.uniqueViewers} />
              <Metric label="Errors" value={live.metrics.errors} color={live.metrics.errors > 0 ? "var(--danger)" : undefined} />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {([
                { key: "likes", label: "Likes", val: live.metrics.likes, color: "text-pink-400" },
                { key: "gifts", label: "Gifts", val: live.metrics.gifts, color: "text-orange-400" },
                { key: "comments", label: "Comments", val: live.metrics.comments, color: "text-blue-400" },
                { key: "follows", label: "Follows", val: live.metrics.follows, color: "text-emerald-400" },
                { key: "shares", label: "Shares", val: live.metrics.shares, color: "text-cyan-400" },
              ] as const).map((f) => (
                <div key={f.key} className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2 text-center">
                  <div className="text-[10px] uppercase text-[var(--text-muted)]">{f.label}</div>
                  <div className={`text-sm font-mono font-bold ${f.color}`}>{f.val}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* BATTLE STATUS */}
        <Panel>
          <PanelHeader icon={<Trophy size={13} />} title="Battle Status" />
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <StatRow label="Phase"><span className="font-mono">{phase}</span></StatRow>
              <StatRow label="Mode">{loop.session ? "INFINITE LOOP" : session ? "SINGLE" : "—"}</StatRow>
              <StatRow label="Round">{roundNumber || "—"}</StatRow>
              <StatRow label="Battle ID">{session ? session.id.slice(0, 8) : "—"}</StatRow>
              <StatRow label="Timer">{isRunning ? formatTime(remainingMs) : "—"}</StatRow>
              <StatRow label="Auto Spawn">{autoSpawn ? "ON" : "OFF"}</StatRow>
            </div>

            {loop.session && (
              <div className="grid grid-cols-4 gap-2">
                <Metric label="Rounds" value={loop.session.roundsCompleted} />
                <Metric label="A Wins" value={loop.session.teamAWins} color="var(--team-a)" />
                <Metric label="B Wins" value={loop.session.teamBWins} color="var(--team-b)" />
                <Metric label="Streak" value={winStreak} />
              </div>
            )}

            {(isRunning || isEnded) && simSnapshot.maxBaseHp > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <BaseHpBar label="Team A" hp={simSnapshot.topBaseHp} max={simSnapshot.maxBaseHp} color="var(--team-a)" />
                <BaseHpBar label="Team B" hp={simSnapshot.bottomBaseHp} max={simSnapshot.maxBaseHp} color="var(--team-b)" />
              </div>
            )}

            {isEnded && session && (
              <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-3 text-center">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{session.winner ? "Winner" : "Draw"}</p>
                <p className="text-sm font-bold" style={{ color: session.winner === "A" ? "var(--team-a)" : session.winner === "B" ? "var(--team-b)" : "var(--warning)" }}>
                  {session.winner ? (session.winner === "A" ? session.config.teamA.displayName : session.config.teamB.displayName) : "DRAW"}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{session.endReason?.replace(/_/g, " ")}</p>
              </div>
            )}
          </div>
        </Panel>

        {/* CHEST CONTROL */}
        <Panel>
          <PanelHeader icon={<Gift size={13} className="text-[var(--warning)]" />} title="Community Chest" badge={chestState} badgeColor="var(--warning)" />
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <Metric label="Likes" value={chestCycle?.currentLikes ?? 0} />
              <Metric label="Threshold" value={chestConfig?.likeThreshold ?? 0} />
              <Metric label="Red Pts" value={chestCycle?.teamAContributions ?? 0} color="var(--team-a)" />
              <Metric label="Blue Pts" value={chestCycle?.teamBContributions ?? 0} color="var(--team-b)" />
            </div>

            {chestCycle && (
              <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2">
                <span className="text-xs text-[var(--text-muted)]">Leader</span>
                <span className="text-xs font-bold" style={{ color: chestCycle.teamAContributions > chestCycle.teamBContributions ? "var(--team-a)" : chestCycle.teamBContributions > chestCycle.teamAContributions ? "var(--team-b)" : "var(--text-muted)" }}>
                  {chestCycle.teamAContributions > chestCycle.teamBContributions ? "TEAM A" : chestCycle.teamBContributions > chestCycle.teamAContributions ? "TEAM B" : "TIED"}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Reward</span>
                <select value={chestReward} onChange={(e) => setChestReward(e.target.value as ChestRewardChoice)} className="input-field mt-1">
                  {REWARD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Recipient</span>
                <select value={chestRecipient} onChange={(e) => setChestRecipient(e.target.value as "AUTO" | "A" | "B")} className="input-field mt-1">
                  <option value="AUTO">AUTO</option>
                  <option value="A">TEAM A</option>
                  <option value="B">TEAM B</option>
                </select>
              </label>
            </div>

            <button onClick={openChest} disabled={!isRunning || !chestCycle?.unlocked} className="w-full flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-300 transition-all hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-35">
              <Play size={12} /> Open Chest Now
            </button>

            <button onClick={() => setShowManualChest(!showManualChest)} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              {showManualChest ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Manual intervention
            </button>
            {showManualChest && (
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => live.sendLike(1000)} className="px-2 py-1.5 rounded text-[11px] font-medium bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">Add 1K Likes</button>
                <button onClick={() => live.resetChest()} className="px-2 py-1.5 rounded text-[11px] font-medium bg-zinc-800/40 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-800/60 transition-all">Reset Chest</button>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── RIGHT COLUMN: Next Game + Event Feed ── */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        {/* NEXT GAME */}
        <Panel>
          <PanelHeader icon={<Repeat size={13} />} title="Next Game" />
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <StatRow label="Current Duel">{activeConfig ? activeConfig.teamA.displayName + " vs " + activeConfig.teamB.displayName : draftConfig.teamA.displayName + " vs " + draftConfig.teamB.displayName}</StatRow>
              <StatRow label="Current Theme">{BATTLE_THEMES[draftConfig.battleThemeId]?.displayName ?? "—"}</StatRow>
              <StatRow label="Next Duel">{loop.nextDuelId ? DUELS.find((d) => d.id === loop.nextDuelId)?.displayName ?? "—" : "—"}</StatRow>
              <StatRow label="Auto Rotation">{loop.session ? "ON" : "OFF"}</StatRow>
            </div>

            <div className="pt-2">
              <p className="text-[10px] text-[var(--text-muted)] uppercase mb-1.5">Duel Pool</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {DUELS.filter((d) => d.enabled).slice(0, 6).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1">
                    <span className="text-[11px] text-[var(--text-secondary)] truncate">{d.displayName}</span>
                    <span className={`text-[9px] font-bold uppercase ${loop.nextDuelId === d.id ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                      {loop.nextDuelId === d.id ? "NEXT" : "READY"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button onClick={() => { const d = DUELS.find((d) => d.enabled); if (d) selectDuel(d.id); }} disabled={isActive} className="px-2 py-1.5 rounded text-[11px] font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all disabled:opacity-40">Force Next Duel</button>
              <button disabled className="px-2 py-1.5 rounded text-[11px] font-medium bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] opacity-50 cursor-not-allowed">Start Vote (N/A)</button>
            </div>
          </div>
        </Panel>

        {/* EVENT FEED */}
        <Panel>
          <PanelHeader icon={<Activity size={13} />} title="Event Feed" badge={`${events.length}`} />
          <div className="flex flex-wrap gap-1 mb-2">
            {EVENT_FILTERS.map((f) => (
              <button key={f} onClick={() => setEventFilter(f)} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide transition-all ${eventFilter === f ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>{f}</button>
            ))}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filteredEvents.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No events</p>
            ) : (
              filteredEvents.map((e) => (
                <div key={e.id} className="flex gap-2 text-[11px] font-mono px-2 py-1 rounded hover:bg-[var(--bg-surface)]">
                  <span className="text-[var(--text-muted)] shrink-0">{new Date(e.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  <span className={e.type.includes("ERROR") ? "text-[var(--danger)]" : e.type.includes("START") ? "text-[var(--accent)]" : e.type.includes("END") || e.type.includes("STOP") ? "text-[var(--warning)]" : "text-[var(--text-secondary)]"}>
                    {humanizeEvent(e.type)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function BaseHpBar({ label, hp, max, color }: { label: string; hp: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{Math.round(hp).toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
