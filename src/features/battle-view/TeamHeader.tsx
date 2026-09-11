import type { ArenaTeam } from "@/simulation/types";

interface TeamHeaderProps {
  team: ArenaTeam;
  displayName: string;
  color: string;
  baseHp: number;
  maxBaseHp: number;
  alive: number;
  fighting: number;
}

export function TeamHeader({
  team,
  displayName,
  color,
  baseHp,
  maxBaseHp,
  alive,
  fighting,
}: TeamHeaderProps) {
  const hpPct = maxBaseHp > 0 ? Math.max(0, (baseHp / maxBaseHp) * 100) : 0;
  const isTop = team === "top";

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)]"
      style={{
        borderColor: color,
        borderBottomWidth: isTop ? 2 : 0,
        borderTopWidth: isTop ? 0 : 2,
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black text-white shrink-0"
        style={{ backgroundColor: color }}
      >
        {displayName.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-[var(--text-primary)] truncate">
            {displayName}
          </span>
          <span className="text-xs text-[var(--text-muted)] ml-2 shrink-0">
            {alive} alive / {fighting} fighting
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${hpPct}%`,
              backgroundColor: hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
      </div>

      {/* HP Value */}
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-[var(--text-primary)]">
          {Math.round(hpPct)}%
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">
          {Math.round(baseHp)} HP
        </div>
      </div>
    </div>
  );
}
