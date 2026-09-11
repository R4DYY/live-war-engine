import { useEffect, useState } from "react";
import { useEngineStore } from "@/state/engineStore";

interface BannerState {
  id: string;
  text: string;
  subtext?: string;
  color: string;
  priority: number;
  size: "small" | "medium" | "large" | "mega";
}

const EVENT_BANNERS: Record<string, (payload: Record<string, unknown>) => BannerState | null> = {
  UNIT_SPAWNED: (p) => {
    const tier = p.tier as string;
    const source = p.source as string;
    const team = p.team as string;
    if (source !== "VIEWER_GIFT" && source !== "LIVE") return null;
    const tierConfig: Record<string, { label: string; size: BannerState["size"]; priority: number }> = {
      T1: { label: "REINFORCEMENTS SENT", size: "small", priority: 1 },
      T2: { label: "SPECIALIST DEPLOYED", size: "small", priority: 1 },
      T3: { label: "HEALER DEPLOYED", size: "medium", priority: 2 },
      T4: { label: "BREAKER DEPLOYED", size: "medium", priority: 3 },
      T5: { label: "BOSS SUMMONED", size: "large", priority: 4 },
      T6: { label: "ULTIMATE UNLEASHED", size: "mega", priority: 5 },
    };
    const config = tierConfig[tier];
    if (!config) return null;
    return {
      id: `spawn-${p.unitId ?? Math.random()}`,
      text: config.label,
      subtext: `@${p.username ?? "VIEWER"}`,
      color: team === "top" ? "#dc2626" : "#2563eb",
      priority: config.priority,
      size: config.size,
    };
  },
  CHEST_UNLOCKED: (p) => {
    const winner = p.winner as string | null;
    if (!winner) return null;
    return {
      id: `chest-${p.chestCycleId}`,
      text: "CHEST UNLOCKED",
      subtext: winner === "A" ? "TEAM A WINS" : winner === "B" ? "TEAM B WINS" : undefined,
      color: "#fbbf24",
      priority: 4,
      size: "large",
    };
  },
  BASE_DESTROYED: () => ({
    id: `base-destroyed-${Date.now()}`,
    text: "BASE DESTROYED",
    color: "#ef4444",
    priority: 5,
    size: "mega",
  }),
  BATTLE_RESULT: (p) => {
    const winner = p.winner as string | null;
    return {
      id: `result-${Date.now()}`,
      text: winner ? "VICTORY" : "DRAW",
      color: winner === "top" ? "#dc2626" : winner === "bottom" ? "#2563eb" : "#f59e0b",
      priority: 5,
      size: "mega",
    };
  },
};

const SIZE_STYLES: Record<BannerState["size"], {
  padding: string; text: string; subtext: string; glow: string; border: string;
  animation: string;
}> = {
  small: { padding: "px-3 py-1", text: "text-[10px]", subtext: "text-[8px]", glow: "0 0 6px", border: "2px", animation: "banner-slide-in 3s forwards" },
  medium: { padding: "px-4 py-1.5", text: "text-xs", subtext: "text-[9px]", glow: "0 0 12px", border: "2.5px", animation: "banner-slide-in 3s forwards" },
  large: { padding: "px-5 py-2.5", text: "text-base", subtext: "text-[10px]", glow: "0 0 20px", border: "3px", animation: "banner-bounce 3s forwards" },
  mega: { padding: "px-6 py-3.5", text: "text-xl", subtext: "text-xs", glow: "0 0 28px", border: "3.5px", animation: "banner-bounce 3s forwards" },
};

export function LiveEventBanner() {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const events = useEngineStore((s) => s.events);

  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    const handler = EVENT_BANNERS[latest.type];
    if (!handler) return;
    const newBanner = handler(latest.payload ?? {});
    if (!newBanner) return;
    setBanner((prev) => {
      if (prev && prev.priority > newBanner.priority) return prev;
      return newBanner;
    });
  }, [events]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 3000);
    return () => clearTimeout(timer);
  }, [banner]);

  if (!banner) return null;

  const styles = SIZE_STYLES[banner.size];

  return (
    <div
      key={banner.id}
      className={`absolute top-20 left-1/2 -translate-x-1/2 z-30 ${styles.padding} rounded-xl backdrop-blur-md max-w-[85%]`}
      style={{
        background: "rgba(0,0,0,0.88)",
        border: `${styles.border} solid ${banner.color}`,
        boxShadow: `${styles.glow} ${banner.color}50, 0 4px 12px rgba(0,0,0,0.5)`,
        animation: styles.animation,
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={`${styles.text} font-black uppercase tracking-wider whitespace-nowrap`}
          style={{ color: banner.color, textShadow: `0 1px 3px rgba(0,0,0,0.9), 0 0 8px ${banner.color}40` }}
        >
          {banner.text}
        </span>
        {banner.subtext && (
          <span className={`${styles.subtext} font-bold uppercase tracking-wide text-white/70`}>
            {banner.subtext}
          </span>
        )}
      </div>
    </div>
  );
}
