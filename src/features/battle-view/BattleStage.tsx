import type { ReactNode } from "react";

interface BattleStageProps {
  children: ReactNode;
}

export function BattleStage({ children }: BattleStageProps) {
  return (
    <div className="battle-stage-container">
      <div
        className="relative bg-[var(--stage-bg)] overflow-hidden shadow-2xl"
        style={{
          aspectRatio: "9 / 16",
          height: "min(100vh, calc(100vw * 16 / 9))",
          maxWidth: "calc(100vh * 9 / 16)",
        }}
      >
        {/* Safe area padding wrapper */}
        <div
          className="absolute inset-0 flex flex-col"
          style={{
            paddingTop: "var(--safe-area-top)",
            paddingBottom: "var(--safe-area-bottom)",
            paddingLeft: "var(--safe-area-left)",
            paddingRight: "var(--safe-area-right)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
