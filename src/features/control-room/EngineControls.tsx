import { useEngineStore } from "@/state/engineStore";
import { useCountdown, formatTime } from "@/hooks/useCountdown";
import { Repeat, Square, Play, RotateCcw, Ban } from "lucide-react";

export default function EngineControls() {
  const engineStatus = useEngineStore((s) => s.engineStatus);
  const phase = useEngineStore((s) => s.loop.phase);
  const validationErrors = useEngineStore((s) => s.validationErrors);
  const startSingleBattle = useEngineStore((s) => s.startSingleBattle);
  const startInfiniteLoop = useEngineStore((s) => s.startInfiniteLoop);
  const stopLoopAfterRound = useEngineStore((s) => s.stopLoopAfterRound);
  const abortCurrentBattle = useEngineStore((s) => s.abortCurrentBattle);
  const resetEngine = useEngineStore((s) => s.resetEngine);
  const { remainingMs, intermissionMs, isInIntermission } = useCountdown();

  const isActive = phase !== "IDLE";
  const isRunning = engineStatus === "RUNNING";
  const canStart = !isActive && !isRunning;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Engine Controls</h2>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={startSingleBattle} disabled={!canStart} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-black hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <Play size={14} /> Start Single Battle
        </button>
        <button onClick={startInfiniteLoop} disabled={!canStart} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold bg-[var(--warning)] text-black hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <Repeat size={14} /> Start Infinite Loop
        </button>
      </div>
      {isActive && (
        <div className="space-y-2">
          <button onClick={stopLoopAfterRound} disabled={phase === "STOPPING"} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--warning)] text-black hover:brightness-110 transition-all disabled:opacity-40">
            <Square size={14} /> {phase === "BATTLE" || phase === "STOPPING" ? "Stop After Round" : "Stop Loop"}
          </button>
          {phase === "BATTLE" && <p className="text-[11px] text-center text-[var(--warning)]">The loop will stop after the current round.</p>}
          <button onClick={abortCurrentBattle} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--danger)] text-white hover:brightness-110 transition-all">
            <Ban size={13} /> Abort Current Battle
          </button>
        </div>
      )}
      {!isActive && isRunning && (
        <button onClick={abortCurrentBattle} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--danger)] text-white hover:brightness-110 transition-all">
          <Square size={14} /> Stop Battle
        </button>
      )}
      <button onClick={resetEngine} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">
        <RotateCcw size={14} /> Reset Engine
      </button>
      {isRunning && <div className="text-center py-2"><span className="text-3xl font-mono font-bold tabular-nums">{formatTime(remainingMs)}</span></div>}
      {isInIntermission && <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--warning)]/30 p-3 text-center"><p className="text-xs text-[var(--text-muted)] uppercase">Next battle in</p><p className="text-2xl font-mono font-bold text-[var(--warning)]">{formatTime(intermissionMs)}</p></div>}
      {validationErrors.length > 0 && <div className="rounded-lg bg-red-950/50 border border-red-800/50 p-3"><p className="text-xs font-semibold text-[var(--danger)] mb-1">Validation Errors</p>{validationErrors.map((err) => <p key={`${err.field}-${err.message}`} className="text-xs text-red-300">{err.field}: {err.message}</p>)}</div>}
    </div>
  );
}
