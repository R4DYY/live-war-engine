import { useEffect, useState } from "react";
import { chestManager } from "@/engine/chestManager";
import type { ChestEvent, ChestCycle } from "@/engine/chestManager";
import { Gift } from "lucide-react";

export function ChestWidget({ teamAColor, teamBColor }: { teamAColor: string; teamBColor: string }) {
  const [cycle, setCycle] = useState<ChestCycle | null>(chestManager.getCycle());
  const [progress, setProgress] = useState(0);
  const [visualState, setVisualState] = useState(chestManager.getVisualState());
  const [cta, setCta] = useState(chestManager.getCTAMessage());
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const unsub = chestManager.subscribe((evt: ChestEvent) => {
      setCycle(chestManager.getCycle());
      setProgress(chestManager.getProgress());
      setVisualState(chestManager.getVisualState());
      setCta(chestManager.getCTAMessage());
      if (evt.type === "CHEST_UNLOCKED") {
        setFlash(true);
        setTimeout(() => setFlash(false), 2000);
      }
    });
    setCycle(chestManager.getCycle());
    setProgress(chestManager.getProgress());
    setVisualState(chestManager.getVisualState());
    setCta(chestManager.getCTAMessage());
    return unsub;
  }, []);

  // Poll for reward expiry updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCycle(chestManager.getCycle());
      setProgress(chestManager.getProgress());
      setVisualState(chestManager.getVisualState());
      setCta(chestManager.getCTAMessage());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!cycle) return null;

  const percent = Math.round(progress * 100);
  const barWidth = `${Math.min(100, percent)}%`;
  const aLead = cycle.teamAContributions > cycle.teamBContributions;
  const bLead = cycle.teamBContributions > cycle.teamAContributions;
  const tied = cycle.teamAContributions === cycle.teamBContributions;

  const stateColor =
    visualState === "UNLOCKING" ? "text-amber-400"
    : visualState === "REWARD_ACTIVE" ? "text-emerald-400"
    : visualState === "NEAR_UNLOCK" ? "text-orange-400"
    : "text-zinc-400";

  return (
    <div className={`relative px-4 py-2 bg-black/40 backdrop-blur-sm border-b border-white/5 ${flash ? "animate-pulse" : ""}`}>
      <div className="flex items-center gap-3">
        {/* Chest icon */}
        <div className={`flex-shrink-0 ${flash ? "scale-125 transition-transform" : ""}`}>
          <Gift size={20} className={stateColor} />
        </div>

        {/* Progress bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Community Chest
            </span>
            <span className={`text-[10px] font-mono ${stateColor}`}>
              {percent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                visualState === "UNLOCKING" ? "bg-amber-500"
                : visualState === "NEAR_UNLOCK" ? "bg-orange-500"
                : "bg-gradient-to-r from-zinc-500 to-zinc-300"
              }`}
              style={{ width: barWidth }}
            />
          </div>
          {/* CTA message */}
          <div className={`text-[10px] mt-0.5 font-medium ${stateColor}`}>
            {cta}
          </div>
        </div>

        {/* Team contributions */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <div className="text-center">
            <div className="text-[9px] uppercase text-zinc-500 font-bold">A</div>
            <div className="text-xs font-mono font-bold" style={{ color: teamAColor }}>
              {cycle.teamAContributions}
            </div>
          </div>
          <div className="text-[9px] text-zinc-600">vs</div>
          <div className="text-center">
            <div className="text-[9px] uppercase text-zinc-500 font-bold">B</div>
            <div className="text-xs font-mono font-bold" style={{ color: teamBColor }}>
              {cycle.teamBContributions}
            </div>
          </div>
        </div>
      </div>

      {/* Lead indicator */}
      {(aLead || bLead || (tied && cycle.teamAContributions > 0)) && !cycle.unlocked && (
        <div className="text-[9px] text-center mt-0.5 text-zinc-500">
          {cycle.unlocked ? "" : aLead ? "TEAM A LEADS" : bLead ? "TEAM B LEADS" : "TIED"}
        </div>
      )}

      {/* Unlock flash banner */}
      {flash && cycle.winner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-2xl font-black tracking-wider" style={{ color: cycle.winner === "A" ? teamAColor : teamBColor }}>
              {cycle.winner === "A" ? "TEAM A" : "TEAM B"} WON THE CHEST
            </div>
            <div className="text-xs text-emerald-400 mt-1">x2 SPAWN ACTIVATED</div>
          </div>
        </div>
      )}
    </div>
  );
}
