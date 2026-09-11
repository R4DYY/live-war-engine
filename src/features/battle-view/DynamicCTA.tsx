import { useEffect, useState } from "react";
import { chestManager } from "@/engine/chestManager";
import type { ChestEvent } from "@/engine/chestManager";

interface DynamicCTAProps {
  teamAColor: string;
  teamBColor: string;
  teamAName: string;
  teamBName: string;
  topHpPct: number;
  bottomHpPct: number;
}

interface Banner {
  id: number;
  text: string;
  color: string;
  priority: number;
}

let bannerId = 0;

function getDefaultCTA(topHpPct: number, bottomHpPct: number, teamAName: string, teamBName: string, teamAColor: string, teamBColor: string): Banner {
  if (topHpPct <= 25 && topHpPct > 0) {
    return { id: 0, text: `${teamAName.toUpperCase()} BASE CRITICAL`, color: "#ef4444", priority: 2 };
  }
  if (bottomHpPct <= 25 && bottomHpPct > 0) {
    return { id: 0, text: `${teamBName.toUpperCase()} BASE CRITICAL`, color: "#ef4444", priority: 2 };
  }
  if (topHpPct > bottomHpPct + 15) {
    return { id: 0, text: `${teamAName.toUpperCase()} LEADS`, color: teamAColor, priority: 1 };
  }
  if (bottomHpPct > topHpPct + 15) {
    return { id: 0, text: `${teamBName.toUpperCase()} LEADS`, color: teamBColor, priority: 1 };
  }
  return { id: 0, text: "LIKE TO UNLOCK THE CHEST", color: "#fbbf24", priority: 0 };
}

export function DynamicCTA({ teamAColor, teamBColor, teamAName, teamBName, topHpPct, bottomHpPct }: DynamicCTAProps) {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const unsub = chestManager.subscribe((evt: ChestEvent) => {
      if (evt.type === "CHEST_UNLOCKED") {
        const winner = evt.payload.winner as string | null;
        if (winner === "A") {
          setBanner({ id: ++bannerId, text: `${teamAName} UNLOCKED THE CHEST`, color: teamAColor, priority: 5 });
        } else if (winner === "B") {
          setBanner({ id: ++bannerId, text: `${teamBName} UNLOCKED THE CHEST`, color: teamBColor, priority: 5 });
        } else {
          setBanner({ id: ++bannerId, text: "CHEST TIED", color: "#f59e0b", priority: 3 });
        }
      } else if (evt.type === "CHEST_REWARD_APPLIED") {
        const team = evt.payload.team as string;
        setBanner({
          id: ++bannerId,
          text: `${team === "A" ? teamAName : teamBName} x2 SPAWN BOOST`,
          color: team === "A" ? teamAColor : teamBColor,
          priority: 4,
        });
      }
    });
    return unsub;
  }, [teamAColor, teamBColor, teamAName, teamBName]);

  // Critical base alerts
  useEffect(() => {
    if (topHpPct <= 25 && topHpPct > 0) {
      setBanner({ id: ++bannerId, text: `${teamAName} BASE CRITICAL`, color: "#ef4444", priority: 2 });
    }
  }, [topHpPct, teamAName]);

  useEffect(() => {
    if (bottomHpPct <= 25 && bottomHpPct > 0) {
      setBanner({ id: ++bannerId, text: `${teamBName} BASE CRITICAL`, color: "#ef4444", priority: 2 });
    }
  }, [bottomHpPct, teamBName]);

  // Auto-dismiss
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 2500);
    return () => clearTimeout(timer);
  }, [banner]);

  // Show default CTA when no event banner is active
  const display = banner ?? getDefaultCTA(topHpPct, bottomHpPct, teamAName, teamBName, teamAColor, teamBColor);

  return (
    <div
      key={display.id}
      className="absolute top-11 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full backdrop-blur-md max-w-[80%]"
      style={{
        background: "rgba(0,0,0,0.75)",
        border: `1.5px solid ${display.color}55`,
        boxShadow: `0 0 8px ${display.color}25, 0 2px 5px rgba(0,0,0,0.35)`,
        ...(banner ? { animation: "banner-slide-in 2.5s forwards" } : {}),
      }}
    >
      <span
        className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
        style={{ color: display.color, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
      >
        {display.text}
      </span>
    </div>
  );
}
