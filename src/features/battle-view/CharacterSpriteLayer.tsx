import { memo, useState, useEffect, useRef } from "react";
import type { BattleThemeId, TierId } from "@/domain/types";
import { ARENA_WIDTH, ARENA_HEIGHT } from "@/simulation/constants";
import { getUnitVisualState } from "@/simulation/arenaRenderer";
import { resolveSpriteUrl, subscribeImageCache } from "@/engine/characterImageCache";
import { useEngineStore } from "@/state/engineStore";
import type { ArenaTeam } from "@/simulation/types";

interface SpriteEntry {
  id: number;
  theme: BattleThemeId;
  team: ArenaTeam;
  tier: string;
  tierId: TierId;
  mirror: boolean;
  x: number;
  y: number;
  radius: number;
  visualState: ReturnType<typeof getUnitVisualState>;
  shockKey: number;
}

interface CharacterSpriteLayerProps {
  theme: BattleThemeId | null;
  canvasWidth: number;
  canvasHeight: number;
}

const TIER_HEIGHT_MULT: Record<string, number> = {
  T1: 5.2,
  T2: 5.85,
  T3: 5.2,
  T4: 6.5,
  T5: 7.8,
};

const SHOCK_DURATION_MS = 1000;

export const CharacterSpriteLayer = memo(function CharacterSpriteLayer({
  theme,
  canvasWidth,
  canvasHeight,
}: CharacterSpriteLayerProps) {
  const snapshot = useEngineStore((s) => s.simSnapshot);
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeImageCache(() => setTick((t) => t + 1));
  }, []);

  const scaleX = canvasWidth / ARENA_WIDTH;
  const scaleY = canvasHeight / ARENA_HEIGHT;

  const entries: SpriteEntry[] = [];
  if (theme) {
    for (const u of snapshot.units) {
      if (u.state === "DEAD" || u.state === "SPAWNING") continue;
      if (u.tier === "T6") continue;

      const tierId = u.tier as TierId;
      const visualState = getUnitVisualState(u);

      entries.push({
        id: u.id,
        theme,
        team: u.team,
        tier: u.tier,
        tierId,
        mirror: u.team === "bottom",
        x: u.x * scaleX,
        y: u.y * scaleY,
        radius: u.radius * Math.min(scaleX, scaleY),
        visualState,
        shockKey: u.slamCount,
      });
    }
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {entries.map((e) => (
        <CharacterSprite key={e.id} entry={e} />
      ))}
    </div>
  );
});

const CharacterSprite = memo(function CharacterSprite({ entry }: { entry: SpriteEntry }) {
  const heightMult = TIER_HEIGHT_MULT[entry.tier] ?? 4;
  const targetH = entry.radius * heightMult;

  const prevShockKey = useRef(entry.shockKey);
  const [shockNonce, setShockNonce] = useState(0);
  const [showShock, setShowShock] = useState(false);
  const shockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (entry.shockKey !== prevShockKey.current) {
      prevShockKey.current = entry.shockKey;
      setShowShock(true);
      setShockNonce((n) => n + 1);
      if (shockTimer.current) clearTimeout(shockTimer.current);
      shockTimer.current = setTimeout(() => setShowShock(false), SHOCK_DURATION_MS);
    }
  }, [entry.shockKey]);

  useEffect(() => {
    return () => {
      if (shockTimer.current) clearTimeout(shockTimer.current);
    };
  }, []);

  const isShock = showShock && entry.tier === "T5";
  const state = isShock ? "shock" : entry.visualState;
  const url = resolveSpriteUrl(entry.theme, entry.team, entry.tierId, state);

  if (!url) return null;

  return (
    <img
      key={isShock ? `shock-${shockNonce}` : `normal-${entry.id}`}
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: "absolute",
        left: `${entry.x}px`,
        top: `${entry.y}px`,
        width: "auto",
        height: `${targetH}px`,
        transform: `translate(-50%, -100%)${entry.mirror ? " scaleY(-1)" : ""}`,
        transformOrigin: "bottom center",
        objectFit: "contain",
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
});
