import { useRef, useEffect, useCallback, useState } from "react";
import { useEngineStore } from "@/state/engineStore";
import { renderArena } from "@/simulation/arenaRenderer";
import { ARENA_WIDTH, ARENA_HEIGHT } from "@/simulation/constants";
import type { BattleThemeId } from "@/domain/types";
import { CharacterSpriteLayer } from "./CharacterSpriteLayer";

export function ArenaCanvas({ debug = false, hasBackgroundImage = false, theme = null }: { debug?: boolean; hasBackgroundImage?: boolean; theme?: BattleThemeId | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const dimRef = useRef({ width: 0, height: 0 });
  const [dims, setDims] = useState({ width: 0, height: 0 });

  const updateSize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Fit arena aspect ratio into container
    const arenaAspect = ARENA_WIDTH / ARENA_HEIGHT;
    const containerAspect = rect.width / rect.height;

    let drawW: number, drawH: number;
    if (containerAspect > arenaAspect) {
      drawH = rect.height;
      drawW = drawH * arenaAspect;
    } else {
      drawW = rect.width;
      drawH = drawW / arenaAspect;
    }

    canvas.width = drawW * dpr;
    canvas.height = drawH * dpr;
    canvas.style.width = `${drawW}px`;
    canvas.style.height = `${drawH}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    dimRef.current = { width: drawW, height: drawH };
    setDims({ width: drawW, height: drawH });
  }, []);

  useEffect(() => {
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateSize]);

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const snap = useEngineStore.getState().simSnapshot;
      const { width, height } = dimRef.current;
      if (width > 0 && height > 0) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderArena(ctx, snap, width, height, debug, hasBackgroundImage, theme);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [debug, hasBackgroundImage, theme]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
    >
      <div className="relative" style={{ width: dims.width, height: dims.height }}>
        <canvas ref={canvasRef} className="block" />
        {theme && dims.width > 0 && (
          <CharacterSpriteLayer
            theme={theme}
            canvasWidth={dims.width}
            canvasHeight={dims.height}
          />
        )}
      </div>
    </div>
  );
}
