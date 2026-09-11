import { useEffect, useState } from "react";
import type { ChestRewardChoice } from "@/engine/chestManager";
import { REWARD_ICON_PATHS, REWARD_INFO } from "@/engine/chestManager";

interface RewardPopupProps {
  reward: ChestRewardChoice;
  teamColor: string;
  teamName: string;
  visible: boolean;
  durationMs?: number;
  onDismiss?: () => void;
}

export function RewardPopup({ reward, teamColor, teamName, visible, durationMs = 2000, onDismiss }: RewardPopupProps) {
  const [iconError, setIconError] = useState(false);
  const info = REWARD_INFO[reward];
  const iconPath = REWARD_ICON_PATHS[reward];

  useEffect(() => {
    if (!visible) return;
    setIconError(false);
    const timer = setTimeout(() => onDismiss?.(), durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="absolute z-40 left-1/2 -translate-x-1/2 -top-2 -translate-y-full w-48 rounded-xl px-3 py-2.5 text-center backdrop-blur-md"
      style={{
        background: "rgba(8,10,16,0.96)",
        border: `2px solid ${teamColor}`,
        boxShadow: `0 0 24px ${teamColor}60, 0 4px 16px rgba(0,0,0,0.6)`,
        animation: "slide-up-fade 0.25s ease-out",
      }}
    >
      <div
        className="text-[9px] font-black uppercase tracking-widest mb-1"
        style={{ color: teamColor, textShadow: `0 0 8px ${teamColor}50` }}
      >
        {teamName} REWARD
      </div>
      <div className="flex items-center justify-center gap-2">
        {!iconError ? (
          <img
            src={iconPath}
            alt={info.title}
            className="w-12 h-12 object-contain drop-shadow-lg"
            onError={() => setIconError(true)}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${teamColor}20`, border: `2px solid ${teamColor}50` }}
          >
            <span className="text-lg font-black" style={{ color: teamColor }}>
              {info.title.charAt(0)}
            </span>
          </div>
        )}
        <div className="text-left">
          <div className="text-sm font-black uppercase tracking-wide text-white">{info.title}</div>
          <div className="text-[8px] font-bold uppercase text-white/55 mt-0.5">{info.detail}</div>
        </div>
      </div>
    </div>
  );
}
