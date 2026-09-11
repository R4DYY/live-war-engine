import { X, Eye } from "lucide-react";
import { BattleStage } from "@/features/battle-view/BattleStage";
import { TeamHud } from "@/features/battle-view/TeamHud";
import { BattleTimer } from "@/features/battle-view/BattleTimer";
import { GiftRail } from "@/features/battle-view/GiftRail";
import { TopWarriors } from "@/features/battle-view/TopWarriors";
import { CommunityChest } from "@/features/battle-view/CommunityChest";
import { NextDuelPlaceholder } from "@/features/battle-view/NextDuelPlaceholder";
import { DynamicCTA } from "@/features/battle-view/DynamicCTA";
import { getTheme } from "@/data/themes";
import { createDefaultBattleConfig } from "@/data/defaults";

interface BattlePreviewOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function BattlePreviewOverlay({ open, onClose }: BattlePreviewOverlayProps) {
  if (!open) return null;

  const config = createDefaultBattleConfig();
  const theme = getTheme(config.battleThemeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
      >
        <X size={16} />
        Close
      </button>

      <div className="flex flex-col items-center gap-3 max-h-screen overflow-auto py-4">
        <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-widest font-bold">
          <Eye size={14} />
          Battle Interface Preview
        </div>

        <BattleStage>
          <TeamHud
            team="A"
            config={config.teamA}
            baseHp={75000}
            maxBaseHp={100000}
          />

          <div className="relative min-h-0 overflow-hidden" style={{ flex: "65 1 0" }}>
            <div
              className="absolute inset-0 z-0"
              style={{
                background: `linear-gradient(180deg, ${config.teamA.primaryColor}18 0%, #0a0a14 50%, ${config.teamB.primaryColor}18 100%)`,
              }}
            />

            <BattleTimer
              elapsedSeconds={145}
              durationSeconds={config.combat.durationSeconds}
            />

            <div className="absolute left-[12px] top-[18%] z-10" style={{ height: "65%" }}>
              <GiftRail
                teamColor={config.teamA.primaryColor}
                theme={theme}
                teamFolder="red"
                teamSide="A"
              />
            </div>
            <div className="absolute right-[12px] top-[18%] z-10" style={{ height: "65%" }}>
              <GiftRail
                teamColor={config.teamB.primaryColor}
                theme={theme}
                teamFolder="blue"
                teamSide="B"
              />
            </div>

            <DynamicCTA
              teamAColor={config.teamA.primaryColor}
              teamBColor={config.teamB.primaryColor}
              teamAName={config.teamA.displayName}
              teamBName={config.teamB.displayName}
              topHpPct={75}
              bottomHpPct={62}
            />

            <div className="absolute inset-0 flex items-center justify-center z-5">
              <div className="text-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/15">
                  Preview Mode
                </div>
                <div className="text-[8px] text-white/10 mt-1">
                  No live simulation
                </div>
              </div>
            </div>
          </div>

          <TeamHud
            team="B"
            config={config.teamB}
            baseHp={62000}
            maxBaseHp={100000}
            isBottom
          />

          <div
            className="flex items-stretch gap-1 px-1.5 py-1 min-h-0"
            style={{ flex: "35 1 0", background: "var(--stage-surface-2)", borderTop: "2px solid rgba(255,255,255,0.06)" }}
          >
            <TopWarriors
              teamName={config.teamA.displayName}
              teamColor={config.teamA.primaryColor}
              side="left"
              warriors={[]}
            />
            <div className="flex-1 min-w-0">
              <CommunityChest
                teamAColor={config.teamA.primaryColor}
                teamBColor={config.teamB.primaryColor}
                teamAName={config.teamA.displayName}
                teamBName={config.teamB.displayName}
              />
            </div>
            <TopWarriors
              teamName={config.teamB.displayName}
              teamColor={config.teamB.primaryColor}
              side="right"
              warriors={[]}
            />
          </div>

          <div
            className="flex items-center justify-center px-2 py-0.5"
            style={{ background: "var(--stage-surface-2)", borderTop: "1.5px solid rgba(255,255,255,0.05)" }}
          >
            <NextDuelPlaceholder visible />
          </div>
        </BattleStage>
      </div>
    </div>
  );
}
