import type { TeamConfig, CommanderDefinition } from "@/domain/types";
import { getCommander } from "@/data/commanders";
import EntityAvatar from "@/components/EntityAvatar";

interface TeamHudProps {
  team: "A" | "B";
  config: TeamConfig;
  baseHp: number;
  maxBaseHp: number;
  isBottom?: boolean;
}

export function TeamHud({ team, config, baseHp, maxBaseHp, isBottom }: TeamHudProps) {
  const hpPct = maxBaseHp > 0 ? Math.max(0, (baseHp / maxBaseHp) * 100) : 0;
  const isCritical = hpPct <= 25;
  const isLow = hpPct <= 50 && hpPct > 25;
  const commander: CommanderDefinition | undefined = getCommander(config.commanderId);
  const commanderName = commander?.displayName ?? config.displayName;
  const color = config.primaryColor;
  const secondaryColor = config.secondaryColor ?? color;

  const hpColor = hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444";
  const hpGradient = hpPct > 50
    ? "linear-gradient(90deg, #16a34a, #22c55e, #4ade80)"
    : hpPct > 25
    ? "linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)"
    : "linear-gradient(90deg, #dc2626, #ef4444, #f87171)";

  return (
    <div
      className={`relative px-2.5 py-2 ${isBottom ? "border-t-2" : "border-b-2"} backdrop-blur-md`}
      style={{
        background: `linear-gradient(${isBottom ? "0deg" : "180deg"}, ${color}12, var(--stage-surface))`,
        borderColor: `${color}50`,
      }}
    >
      <div className={`flex items-center gap-2 ${isBottom ? "flex-row-reverse" : "flex-row"}`}>
        {/* Commander portrait — chunky arcade frame */}
        <div className="relative shrink-0">
          {/* Outer frame */}
          <div
            className="relative w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${color}, ${secondaryColor})`,
              border: `2.5px solid ${color}`,
              boxShadow: isCritical
                ? `0 0 16px ${color}, inset 0 0 8px rgba(0,0,0,0.3)`
                : `0 0 8px ${color}50, inset 0 0 8px rgba(0,0,0,0.2)`,
            }}
          >
            <EntityAvatar
              entity={commander}
              label={commanderName}
              size={48}
              fallbackColor={color}
              className="rounded-xl"
            />
            {/* Inner shine */}
            <div
              className="absolute top-0 left-0 right-0 h-1/2 rounded-t-xl"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.15), transparent)" }}
            />
            {isCritical && (
              <div
                className="absolute inset-0 rounded-xl"
                style={{ border: "2px solid #ef4444", animation: "critical-pulse 0.6s infinite" }}
              />
            )}
          </div>
          {/* Team badge — chunky tab */}
          <div
            className={`absolute ${isBottom ? "-bottom-1 -left-1" : "-bottom-1 -right-1"} px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider`}
            style={{
              background: color,
              color: "#fff",
              border: "1.5px solid rgba(0,0,0,0.3)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
              textShadow: "0 1px 1px rgba(0,0,0,0.3)",
            }}
          >
            {team}
          </div>
        </div>

        {/* Name + HP bar */}
        <div className="flex-1 min-w-0">
          {/* Nameplate */}
          <div className={`flex items-center gap-1.5 mb-1 ${isBottom ? "flex-row-reverse" : "flex-row"}`}>
            <span
              className="text-[9px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
              style={{
                background: `${color}25`,
                color,
                border: `1px solid ${color}40`,
              }}
            >
              {team === "A" ? "TEAM A" : "TEAM B"}
            </span>
            <span
              className="text-sm font-black text-[var(--stage-text)] truncate"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
            >
              {commanderName}
            </span>
          </div>

          {/* HP bar — chunky arcade bar */}
          <div
            className="relative h-4 rounded-md overflow-hidden"
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "2px solid rgba(255,255,255,0.12)",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
              ...(isCritical ? { animation: "hp-shake 0.3s infinite" } : {}),
            }}
          >
            {/* Fill */}
            <div
              className="h-full rounded-sm transition-all duration-300 relative overflow-hidden"
              style={{
                width: `${hpPct}%`,
                background: hpGradient,
                boxShadow: isCritical ? `0 0 12px ${hpColor}` : `0 0 4px ${hpColor}60`,
              }}
            >
              {/* Top shine */}
              <div
                className="absolute top-0 left-0 right-0 h-1/2"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.25), transparent)" }}
              />
              {/* Sheen sweep */}
              <div className="sheen-overlay" />
            </div>
            {/* Segment ticks */}
            <div className="absolute inset-0 flex pointer-events-none">
              {[25, 50, 75].map((tick) => (
                <div key={tick} className="absolute top-0 bottom-0 w-px bg-black/30" style={{ left: `${tick}%` }} />
              ))}
            </div>
            {/* Critical label */}
            {isCritical && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-[8px] font-black text-white tracking-widest"
                  style={{ animation: "critical-pulse 0.6s infinite", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                >
                  BASE CRITICAL
                </span>
              </div>
            )}
          </div>
        </div>

        {/* HP % — big chunky number */}
        <div className="shrink-0" style={{ textAlign: isBottom ? "left" : "right" }}>
          <div
            className="text-2xl font-black leading-none tabular-nums"
            style={{
              color: hpColor,
              textShadow: `0 0 10px ${hpColor}50, 0 2px 3px rgba(0,0,0,0.6)`,
              ...(isLow || isCritical ? { animation: "timer-pulse 1s ease-in-out infinite" } : {}),
            }}
          >
            {Math.round(hpPct)}<span className="text-sm">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
