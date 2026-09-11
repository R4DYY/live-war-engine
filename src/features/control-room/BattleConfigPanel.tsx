import { useEngineStore } from "@/state/engineStore";
import { DUELS } from "@/data/duels";
import { BATTLE_THEMES, BATTLE_THEME_IDS } from "@/data/themes";
import { getCommander } from "@/data/commanders";
import EntityAvatar from "@/components/EntityAvatar";
import type { BattleThemeId } from "@/domain/types";

export default function BattleConfigPanel() {
  const draftConfig = useEngineStore((s) => s.draftConfig);
  const engineStatus = useEngineStore((s) => s.engineStatus);
  const loopPhase = useEngineStore((s) => s.loop.phase);
  const selectDuel = useEngineStore((s) => s.selectDuel);
  const selectTheme = useEngineStore((s) => s.selectTheme);
  const setCombatField = useEngineStore((s) => s.setCombatField);
  const resetConfigToDefaults = useEngineStore((s) => s.resetConfigToDefaults);

  const isLocked = (engineStatus === "RUNNING" || engineStatus === "PAUSED") && loopPhase === "IDLE";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Battle Configuration
        </h2>
        {isLocked && (
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--warning)] text-black font-medium">
            LOCKED
          </span>
        )}
      </div>

      {/* Duel */}
      <Field label="Duel">
        <select
          value={draftConfig.duelId}
          onChange={(e) => selectDuel(e.target.value)}
          disabled={isLocked}
          className="input-field"
        >
          {DUELS.filter((d) => d.enabled).map((d) => (
            <option key={d.id} value={d.id}>
              {d.displayName}
            </option>
          ))}
        </select>
      </Field>

      {/* Theme */}
      <Field label="Battle Theme">
        <select
          value={draftConfig.battleThemeId}
          onChange={(e) => selectTheme(e.target.value as BattleThemeId)}
          disabled={isLocked}
          className="input-field"
        >
          {BATTLE_THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {BATTLE_THEMES[id].displayName}
            </option>
          ))}
        </select>
      </Field>

      {/* Combat settings */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Base HP">
          <input
            type="number"
            value={draftConfig.combat.baseHp}
            onChange={(e) =>
              setCombatField("baseHp", Math.max(1, Number(e.target.value) || 1))
            }
            disabled={isLocked}
            className="input-field"
            min={1}
          />
        </Field>
        <Field label="Duration (s)">
          <input
            type="number"
            value={draftConfig.combat.durationSeconds}
            onChange={(e) =>
              setCombatField(
                "durationSeconds",
                Math.max(1, Number(e.target.value) || 1)
              )
            }
            disabled={isLocked}
            className="input-field"
            min={1}
          />
        </Field>
        <Field label="Spawn (s)">
          <input
            type="number"
            value={draftConfig.combat.autoSpawnIntervalSeconds}
            onChange={(e) =>
              setCombatField(
                "autoSpawnIntervalSeconds",
                Math.max(0.1, Number(e.target.value) || 0.1)
              )
            }
            disabled={isLocked}
            className="input-field"
            min={0.1}
            step={0.1}
          />
        </Field>
      </div>

      {/* Team colors preview */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <EntityAvatar entity={getCommander(draftConfig.teamA.commanderId)} label={draftConfig.teamA.displayName} size={28} fallbackColor={draftConfig.teamA.primaryColor} />
          <div className="w-3 h-3 rounded" style={{ background: draftConfig.teamA.primaryColor }} />
          <span className="text-[var(--text-secondary)] truncate">Team A: {draftConfig.teamA.displayName}</span>
        </div>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <EntityAvatar entity={getCommander(draftConfig.teamB.commanderId)} label={draftConfig.teamB.displayName} size={28} fallbackColor={draftConfig.teamB.primaryColor} />
          <div className="w-3 h-3 rounded" style={{ background: draftConfig.teamB.primaryColor }} />
          <span className="text-[var(--text-secondary)] truncate">Team B: {draftConfig.teamB.displayName}</span>
        </div>
      </div>

      <button
        onClick={resetConfigToDefaults}
        disabled={isLocked}
        className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-40"
      >
        Reset to Defaults
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
