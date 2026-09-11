import { useEffect, useRef, useState } from "react";
import { chestManager } from "@/engine/chestManager";
import type { ChestEvent } from "@/engine/chestManager";
import { useEngineStore } from "@/state/engineStore";
import { ChestSprite } from "./ChestSprite";

interface CommunityChestProps {
  teamAColor: string;
  teamBColor: string;
  teamAName: string;
  teamBName: string;
}

interface PlusOne {
  id: number;
  team: "A" | "B";
}

export function CommunityChest({ teamAColor, teamBColor, teamAName, teamBName }: CommunityChestProps) {
  const syncedSnapshot = useEngineStore((s) => s.chestSnapshot);
  const engineStatus = useEngineStore((s) => s.engineStatus);

  const [flash, setFlash] = useState(false);
  const [plusOnes, setPlusOnes] = useState<PlusOne[]>([]);
  const plusOneId = useRef(0);
  const pollTick = useRef(0);

  const isRunning = engineStatus === "RUNNING";
  const localCycle = chestManager.getCycle();
  const useSynced = !localCycle && !!syncedSnapshot;
  const activeCycle = localCycle ?? syncedSnapshot?.cycle ?? null;
  const activeProgress = localCycle ? chestManager.getProgress() : (syncedSnapshot?.progress ?? 0);
  const activeVisual = localCycle ? chestManager.getVisualState() : (syncedSnapshot?.visualState ?? "FILLING");
  const activeCta = localCycle ? chestManager.getCTAMessage() : (syncedSnapshot?.cta ?? "");

  useEffect(() => {
    if (!isRunning) return;
    const unsub = chestManager.subscribe((evt: ChestEvent) => {
      if (evt.type === "CHEST_UNLOCKED") {
        setFlash(true);
        setTimeout(() => setFlash(false), 2000);
      }
      if (evt.type === "CHEST_CONTRIBUTION") {
        const team = evt.payload.team as "A" | "B";
        const id = ++plusOneId.current;
        setPlusOnes((prev) => [...prev, { id, team }]);
        setTimeout(() => {
          setPlusOnes((prev) => prev.filter((p) => p.id !== id));
        }, 700);
      }
    });
    return unsub;
  }, [isRunning]);

  useEffect(() => {
    const interval = setInterval(() => {
      pollTick.current++;
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!activeCycle) return null;

  const percent = Math.round(activeProgress * 100);
  const barWidth = `${Math.min(100, percent)}%`;
  const a = activeCycle.teamAContributions;
  const b = activeCycle.teamBContributions;
  const total = a + b;
  const redShare = total === 0 ? 50 : (a / total) * 100;
  const blueShare = total === 0 ? 50 : (b / total) * 100;
  const isSuddenDeath = activeCycle.suddenDeath;
  const isAlmostReady = activeProgress >= 0.8 && !activeCycle.unlocked;

  const stateColor =
    activeVisual === "UNLOCKING" || activeVisual === "REWARD_REVEAL" ? "#fbbf24"
    : activeVisual === "REWARD_ACTIVE" ? "#34d399"
    : activeVisual === "SUDDEN_DEATH" ? "#f97316"
    : activeVisual === "NEAR_UNLOCK" ? "#f97316"
    : "#9ca0b0";

  const barGradient = activeVisual === "UNLOCKING" || activeVisual === "REWARD_REVEAL"
    ? "linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)"
    : activeVisual === "NEAR_UNLOCK" || isAlmostReady
    ? "linear-gradient(90deg, #ea580c, #f97316, #fb923c)"
    : activeVisual === "REWARD_ACTIVE"
    ? "linear-gradient(90deg, #059669, #10b981, #34d399)"
    : "linear-gradient(90deg, #4b5563, #6b7280, #9ca0b0)";

  const chestGlow = isSuddenDeath
    ? `0 0 24px ${"#f97316"}60, 0 0 48px ${"#f97316"}30`
    : isAlmostReady
    ? `0 0 20px ${"#f97316"}40, 0 0 40px ${"#f97316"}20`
    : activeVisual === "REWARD_REVEAL" || activeVisual === "UNLOCKING"
    ? `0 0 24px ${"#fbbf24"}50, 0 0 48px ${"#fbbf24"}25`
    : activeVisual === "REWARD_ACTIVE"
    ? `0 0 20px ${"#34d399"}40`
    : `0 0 10px rgba(251,191,36,0.15)`;

  return (
    <div
      className="relative z-20 px-1.5 py-1 rounded-lg backdrop-blur-md flex flex-col"
      style={{
        background: "var(--stage-surface)",
        border: "2px solid rgba(255,255,255,0.08)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        ...(flash ? { animation: "chest-flash 0.5s 3" } : {}),
      }}
    >
      {/* ── Row 1: Title + Like progress ── */}
      <div className="flex items-center gap-1 mb-0.5">
        <span
          className="text-[7px] font-black uppercase tracking-[0.1em] text-white/75"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          Community Chest
        </span>
        <span
          className="text-[6px] font-bold uppercase tracking-wide ml-auto"
          style={{ color: isAlmostReady ? "#f97316" : "#9ca0b0" }}
        >
          {isAlmostReady && !activeCycle.unlocked ? "ALMOST READY" : "LIKE TO UNLOCK"}
        </span>
      </div>

      <div
        className="relative h-2.5 rounded-md overflow-hidden mb-0.5"
        style={{
          background: "rgba(0,0,0,0.6)",
          border: "2px solid rgba(255,255,255,0.1)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="h-full rounded-sm transition-all duration-300 relative overflow-hidden"
          style={{
            width: barWidth,
            background: barGradient,
            boxShadow: activeVisual === "REWARD_ACTIVE" ? "0 0 10px #34d399" : undefined,
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1/2"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.2), transparent)" }}
          />
          <div className="sheen-overlay" />
        </div>
        <div
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-mono font-black tabular-nums"
          style={{ color: stateColor, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
        >
          {activeCycle.currentLikes.toLocaleString()} / {chestManager.getConfig()?.likeThreshold.toLocaleString() ?? "10,000"}
        </div>
      </div>

      {/* ── Row 2: Large Chest centered ── */}
      <div className="relative flex items-center justify-center mb-0.5" style={{ minHeight: 52 }}>
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${stateColor}15, transparent 70%)`,
            boxShadow: chestGlow,
            transition: "box-shadow 0.4s ease",
          }}
        />
        <ChestSprite
          teamAColor={teamAColor}
          teamBColor={teamBColor}
          teamAName={teamAName}
          teamBName={teamBName}
          snapshot={useSynced ? syncedSnapshot : null}
        />
      </div>

      {/* ── Row 3: Chest Battle label ── */}
      <div className="text-center mb-0.5">
        <span
          className="text-[6px] font-black uppercase tracking-[0.12em]"
          style={{
            color: isSuddenDeath ? "#f97316" : "#9ca0b0",
            textShadow: isSuddenDeath ? "0 0 8px rgba(249,115,22,0.5)" : undefined,
            ...(isSuddenDeath ? { animation: "idle-blink 1.5s infinite" } : {}),
          }}
        >
          {isSuddenDeath ? "NEXT GIFT WINS" : "Chest Battle"}
        </span>
      </div>

      {/* ── Row 4: Scores + shared ownership bar ── */}
      <div className="relative">
        {/* Scores */}
        <div className="flex items-center justify-between mb-0.5">
          <span
            className="text-sm font-black tabular-nums leading-none"
            style={{
              color: a >= b && a > 0 ? teamAColor : "#6b7280",
              textShadow: a > 0 ? `0 0 8px ${teamAColor}40` : undefined,
            }}
          >
            {a}
          </span>
          <span className="text-[6px] font-black text-white/25 uppercase tracking-wider">vs</span>
          <span
            className="text-sm font-black tabular-nums leading-none"
            style={{
              color: b >= a && b > 0 ? teamBColor : "#6b7280",
              textShadow: b > 0 ? `0 0 8px ${teamBColor}40` : undefined,
            }}
          >
            {b}
          </span>
        </div>

        {/* Shared ownership bar with side icons */}
        <div className="flex items-center gap-0.5">
          <img
            src="/ui/chest/red-chest-icon.png"
            alt=""
            className="shrink-0 pointer-events-none"
            style={{ width: "20%", maxWidth: 56, minWidth: 32, height: "auto", objectFit: "contain" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div
            className="relative h-2 rounded-full overflow-hidden flex flex-1"
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "2px solid rgba(255,255,255,0.1)",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="h-full transition-all duration-500 ease-out relative overflow-hidden"
              style={{
                width: `${redShare}%`,
                background: `linear-gradient(90deg, ${teamAColor}cc, ${teamAColor})`,
                boxShadow: a > 0 ? `0 0 8px ${teamAColor}40` : undefined,
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1/2"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.15), transparent)" }}
              />
            </div>
            <div
              className="h-full transition-all duration-500 ease-out relative overflow-hidden"
              style={{
                width: `${blueShare}%`,
                background: `linear-gradient(90deg, ${teamBColor}, ${teamBColor}cc)`,
                boxShadow: b > 0 ? `0 0 8px ${teamBColor}40` : undefined,
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1/2"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.15), transparent)" }}
              />
            </div>
            {/* Center divider */}
            <div
              className="absolute top-0 bottom-0 left-1/2 w-px"
              style={{ background: "rgba(255,255,255,0.2)", transform: "translateX(-50%)" }}
            />
          </div>
          <img
            src="/ui/chest/blue-chest-icon.png"
            alt=""
            className="shrink-0 pointer-events-none"
            style={{ width: "20%", maxWidth: 56, minWidth: 32, height: "auto", objectFit: "contain" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* +1 feedback animations */}
        {plusOnes.map((p) => (
          <div
            key={p.id}
            className="absolute top-0 pointer-events-none"
            style={{
              left: p.team === "A" ? "8%" : "auto",
              right: p.team === "B" ? "8%" : "auto",
              animation: "chest-plusone 0.7s ease-out forwards",
            }}
          >
            <span
              className="text-xs font-black"
              style={{
                color: p.team === "A" ? teamAColor : teamBColor,
                textShadow: `0 0 8px ${p.team === "A" ? teamAColor : teamBColor}80`,
              }}
            >
              +1
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {activeCta && !isSuddenDeath && (
        <div className="text-center mt-0.5">
          <span
            className="text-[7px] font-black uppercase tracking-wide"
            style={{ color: stateColor, textShadow: `0 0 6px ${stateColor}40` }}
          >
            {activeCta}
          </span>
        </div>
      )}

      {/* Unlock flash */}
      {flash && activeCycle.winner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20 rounded-lg">
          <div className="text-center">
            <div
              className="text-base font-black tracking-wider"
              style={{ color: activeCycle.winner === "A" ? teamAColor : teamBColor, textShadow: `0 0 12px ${activeCycle.winner === "A" ? teamAColor : teamBColor}` }}
            >
              {activeCycle.winner === "A" ? teamAName : teamBName} WON THE CHEST
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
