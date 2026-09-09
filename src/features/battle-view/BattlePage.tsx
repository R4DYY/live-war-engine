import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useEngineStore } from "@/state/engineStore";
import { requestSync } from "@/state/sync";
import { useCountdown, formatTime } from "@/hooks/useCountdown";
import { getTheme } from "@/data/themes";
import { getCommander } from "@/data/commanders";
import EntityAvatar from "@/components/EntityAvatar";
import { preloadThemeAssets } from "@/engine/characterImageCache";
import { ArenaCanvas } from "./ArenaCanvas";
import { BattleStage } from "./BattleStage";
import { TeamHud } from "./TeamHud";
import { GiftRail } from "./GiftRail";
import { BattleTimer } from "./BattleTimer";
import { CommunityChest } from "./CommunityChest";
import { DynamicCTA } from "./DynamicCTA";
import { TopWarriors } from "./TopWarriors";
import { LiveEventBanner } from "./LiveEventBanner";
import { NextDuelPlaceholder } from "./NextDuelPlaceholder";
import { NextGameVotingScreen } from "./NextGameVotingScreen";
import { Trophy, RotateCcw, List } from "lucide-react";
import { ArenaBackgroundLayer, BaseRenderer } from "./ArenaBackgroundLayer";

export default function BattlePage() {
  const [searchParams] = useSearchParams();
  const debug = searchParams.get("debug") === "1";

  const engineStatus = useEngineStore((s) => s.engineStatus);
  const selectDuel = useEngineStore((s) => s.selectDuel);
  const setNextDuel = useEngineStore((s) => s.setNextDuel);
  const startSingleBattle = useEngineStore((s) => s.startSingleBattle);
  const resetEngine = useEngineStore((s) => s.resetEngine);
  const session = useEngineStore((s) => s.session);
  const simSnapshot = useEngineStore((s) => s.simSnapshot);
  const loop = useEngineStore((s) => s.loop);
  const battleBackgroundUrl = useEngineStore((s) => s.battleBackgroundUrl);
  const { intermissionMs, isInIntermission } = useCountdown();

  useEffect(() => {
    requestSync();
  }, []);

  useEffect(() => {
    if (session) preloadThemeAssets(session.config.battleThemeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.config.battleThemeId]);

  const isRunning = engineStatus === "RUNNING";
  const isEnded = engineStatus === "ENDED";
  const isIdle = engineStatus === "IDLE" || engineStatus === "READY";

  const theme = session ? getTheme(session.config.battleThemeId) : null;
  const topHpPct = simSnapshot.maxBaseHp > 0 ? (simSnapshot.topBaseHp / simSnapshot.maxBaseHp) * 100 : 0;
  const bottomHpPct = simSnapshot.maxBaseHp > 0 ? (simSnapshot.bottomBaseHp / simSnapshot.maxBaseHp) * 100 : 0;
  const isVoting = isEnded && loop.phase === "INTERMISSION" && !!loop.session;
  const winnerName = session?.winner === "A"
    ? session.config.teamA.displayName
    : session?.winner === "B"
    ? session.config.teamB.displayName
    : null;

  return (
    <BattleStage>
      {/* ─── TEAM A HUD (top) ─── */}
      {session && (
        <TeamHud
          team="A"
          config={session.config.teamA}
          baseHp={simSnapshot.topBaseHp}
          maxBaseHp={simSnapshot.maxBaseHp}
        />
      )}

      {/* ─── BATTLEFIELD (dominant center area) ─── */}
      <div className="relative min-h-0 overflow-hidden" style={{ flex: "65 1 0" }}>
        {/* World art layer — z-index 0, full battlefield */}
        {theme && (
          <div className="absolute inset-0 z-0">
            <ArenaBackgroundLayer theme={theme} backgroundUrl={battleBackgroundUrl} />
          </div>
        )}

        {/* Game entities layer (canvas) — z-index 1 */}
        {isRunning && (
          <div className="absolute inset-0 z-10">
            <ArenaCanvas debug={debug} hasBackgroundImage={!!battleBackgroundUrl} theme={session?.config.battleThemeId ?? null} />
          </div>
        )}

        {/* Base renderers */}
        {session && isRunning && (
          <>
            <BaseRenderer side="top" color={session.config.teamA.primaryColor} hpPct={topHpPct} />
            <BaseRenderer side="bottom" color={session.config.teamB.primaryColor} hpPct={bottomHpPct} />
          </>
        )}

        {/* Timer */}
        {isRunning && session && (
          <BattleTimer
            elapsedSeconds={simSnapshot.elapsedSeconds}
            durationSeconds={session.config.combat.durationSeconds}
          />
        )}

        {/* Gift rails — single bar PNG per side, mirrored, ~65% battlefield height */}
        {session && theme && isRunning && (
          <>
            <div className="absolute left-[12px] top-[18%] z-10" style={{ height: "65%" }}>
              <GiftRail
                teamColor={session.config.teamA.primaryColor}
                theme={theme}
                teamFolder="red"
                teamSide="A"
              />
            </div>
            <div className="absolute right-[12px] top-[18%] z-10" style={{ height: "65%" }}>
              <GiftRail
                teamColor={session.config.teamB.primaryColor}
                theme={theme}
                teamFolder="blue"
                teamSide="B"
              />
            </div>
          </>
        )}

        {/* Dynamic CTA */}
        {session && isRunning && (
          <DynamicCTA
            teamAColor={session.config.teamA.primaryColor}
            teamBColor={session.config.teamB.primaryColor}
            teamAName={session.config.teamA.displayName}
            teamBName={session.config.teamB.displayName}
            topHpPct={topHpPct}
            bottomHpPct={bottomHpPct}
          />
        )}

        {/* Live event banners */}
        {isRunning && <LiveEventBanner />}

        {/* Idle overlay */}
        {isIdle && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center space-y-3">
              <div
                className="text-2xl font-black tracking-widest text-white/60"
                style={{ animation: "idle-blink 2s infinite" }}
              >
                LIVE WAR ENGINE
              </div>
              <div className="text-xs text-white/40 tracking-wide uppercase">
                Waiting for battle to start...
              </div>
              <div className="flex justify-center gap-1 mt-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ended overlay */}
        {isEnded && session && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="text-center space-y-3">
              {simSnapshot.isDraw ? (
                <>
                  <Trophy className="mx-auto text-amber-400" size={42} />
                  <div className="text-2xl font-black tracking-wider text-amber-400">DRAW</div>
                </>
              ) : (
                <>
                  <EntityAvatar
                    entity={getCommander(session.winner === "A" ? session.config.teamA.commanderId : session.config.teamB.commanderId)}
                    label={winnerName ?? "Winner"}
                    size={80}
                    className="mx-auto border-2 border-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
                    fallbackColor="#fbbf24"
                  />
                  <Trophy className="mx-auto text-amber-300" size={42} style={{ animation: "reward-glow 1.4s ease-in-out infinite" }} />
                  <div className="text-xs font-bold tracking-widest text-white/50 uppercase">Victory</div>
                  <div className="text-3xl font-black tracking-wider" style={{ color: session.winner === "A" ? session.config.teamA.primaryColor : session.config.teamB.primaryColor }}>
                    {winnerName}
                  </div>
                  <div className="text-xs text-white/40">
                    {session.endReason === "BASE_DESTROYED" ? "Base Destroyed" : "Time Expired"}
                  </div>
                  <div className="text-[11px] text-white/55">
                    {session.config.teamA.displayName} {Math.round(simSnapshot.topBaseHp)} — {Math.round(simSnapshot.bottomBaseHp)} {session.config.teamB.displayName}
                  </div>
                </>
              )}
              {loop.session && (isInIntermission || loop.phase === "RESULT" || loop.phase === "STOPPING") && (
                <div className="text-xs text-white/40 mt-2 animate-pulse">
                  {isInIntermission
                    ? `Next battle in ${formatTime(intermissionMs)}`
                    : loop.phase === "STOPPING"
                    ? "Loop stopping after this round"
                    : "Round complete"}
                </div>
              )}
              {!loop.session && (
                <div className="flex gap-2 justify-center pt-2">
                  <button type="button" onClick={() => { selectDuel(session.config.duelId); startSingleBattle(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/25">
                    <RotateCcw size={13} /> Replay
                  </button>
                  <button type="button" onClick={resetEngine} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/20">
                    <List size={13} /> Duel Selection
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {isVoting && <NextGameVotingScreen onBattleStarting={(duel) => setNextDuel(duel.id)} />}

        {/* Debug overlay */}
        {debug && isRunning && (
          <div className="absolute top-2 left-2 bg-black/70 text-[10px] text-white font-mono p-2 rounded space-y-0.5 z-40">
            <div>Units: {simSnapshot.units.length}</div>
            <div>Top T1: {simSnapshot.metrics.topByTier?.T1?.alive ?? 0} / T2: {simSnapshot.metrics.topByTier?.T2?.alive ?? 0}</div>
            <div>Bot T1: {simSnapshot.metrics.bottomByTier?.T1?.alive ?? 0} / T2: {simSnapshot.metrics.bottomByTier?.T2?.alive ?? 0}</div>
            <div>Top firing: T1 {simSnapshot.metrics.topByTier?.T1?.fighting ?? 0} / T2 {simSnapshot.metrics.topByTier?.T2?.fighting ?? 0}</div>
            <div>Bot firing: T1 {simSnapshot.metrics.bottomByTier?.T1?.fighting ?? 0} / T2 {simSnapshot.metrics.bottomByTier?.T2?.fighting ?? 0}</div>
            <div>Base: {Math.round(simSnapshot.topBaseHp)} / {Math.round(simSnapshot.bottomBaseHp)}</div>
            <div>Time: {simSnapshot.elapsedSeconds.toFixed(1)}s</div>
            <div>Speed: {simSnapshot.speed}x</div>
            <div>Projectiles: {simSnapshot.projectiles.length}</div>
            <div>Theme: {session?.config.battleThemeId ?? "(none)"}</div>
            <div>Background: {battleBackgroundUrl ?? "(default)"}</div>
          </div>
        )}
      </div>

      {/* ─── TEAM B HUD (bottom) ─── */}
      {session && (
        <TeamHud
          team="B"
          config={session.config.teamB}
          baseHp={simSnapshot.bottomBaseHp}
          maxBaseHp={simSnapshot.maxBaseHp}
          isBottom
        />
      )}

      {/* ─── LOWER HUB: Warriors + Chest + Warriors ─── */}
      {session && isRunning && (
        <>
          <div
            className="flex items-stretch gap-1 px-1.5 py-1 min-h-0"
            style={{
              flex: "35 1 0",
              background: "var(--stage-surface-2)",
              borderTop: "2px solid rgba(255,255,255,0.06)",
            }}
>
            <TopWarriors
              teamName={session.config.teamA.displayName}
              teamColor={session.config.teamA.primaryColor}
              side="left"
              warriors={[]}
            />
            <div className="flex-1 min-w-0">
              <CommunityChest
                teamAColor={session.config.teamA.primaryColor}
                teamBColor={session.config.teamB.primaryColor}
                teamAName={session.config.teamA.displayName}
                teamBName={session.config.teamB.displayName}
              />
            </div>
            <TopWarriors
              teamName={session.config.teamB.displayName}
              teamColor={session.config.teamB.primaryColor}
              side="right"
              warriors={[]}
            />
          </div>

          <div
            className="flex items-center justify-center px-2 py-0.5"
            style={{
              background: "var(--stage-surface-2)",
              borderTop: "1.5px solid rgba(255,255,255,0.05)",
            }}
          >
            <NextDuelPlaceholder visible={!!loop.session} />
          </div>
        </>
      )}

    </BattleStage>
  );
}
