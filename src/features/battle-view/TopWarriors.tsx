import { useMemo, type CSSProperties } from "react";
import { Coins, Crown, Shield, Flame } from "lucide-react";

export interface WarriorEntry {
  pseudo: string;
  totalCoins: number;
}

interface TopWarriorsProps {
  teamName: string;
  teamColor: string;
  side: "left" | "right";
  warriors: WarriorEntry[];
}

const RANK_META = [
  { tier: "gold",   badgeColor: "#fbbf24", badgeBorder: "#f59e0b", glow: "rgba(251,191,36,0.55)", icon: Crown,  iconSize: 10 },
  { tier: "silver", badgeColor: "#cbd5e1", badgeBorder: "#94a3b8", glow: "rgba(203,213,225,0.40)", icon: Shield, iconSize: 9 },
  { tier: "bronze", badgeColor: "#d97706", badgeBorder: "#92400e", glow: "rgba(217,119,6,0.40)",  icon: Shield, iconSize: 9 },
];

function formatCoins(value: number): string {
  return value.toLocaleString("en-US");
}

export function TopWarriors({ teamName, teamColor, side, warriors }: TopWarriorsProps) {
  const top3 = useMemo(() => {
    const sorted = [...warriors].sort((a, b) => b.totalCoins - a.totalCoins).slice(0, 3);
    return sorted.length > 0
      ? sorted
      : Array.from({ length: 3 }, (_, i) => ({ pseudo: i === 0 ? "Awaiting champion" : "—", totalCoins: 0 }));
  }, [warriors]);
  const isRight = side === "right";

  return (
    <div className={`flex-1 min-w-0 h-full flex flex-col ${isRight ? "text-right" : "text-left"}`}>
      {/* Header */}
      <div className={`flex items-center gap-0.5 mb-0.5 shrink-0 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
        <Flame size={7} style={{ color: teamColor, filter: `drop-shadow(0 0 2px ${teamColor}80)` }} />
        <span
          className="text-[6px] font-black uppercase tracking-[0.06em]"
          style={{ color: `${teamColor}dd`, textShadow: "0 1px 2px rgba(0,0,0,0.5)", fontFamily: "'Cinzel', serif" }}
        >
          {teamName} Warriors
        </span>
      </div>

      {/* Podium card */}
      <div
        className="relative rounded overflow-hidden flex-1 min-h-0 flex flex-col"
        style={{
          background: "linear-gradient(180deg, rgba(30,27,43,0.92) 0%, rgba(15,12,20,0.96) 100%)",
          border: "1px solid rgba(168,85,247,0.18)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        <div className="warriors-shimmer" aria-hidden="true" />
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background:
              "repeating-linear-gradient(135deg, transparent 0 3px, rgba(255,255,255,0.015) 3px 4px), repeating-linear-gradient(45deg, transparent 0 5px, rgba(0,0,0,0.04) 5px 6px)",
          }}
        />

        <div className="relative flex-1 min-h-0 flex flex-col py-0.5 px-1 gap-0.5">
          {top3.map((warrior, i) => {
            const rank = i + 1;
            const meta = RANK_META[i];
            const Icon = meta.icon;
            const floatDelay = `${i * 0.4}s`;
            const badgeDelay = `${i * 0.6}s`;

            const rowStyle: CSSProperties = {
              animation: `warrior-float 3s ease-in-out ${floatDelay} infinite`,
              ...(isRight ? { flexDirection: "row-reverse" } : {}),
            };

            const badgeStyle: CSSProperties = {
              background: `linear-gradient(135deg, ${meta.badgeColor}30, ${meta.badgeColor}10)`,
              border: `1.5px solid ${meta.badgeBorder}`,
              color: meta.badgeColor,
              boxShadow: `0 0 6px ${meta.glow}, inset 0 0 4px ${meta.glow}`,
              animation: `badge-breathe 2.5s ease-in-out ${badgeDelay} infinite`,
            };

            return (
              <div
                key={`${warrior.pseudo}-${rank}`}
                className="relative flex-1 min-h-0 flex items-center gap-1 rounded px-1 py-0 warriors-top3"
                style={rowStyle}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 relative"
                  style={badgeStyle}
                >
                  {rank === 1 && (
                    <span
                      className="absolute inset-0 rounded pointer-events-none"
                      style={{ animation: "gold-pulse 1.8s ease-in-out infinite" }}
                    />
                  )}
                  <Icon size={meta.iconSize} strokeWidth={2.5} />
                  <span className="absolute -bottom-0.5 -right-0.5 text-[5px] font-black" style={{ color: meta.badgeColor }}>
                    {rank}
                  </span>
                </div>

                <span
                  className="text-[7px] font-bold truncate flex-1 min-w-0"
                  style={{
                    color: "rgba(255,255,255,0.92)",
                    textShadow: `0 0 6px ${teamColor}30`,
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  {warrior.pseudo}
                </span>

                <span
                  className="text-[7px] font-mono font-bold tabular-nums shrink-0 flex items-center gap-0.5"
                  style={{ color: meta.badgeColor }}
                >
                  <Coins size={8} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 2px ${meta.badgeColor}60)` }} />
                  {formatCoins(warrior.totalCoins)}
                </span>

                <span
                  className="warriors-spark warriors-spark--1"
                  style={{ animationDelay: `${i * 0.3}s` }}
                  aria-hidden="true"
                />
                <span
                  className="warriors-spark warriors-spark--2"
                  style={{ animationDelay: `${i * 0.3 + 0.5}s` }}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
