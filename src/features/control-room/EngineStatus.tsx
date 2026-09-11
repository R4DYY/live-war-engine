import { useEngineStore } from "@/state/engineStore";
import { getStatusLabel } from "@/engine/battleEngine";
import { useCountdown, formatTime } from "@/hooks/useCountdown";
import { BATTLE_THEMES } from "@/data/themes";

export default function EngineStatus() {
  const engineStatus = useEngineStore((s) => s.engineStatus);
  const session = useEngineStore((s) => s.session);
  const roundNumber = useEngineStore((s) => s.roundNumber);
  const loop = useEngineStore((s) => s.loop);
  const draftConfig = useEngineStore((s) => s.draftConfig);
  const simSnapshot = useEngineStore((s) => s.simSnapshot);
  const { remainingMs, intermissionMs, isInIntermission } = useCountdown();
  const activeConfig = session?.config;
  const showDraft = Boolean(activeConfig && (activeConfig.duelId !== draftConfig.duelId || activeConfig.battleThemeId !== draftConfig.battleThemeId || activeConfig.combat.baseHp !== draftConfig.combat.baseHp || activeConfig.combat.durationSeconds !== draftConfig.combat.durationSeconds));
  const statusColor = engineStatus === "RUNNING" ? "var(--accent)" : engineStatus === "ENDED" ? "var(--warning)" : "var(--text-muted)";
  const runtimeMs = loop.session ? Date.now() - loop.session.startedAt : 0;

  return <div className="space-y-4">
    <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Engine Status</h2>
    <div className="space-y-2 text-sm">
      <Row label="Status"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: statusColor }} /><span className="font-medium" style={{ color: statusColor }}>{getStatusLabel(engineStatus)}</span></span></Row>
      <Row label="Phase"><span className="font-mono text-xs">{loop.phase}</span></Row>
      <Row label="Mode">{loop.session ? "INFINITE LOOP" : "SINGLE BATTLE"}</Row>
      <Row label="Round">{roundNumber || "—"}</Row>
      {loop.session && <Row label="Loop Session"><span className="font-mono text-xs">{loop.session.id.slice(0, 8)}</span></Row>}
      {session && <Row label="Battle ID"><span className="font-mono text-xs">{session.id.slice(0, 8)}</span></Row>}
      {engineStatus === "RUNNING" && <Row label="Remaining"><span className="font-mono tabular-nums">{formatTime(remainingMs)}</span></Row>}
      {isInIntermission && <Row label="Next Battle"><span className="font-mono tabular-nums text-[var(--warning)]">{formatTime(intermissionMs)}</span></Row>}
      {loop.session && <Row label="Runtime"><span className="font-mono tabular-nums">{formatTime(runtimeMs)}</span></Row>}
    </div>
    {loop.session && <div className="grid grid-cols-3 gap-2 text-center text-xs"><Metric label="Rounds" value={loop.session.roundsCompleted} /><Metric label="A Wins" value={loop.session.teamAWins} /><Metric label="B Wins" value={loop.session.teamBWins} /></div>}
    {(engineStatus === "RUNNING" || engineStatus === "ENDED") && simSnapshot.maxBaseHp > 0 && <div className="grid grid-cols-2 gap-2 text-xs"><Base label="Base A" hp={simSnapshot.topBaseHp} max={simSnapshot.maxBaseHp} color="var(--team-a)" /><Base label="Base B" hp={simSnapshot.bottomBaseHp} max={simSnapshot.maxBaseHp} color="var(--team-b)" /></div>}
    {engineStatus === "ENDED" && session && <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-3 text-center"><p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{session.winner ? "Winner" : "Draw"}</p><p className="text-sm font-bold" style={{ color: session.winner === "A" ? "var(--team-a)" : session.winner === "B" ? "var(--team-b)" : "var(--warning)" }}>{session.winner ? (session.winner === "A" ? session.config.teamA.displayName : session.config.teamB.displayName) : "DRAW"}</p><p className="text-xs text-[var(--text-muted)]">{session.endReason?.replace(/_/g, " ")}</p></div>}
    {activeConfig && <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-3 space-y-1"><p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide">Current Round</p><p className="text-sm">{activeConfig.teamA.displayName} vs {activeConfig.teamB.displayName}</p><p className="text-xs text-[var(--text-muted)]">{BATTLE_THEMES[activeConfig.battleThemeId]?.displayName} — HP {activeConfig.combat.baseHp.toLocaleString()} — {formatTime(activeConfig.combat.durationSeconds * 1000)}</p></div>}
    {showDraft && <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--warning)]/30 p-3 space-y-1"><p className="text-xs font-semibold text-[var(--warning)] uppercase tracking-wide">Next Round Config</p><p className="text-xs text-[var(--text-secondary)]">Draft changes apply when the next battle starts.</p><p className="text-xs">{draftConfig.teamA.displayName} vs {draftConfig.teamB.displayName} · {BATTLE_THEMES[draftConfig.battleThemeId]?.displayName}</p></div>}
  </div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex items-center justify-between"><span className="text-[var(--text-muted)]">{label}</span><span className="text-[var(--text-primary)]">{children}</span></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">{label}</span><p className="font-mono font-bold">{value}</p></div>; }
function Base({ label, hp, max, color }: { label: string; hp: number; max: number; color: string }) { return <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">{label}</span><p className="font-mono tabular-nums text-sm" style={{ color }}>{Math.round(hp).toLocaleString()} / {max.toLocaleString()}</p></div>; }
