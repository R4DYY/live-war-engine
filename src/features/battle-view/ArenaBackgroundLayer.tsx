import { useEffect, useState } from "react";
import type { BattleThemeDefinition } from "@/domain/types";

interface ArenaBackgroundLayerProps {
  theme: BattleThemeDefinition;
  backgroundUrl?: string | null;
}

export function ArenaBackgroundLayer({ theme, backgroundUrl }: ArenaBackgroundLayerProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [backgroundUrl]);

  const showImage = backgroundUrl && !imgError;

  return (
    <div className={`absolute inset-0 ${theme.arenaClassName ?? "arena-medieval"}`}>
      {/* Theme background image */}
      {showImage && (
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
        />
      )}

      {/* Deep vignette for readability and depth */}
      <div
        className="absolute inset-0"
        style={{
          background: showImage
            ? "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.65) 100%)"
            : "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Team territory zones — stronger gradient tints */}
      <div
        className="absolute left-0 right-0 top-0 h-2/5"
        style={{
          background: "linear-gradient(180deg, rgba(220,38,38,0.1), transparent)",
        }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 h-2/5"
        style={{
          background: "linear-gradient(0deg, rgba(37,99,235,0.1), transparent)",
        }}
      />

      {/* Lane markers — subtle vertical guides */}
      <div
        className="absolute top-1/4 bottom-1/4 left-1/4 w-px"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
      <div
        className="absolute top-1/4 bottom-1/4 right-1/4 w-px"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />

      {/* Midfield divider — glowing battle line */}
      <div
        className="absolute left-0 right-0 top-1/2 h-px"
        style={{
          background: "rgba(255,255,255,0.1)",
          boxShadow: "0 0 16px rgba(255,255,255,0.06), 0 0 32px rgba(255,255,255,0.03)",
        }}
      />
      {/* Midfield energy band */}
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-20"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.03), transparent)",
          animation: "energy-pulse 3s ease-in-out infinite",
        }}
      />

      {/* Ambient floating particles for atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              background: i % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
              left: `${10 + i * 11}%`,
              top: `${15 + (i % 4) * 20}%`,
              animation: `ambient-float ${3 + i * 0.4}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Top and bottom edge frame lines for arena depth */}
      <div
        className="absolute left-0 right-0 top-0 h-1"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.4), transparent)" }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 h-1"
        style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.4), transparent)" }}
      />
    </div>
  );
}

interface BaseRendererProps {
  side: "top" | "bottom";
  color: string;
  hpPct: number;
}

export function BaseRenderer({ side, color, hpPct }: BaseRendererProps) {
  const isCritical = hpPct <= 25;
  const yPos = side === "top" ? "top-3" : "bottom-3";

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 ${yPos} z-5`}>
      {/* Expanding pulse ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `2px solid ${color}40`,
          animation: "base-ring 2s ease-out infinite",
        }}
      />
      {/* Static outer glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `1px solid ${color}30`,
          transform: "scale(1.3)",
        }}
      />
      <div
        className="relative w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle, ${color}30, ${color}08)`,
          border: `2.5px solid ${color}`,
          boxShadow: isCritical
            ? `0 0 24px ${color}, 0 0 48px rgba(239,68,68,0.4)`
            : `0 0 16px ${color}50`,
          animation: isCritical ? "critical-pulse 0.6s infinite" : undefined,
        }}
      >
        {/* Inner shine */}
        <div
          className="absolute top-0 left-0 right-0 h-1/2 rounded-t-full"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.1), transparent)" }}
        />
        <span
          className="text-xl font-black relative z-10"
          style={{ color, textShadow: `0 0 8px ${color}, 0 2px 4px rgba(0,0,0,0.5)` }}
        >
          {side === "top" ? "A" : "B"}
        </span>
      </div>
    </div>
  );
}
