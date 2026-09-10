import { useEngineStore } from "@/state/engineStore";
import { Shield, ShieldOff, Swords, Pause, Play, StepForward, Gauge, Crosshair, Hammer, Crown, HeartPulse, Zap } from "lucide-react";

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

export default function DevControls() {
  const engineStatus = useEngineStore((s) => s.engineStatus);
  const simSnapshot = useEngineStore((s) => s.simSnapshot);
  const manualSpawn = useEngineStore((s) => s.manualSpawn);
  const setAutoSpawn = useEngineStore((s) => s.setAutoSpawn);
  const forceBaseDamage = useEngineStore((s) => s.forceBaseDamage);
  const triggerUltimate = useEngineStore((s) => s.triggerUltimate);
  const togglePause = useEngineStore((s) => s.togglePause);
  const stepOneTick = useEngineStore((s) => s.stepOneTick);
  const setSpeed = useEngineStore((s) => s.setSpeed);
  const simPaused = useEngineStore((s) => s.simPaused);
  const simSpeed = useEngineStore((s) => s.simSpeed);

  const isRunning = engineStatus === "RUNNING";
  const autoSpawn = simSnapshot.autoSpawnEnabled;
  const m = simSnapshot.metrics;

  const topT1 = m.topByTier?.T1;
  const topT2 = m.topByTier?.T2;
  const topT3 = m.topByTier?.T3;
  const topT4 = m.topByTier?.T4;
  const topT5 = m.topByTier?.T5;
  const botT1 = m.bottomByTier?.T1;
  const botT2 = m.bottomByTier?.T2;
  const botT3 = m.bottomByTier?.T3;
  const botT4 = m.bottomByTier?.T4;
  const botT5 = m.bottomByTier?.T5;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        Dev Controls
      </h2>

      {/* Pause / Step / Speed */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={togglePause}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                simPaused
                  ? "bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)]"
              }`}
            >
              {simPaused ? <Play size={12} /> : <Pause size={12} />}
              {simPaused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={stepOneTick}
              disabled={!simPaused}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] transition-all disabled:opacity-30"
            >
              <StepForward size={12} />
              Step
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Gauge size={11} className="text-[var(--text-muted)]" />
            <div className="flex gap-1 flex-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`flex-1 px-1 py-1 rounded text-[10px] font-mono font-medium border transition-all ${
                    simSpeed === s
                      ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40"
                      : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-light)]"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Auto Spawn Toggle */}
      <button
        onClick={() => setAutoSpawn(!autoSpawn)}
        disabled={!isRunning}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
          autoSpawn
            ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30"
            : "bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/30"
        }`}
      >
        {autoSpawn ? <Shield size={12} /> : <ShieldOff size={12} />}
        Auto Spawn: {autoSpawn ? "ON" : "OFF"}
      </button>

      {/* Per-tier unit counts */}
      {isRunning && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2 text-center space-y-0.5">
            <span className="text-[var(--text-muted)]">Top (A)</span>
            <p className="text-lg font-bold tabular-nums" style={{ color: "var(--team-a)" }}>
              {m.topAlive}
            </p>
            <div className="text-[10px] text-[var(--text-muted)] space-y-0">
              <span>T1: {topT1?.alive ?? 0}</span>
              {topT2 && topT2.alive > 0 && <span> · T2: {topT2.alive}</span>}
              {topT3 && topT3.alive > 0 && <span> · T3: {topT3.alive}</span>}
              {topT4 && topT4.alive > 0 && <span> · T4: {topT4.alive}</span>}
              {topT5 && topT5.alive > 0 && <span> · T5: {topT5.alive}</span>}
            </div>
            {m.topPending > 0 && (
              <p className="text-[10px] text-[var(--warning)]">+{m.topPending} pending</p>
            )}
          </div>
          <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2 text-center space-y-0.5">
            <span className="text-[var(--text-muted)]">Bottom (B)</span>
            <p className="text-lg font-bold tabular-nums" style={{ color: "var(--team-b)" }}>
              {m.bottomAlive}
            </p>
            <div className="text-[10px] text-[var(--text-muted)] space-y-0">
              <span>T1: {botT1?.alive ?? 0}</span>
              {botT2 && botT2.alive > 0 && <span> · T2: {botT2.alive}</span>}
              {botT3 && botT3.alive > 0 && <span> · T3: {botT3.alive}</span>}
              {botT4 && botT4.alive > 0 && <span> · T4: {botT4.alive}</span>}
              {botT5 && botT5.alive > 0 && <span> · T5: {botT5.alive}</span>}
            </div>
            {m.bottomPending > 0 && (
              <p className="text-[10px] text-[var(--warning)]">+{m.bottomPending} pending</p>
            )}
          </div>
        </div>
      )}

      {/* Spawn T1 */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Spawn T1</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <SpawnBtn label="A x1" onClick={() => manualSpawn("A", 1, "T1")} disabled={!isRunning} color="var(--team-a)" />
            <SpawnBtn label="A x10" onClick={() => manualSpawn("A", 10, "T1")} disabled={!isRunning} color="var(--team-a)" />
            <SpawnBtn label="A x50" onClick={() => manualSpawn("A", 50, "T1")} disabled={!isRunning} color="var(--team-a)" />
            <SpawnBtn label="A x100" onClick={() => manualSpawn("A", 100, "T1")} disabled={!isRunning} color="var(--team-a)" />
          </div>
          <div className="space-y-1">
            <SpawnBtn label="B x1" onClick={() => manualSpawn("B", 1, "T1")} disabled={!isRunning} color="var(--team-b)" />
            <SpawnBtn label="B x10" onClick={() => manualSpawn("B", 10, "T1")} disabled={!isRunning} color="var(--team-b)" />
            <SpawnBtn label="B x50" onClick={() => manualSpawn("B", 50, "T1")} disabled={!isRunning} color="var(--team-b)" />
            <SpawnBtn label="B x100" onClick={() => manualSpawn("B", 100, "T1")} disabled={!isRunning} color="var(--team-b)" />
          </div>
        </div>
      </div>

      {/* Spawn T2 */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Spawn T2 Specialist</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <SpawnBtn label="A T2 x1" onClick={() => manualSpawn("A", 1, "T2")} disabled={!isRunning} color="var(--team-a)" icon={<Crosshair size={10} />} />
            <SpawnBtn label="A T2 x5" onClick={() => manualSpawn("A", 5, "T2")} disabled={!isRunning} color="var(--team-a)" icon={<Crosshair size={10} />} />
            <SpawnBtn label="A T2 x10" onClick={() => manualSpawn("A", 10, "T2")} disabled={!isRunning} color="var(--team-a)" icon={<Crosshair size={10} />} />
          </div>
          <div className="space-y-1">
            <SpawnBtn label="B T2 x1" onClick={() => manualSpawn("B", 1, "T2")} disabled={!isRunning} color="var(--team-b)" icon={<Crosshair size={10} />} />
            <SpawnBtn label="B T2 x5" onClick={() => manualSpawn("B", 5, "T2")} disabled={!isRunning} color="var(--team-b)" icon={<Crosshair size={10} />} />
            <SpawnBtn label="B T2 x10" onClick={() => manualSpawn("B", 10, "T2")} disabled={!isRunning} color="var(--team-b)" icon={<Crosshair size={10} />} />
          </div>
        </div>
      </div>

      {/* Spawn T3 */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Spawn T3 Healer</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <SpawnBtn label="A T3 x1" onClick={() => manualSpawn("A", 1, "T3")} disabled={!isRunning} color="var(--team-a)" icon={<HeartPulse size={10} />} />
            <SpawnBtn label="A T3 x3" onClick={() => manualSpawn("A", 3, "T3")} disabled={!isRunning} color="var(--team-a)" icon={<HeartPulse size={10} />} />
            <SpawnBtn label="A T3 x5" onClick={() => manualSpawn("A", 5, "T3")} disabled={!isRunning} color="var(--team-a)" icon={<HeartPulse size={10} />} />
          </div>
          <div className="space-y-1">
            <SpawnBtn label="B T3 x1" onClick={() => manualSpawn("B", 1, "T3")} disabled={!isRunning} color="var(--team-b)" icon={<HeartPulse size={10} />} />
            <SpawnBtn label="B T3 x3" onClick={() => manualSpawn("B", 3, "T3")} disabled={!isRunning} color="var(--team-b)" icon={<HeartPulse size={10} />} />
            <SpawnBtn label="B T3 x5" onClick={() => manualSpawn("B", 5, "T3")} disabled={!isRunning} color="var(--team-b)" icon={<HeartPulse size={10} />} />
          </div>
        </div>
      </div>

      {/* Spawn T4 */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Spawn T4 Breaker</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <SpawnBtn label="A T4 x1" onClick={() => manualSpawn("A", 1, "T4")} disabled={!isRunning} color="var(--team-a)" icon={<Hammer size={10} />} />
            <SpawnBtn label="A T4 x3" onClick={() => manualSpawn("A", 3, "T4")} disabled={!isRunning} color="var(--team-a)" icon={<Hammer size={10} />} />
            <SpawnBtn label="A T4 x10" onClick={() => manualSpawn("A", 10, "T4")} disabled={!isRunning} color="var(--team-a)" icon={<Hammer size={10} />} />
          </div>
          <div className="space-y-1">
            <SpawnBtn label="B T4 x1" onClick={() => manualSpawn("B", 1, "T4")} disabled={!isRunning} color="var(--team-b)" icon={<Hammer size={10} />} />
            <SpawnBtn label="B T4 x3" onClick={() => manualSpawn("B", 3, "T4")} disabled={!isRunning} color="var(--team-b)" icon={<Hammer size={10} />} />
            <SpawnBtn label="B T4 x10" onClick={() => manualSpawn("B", 10, "T4")} disabled={!isRunning} color="var(--team-b)" icon={<Hammer size={10} />} />
          </div>
        </div>
      </div>

      {/* Spawn T5 */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Spawn T5 Boss</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <SpawnBtn label="A T5 x1" onClick={() => manualSpawn("A", 1, "T5")} disabled={!isRunning} color="var(--team-a)" icon={<Crown size={10} />} />
            <SpawnBtn label="A T5 x2" onClick={() => manualSpawn("A", 2, "T5")} disabled={!isRunning} color="var(--team-a)" icon={<Crown size={10} />} />
          </div>
          <div className="space-y-1">
            <SpawnBtn label="B T5 x1" onClick={() => manualSpawn("B", 1, "T5")} disabled={!isRunning} color="var(--team-b)" icon={<Crown size={10} />} />
            <SpawnBtn label="B T5 x2" onClick={() => manualSpawn("B", 2, "T5")} disabled={!isRunning} color="var(--team-b)" icon={<Crown size={10} />} />
          </div>
        </div>
      </div>

      {/* Force Base Damage */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Force Base Damage</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => forceBaseDamage("A", 10)}
            disabled={!isRunning}
            className="px-2 py-1.5 rounded text-xs font-medium bg-red-950/50 text-red-400 border border-red-800/30 hover:bg-red-950 transition-all disabled:opacity-40"
          >
            Base A -10%
          </button>
          <button
            onClick={() => forceBaseDamage("B", 10)}
            disabled={!isRunning}
            className="px-2 py-1.5 rounded text-xs font-medium bg-red-950/50 text-red-400 border border-red-800/30 hover:bg-red-950 transition-all disabled:opacity-40"
          >
            Base B -10%
          </button>
        </div>
      </div>

      {/* T6 Ultimate */}
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">T6 Ultimate (DEV)</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => triggerUltimate("A")}
            disabled={!isRunning}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold border transition-all disabled:opacity-40 bg-orange-950/40 text-orange-400 border-orange-700/40 hover:bg-orange-950/60"
          >
            <Zap size={12} />
            Team A T6
          </button>
          <button
            onClick={() => triggerUltimate("B")}
            disabled={!isRunning}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold border transition-all disabled:opacity-40 bg-orange-950/40 text-orange-400 border-orange-700/40 hover:bg-orange-950/60"
          >
            <Zap size={12} />
            Team B T6
          </button>
        </div>
      </div>

      {/* Force Base Damage (original) */}

      {/* Metrics */}
      {isRunning && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Metrics</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-[var(--text-muted)] font-mono">
            <span>Spawned Top: {m.topSpawned}</span>
            <span>Spawned Bot: {m.bottomSpawned}</span>
            <span>Died Top: {m.topDied}</span>
            <span>Died Bot: {m.bottomDied}</span>
            <span>Fighting Top: {m.topFighting}</span>
            <span>Fighting Bot: {m.bottomFighting}</span>
            <span>Alive Top: {m.topAlive}</span>
            <span>Alive Bot: {m.bottomAlive}</span>
            {topT2 && topT2.damageToUnits > 0 && <span>T2A Dmg: {Math.round(topT2.damageToUnits)}</span>}
            {botT2 && botT2.damageToUnits > 0 && <span>T2B Dmg: {Math.round(botT2.damageToUnits)}</span>}
            {topT3 && topT3.healActual > 0 && <span>T3A Heal: {Math.round(topT3.healActual)}</span>}
            {botT3 && botT3.healActual > 0 && <span>T3B Heal: {Math.round(botT3.healActual)}</span>}
            {topT4 && topT4.damageToUnits > 0 && <span>T4A Dmg: {Math.round(topT4.damageToUnits)}</span>}
            {botT4 && botT4.damageToUnits > 0 && <span>T4B Dmg: {Math.round(botT4.damageToUnits)}</span>}
            {topT5 && topT5.damageToUnits > 0 && <span>T5A Dmg: {Math.round(topT5.damageToUnits)}</span>}
            {botT5 && botT5.damageToUnits > 0 && <span>T5B Dmg: {Math.round(botT5.damageToUnits)}</span>}
            {topT4 && topT4.damageToBase > 0 && <span>T4A Base: {Math.round(topT4.damageToBase)}</span>}
            {botT4 && botT4.damageToBase > 0 && <span>T4B Base: {Math.round(botT4.damageToBase)}</span>}
            {topT5 && topT5.damageToBase > 0 && <span>T5A Base: {Math.round(topT5.damageToBase)}</span>}
            {botT5 && botT5.damageToBase > 0 && <span>T5B Base: {Math.round(botT5.damageToBase)}</span>}
            {topT4 && topT4.chargeImpacts > 0 && <span className="col-span-1">T4A Impacts: {topT4.chargeImpacts}</span>}
            {botT4 && botT4.chargeImpacts > 0 && <span className="col-span-1">T4B Impacts: {botT4.chargeImpacts}</span>}
            {topT5 && topT5.slamCount > 0 && <span className="col-span-1">T5A Slams: {topT5.slamCount}</span>}
            {botT5 && botT5.slamCount > 0 && <span className="col-span-1">T5B Slams: {botT5.slamCount}</span>}
            {topT5 && topT5.slamDamage > 0 && <span className="col-span-1">T5A SlamDmg: {Math.round(topT5.slamDamage)}</span>}
            {botT5 && botT5.slamDamage > 0 && <span className="col-span-1">T5B SlamDmg: {Math.round(botT5.slamDamage)}</span>}
            {topT5 && topT5.avgLifetime > 0 && <span className="col-span-1">T5A Life: {topT5.avgLifetime.toFixed(1)}s</span>}
            {botT5 && botT5.avgLifetime > 0 && <span className="col-span-1">T5B Life: {botT5.avgLifetime.toFixed(1)}s</span>}
            <span className="col-span-2">Base Dmg to Top: {Math.round(m.bottomBaseDamageDealt)}</span>
            <span className="col-span-2">Base Dmg to Bot: {Math.round(m.topBaseDamageDealt)}</span>
            <span className="col-span-2">Elapsed: {simSnapshot.elapsedSeconds.toFixed(1)}s</span>
          </div>
        </div>
      )}

      {/* T3 Config display */}
      {isRunning && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">T3 Healer Config</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-[var(--text-muted)] font-mono">
            <span>HP: 650</span>
            <span>Heal/sec: 250</span>
            <span>Pool: 5000</span>
            <span>Range: 70</span>
            <span>Acquire: 140</span>
            <span>T1/T2/T3: 100%</span>
            <span>T4: 50%</span>
            <span>T5: 25%</span>
            <span>Value: 0.50 EUR</span>
          </div>
        </div>
      )}

      {/* T4 Config display */}
      {isRunning && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">T4 Breaker Config</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-[var(--text-muted)] font-mono">
            <span>HP: 8000</span>
            <span>DPS: 220</span>
            <span>Struct DPS: 400</span>
            <span>Speed: 0.8</span>
            <span>Radius: 14</span>
            <span>Frontage: 3</span>
            <span>Chg Mult: 1.8x</span>
            <span>Impact Dmg: 1500</span>
            <span>Impact R: 50</span>
            <span>Knockback: 25</span>
            <span>KB Resist: 0.5</span>
            <span>Price: 2 EUR</span>
          </div>
        </div>
      )}

      {/* T5 Config display */}
      {isRunning && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">T5 Boss Config</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-[var(--text-muted)] font-mono">
            <span>HP: 18000</span>
            <span>DPS: 450</span>
            <span>Struct DPS: 300</span>
            <span>Speed: 0.7</span>
            <span>Radius: 20</span>
            <span>Frontage: 4</span>
            <span>Slam Dmg: 900</span>
            <span>Slam R: 60</span>
            <span>Slam CD: 4s</span>
            <span>Slam KB: 18</span>
            <span>KB Resist: 0.8</span>
            <span>Price: 5 EUR</span>
          </div>
        </div>
      )}

      {/* T6 Config display */}
      {isRunning && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">T6 Ultimate Config</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-[var(--text-muted)] font-mono">
            <span>T1-T3 Kill: 90%</span>
            <span>T4 Dmg: 55% cur HP</span>
            <span>T5 Dmg: 45% max HP</span>
            <span>Base Dmg: 8% max HP</span>
            <span>Knockback: 40</span>
            <span>Stun: 0s</span>
            <span>Price: 20 EUR</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SpawnBtn({
  label,
  onClick,
  disabled,
  color,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-2 py-1.5 rounded text-xs font-medium border transition-all disabled:opacity-40 hover:brightness-125"
      style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        color,
      }}
    >
      {icon ?? <Swords size={10} className="inline mr-1" />}
      {label}
    </button>
  );
}
