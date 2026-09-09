import { useEffect, useRef, useState } from "react";
import type { BattleThemeDefinition, BattleThemeId, TierId } from "@/domain/types";
import { TIER_IDS } from "@/domain/types";
import type { TeamFolder } from "@/engine/characterAssetResolver";
import { liveEventBus } from "@/live/liveEventBus";
import type { GiftEvent } from "@/live/types";

const GIFT_TIER_MAP: Record<string, TierId> = {
  sim_t1: "T1",
  sim_t2: "T2",
  sim_t3: "T3",
  sim_t4: "T4",
  sim_t5: "T5",
  sim_t6: "T6",
};

const TRIGGER_DURATION = 350;

function getBarIconPath(theme: BattleThemeId, team: TeamFolder): string {
  return `/ui/icons/${theme}/${team}-bar.png`;
}

function getTierIconPath(theme: BattleThemeId, team: TeamFolder, tier: TierId): string {
  return `/ui/icons/${theme}/${team}/${tier}.png`;
}

interface GiftRailProps {
  teamColor: string;
  theme: BattleThemeDefinition;
  teamFolder: TeamFolder;
  teamSide: "A" | "B";
}

export function GiftRail({ teamColor, theme, teamFolder, teamSide }: GiftRailProps) {
  const barPath = getBarIconPath(theme.id, teamFolder);
  const [error, setError] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const triggerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = liveEventBus.subscribe((event) => {
      if (event.type !== "GIFT") return;
      const gift = event as GiftEvent;
      const mappedTier = GIFT_TIER_MAP[gift.giftId];
      if (!mappedTier) return;
      const eventTeam = gift.team;
      if (eventTeam && eventTeam !== teamSide && eventTeam !== "NONE") return;
      setTriggered(true);
      if (triggerTimer.current) clearTimeout(triggerTimer.current);
      triggerTimer.current = setTimeout(() => setTriggered(false), TRIGGER_DURATION);
    });
    return () => {
      unsub();
      if (triggerTimer.current) clearTimeout(triggerTimer.current);
    };
  }, [teamSide]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-around py-1">
        {TIER_IDS.map((tier) => (
          <div key={tier} className="flex h-full min-h-0 w-[104px] items-center justify-center">
            <img
              src={getTierIconPath(theme.id, teamFolder, tier)}
              alt=""
              className="max-h-[64px] max-w-[96px] object-contain"
              style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.65))" }}
              draggable={false}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <img
      src={barPath}
      alt={`${teamFolder} gift rail`}
      className="h-full w-auto object-contain"
      style={{
        objectPosition: "center",
        transform: triggered ? "scale(1.03)" : "scale(1)",
        transition: "transform 0.18s ease-out",
        filter: triggered
          ? `drop-shadow(0 2px 3px rgba(0,0,0,0.65)) drop-shadow(0 0 10px ${teamColor}60)`
          : `drop-shadow(0 2px 3px rgba(0,0,0,0.65)) drop-shadow(0 0 2px ${teamColor}20)`,
      }}
      onError={() => setError(true)}
      draggable={false}
    />
  );
}
