interface BattleTimerProps {
  elapsedSeconds: number;
  durationSeconds: number;
}

export function BattleTimer({ elapsedSeconds, durationSeconds }: BattleTimerProps) {
  const remaining = Math.max(0, durationSeconds - elapsedSeconds);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isLow = remaining <= 30;
  const isCritical = remaining <= 10;

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
      <div
        className="px-3.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5"
        style={{
          background: isCritical ? "rgba(239,68,68,0.2)" : "rgba(0,0,0,0.7)",
          border: `2.5px solid ${isCritical ? "#ef4444" : isLow ? "#f59e0b80" : "rgba(255,255,255,0.2)"}`,
          boxShadow: isCritical
            ? "0 0 16px rgba(239,68,68,0.4)"
            : "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.05)",
          ...(isCritical ? { animation: "timer-pulse 0.5s ease-in-out infinite" } : {}),
        }}
      >
        {/* Clock dot */}
        <div
          className={`w-1.5 h-1.5 rounded-full ${isCritical ? "bg-red-400" : "bg-white/40"}`}
          style={isCritical ? { animation: "critical-pulse 0.6s infinite" } : undefined}
        />
        <span
          className={`text-sm font-black tabular-nums tracking-wider ${isCritical ? "text-red-400" : isLow ? "text-amber-400" : "text-white"}`}
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
        >
          {timeStr}
        </span>
      </div>
    </div>
  );
}
