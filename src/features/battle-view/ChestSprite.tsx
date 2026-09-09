import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { chestManager } from "@/engine/chestManager";
import type { ChestEvent, ChestRewardChoice, ChestSnapshot } from "@/engine/chestManager";
import { useEngineStore } from "@/state/engineStore";
import { RewardPopup } from "./RewardPopup";

interface ChestSpriteProps {
  teamAColor: string;
  teamBColor: string;
  teamAName?: string;
  teamBName?: string;
  snapshot?: ChestSnapshot | null;
}

type ParticleKind = "sparkle" | "orb" | "ring" | "star" | "mist" | "lightning" | "ember";

interface ParticleDefinition {
  id: number;
  kind: ParticleKind;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  rotation: number;
}

const WAIT_ASSETS = ["/ui/chest/wait-1.gif", "/ui/chest/wait-2.gif", "/ui/chest/wait-3.gif"];
const OPEN_ASSET = "/ui/chest/open-1.gif";
const OPEN_ANIMATION_MS = 2200;

function createParticles(): ParticleDefinition[] {
  const kinds: ParticleKind[] = [
    ...Array<ParticleKind>(18).fill("sparkle"),
    ...Array<ParticleKind>(16).fill("orb"),
    ...Array<ParticleKind>(6).fill("ring"),
    ...Array<ParticleKind>(14).fill("star"),
    ...Array<ParticleKind>(14).fill("mist"),
    ...Array<ParticleKind>(6).fill("lightning"),
    ...Array<ParticleKind>(12).fill("ember"),
  ];

  return kinds.map((kind, id) => ({
    id,
    kind,
    left: 5 + Math.random() * 90,
    top: 12 + Math.random() * 82,
    size: kind === "ring" ? 20 + Math.random() * 22 : 2 + Math.random() * (kind === "orb" ? 7 : 5),
    duration: kind === "mist" ? 3.8 + Math.random() * 3.2 : 1.5 + Math.random() * 2.8,
    delay: Math.random() * -5,
    drift: -24 + Math.random() * 48,
    rotation: Math.random() * 360,
  }));
}

function ParticleField({ active, battleMode, burstKey }: { active: boolean; battleMode: boolean; burstKey: number }) {
  const particles = useMemo(() => createParticles(), []);

  useEffect(() => {
    if (!active) return undefined;
    return () => undefined;
  }, [active, burstKey]);

  if (!active) return null;

  return (
    <>
      <div className="chest-ambient-flash" key={`ambient-${burstKey}`} aria-hidden="true" />
      <div className={`chest-particle-field ${battleMode ? "chest-particle-field--battle" : ""}`} aria-hidden="true">
        <div className="chest-aura chest-aura--outer" />
        <div className="chest-aura chest-aura--inner" />
        {particles.map((particle) => {
          const style = {
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            "--particle-drift": `${particle.drift}px`,
            "--particle-rotation": `${particle.rotation}deg`,
          } as CSSProperties;

          return <span key={particle.id} className={`chest-particle chest-particle--${particle.kind}`} style={style} />;
        })}
        <span className="chest-energy-ring chest-energy-ring--one" />
        <span className="chest-energy-ring chest-energy-ring--two" />
        {battleMode && <span className="chest-shockwave" key={`shockwave-${burstKey}`} />}
      </div>
    </>
  );
}

export function ChestSprite({ teamAColor, teamBColor, teamAName = "TEAM A", teamBName = "TEAM B", snapshot }: ChestSpriteProps) {
  const engineStatus = useEngineStore((state) => state.engineStatus);
  const [asset, setAsset] = useState(WAIT_ASSETS[0]);
  const [reward, setReward] = useState<ChestRewardChoice | null>(null);
  const [winnerState, setWinnerState] = useState<"A" | "B" | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [waitNonce, setWaitNonce] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSyncedVisual = useRef<string | undefined>(undefined);

  const localCycle = chestManager.getCycle();
  const useSynced = !localCycle && !!snapshot;
  const activeVisual = localCycle ? chestManager.getVisualState() : (snapshot?.visualState ?? "FILLING");
  const activeWinner = localCycle ? chestManager.getCycle()?.winner ?? null : (snapshot?.cycle?.winner ?? winnerState);
  const activeReward = localCycle ? chestManager.getCycle()?.selectedReward ?? null : (snapshot?.selectedReward ?? reward);
  const isSuddenDeath = localCycle ? chestManager.getCycle()?.suddenDeath ?? false : (snapshot?.cycle?.suddenDeath ?? false);
  const battleMode = engineStatus === "RUNNING" || engineStatus === "PAUSED";

  useEffect(() => {
    if (!useSynced || !snapshot) return;

    if (snapshot.cycle?.winner) setWinnerState(snapshot.cycle.winner);
    if (snapshot.selectedReward) setReward(snapshot.selectedReward);

    const enteredReveal = snapshot.visualState === "REWARD_REVEAL" && previousSyncedVisual.current !== "REWARD_REVEAL";
    previousSyncedVisual.current = snapshot.visualState;
    if (enteredReveal) {
      setAsset(OPEN_ASSET);
      setWaitNonce((nonce) => nonce + 1);
    }
    if (snapshot.selectedReward && enteredReveal) setPopupVisible(true);
    if (snapshot.visualState === "REWARD_ACTIVE" || snapshot.visualState === "FILLING") setPopupVisible(false);
  }, [snapshot, useSynced]);

  useEffect(() => {
    if (asset !== OPEN_ASSET) return undefined;
    const timer = setTimeout(() => {
      const next = WAIT_ASSETS[Math.floor(Math.random() * WAIT_ASSETS.length)];
      setAsset(next);
      setWaitNonce((nonce) => nonce + 1);
    }, OPEN_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [asset, waitNonce]);

  useEffect(() => {
    if (asset === OPEN_ASSET) return undefined;
    const timer = setTimeout(() => {
      const next = WAIT_ASSETS[Math.floor(Math.random() * WAIT_ASSETS.length)];
      setAsset(next);
      setWaitNonce((nonce) => nonce + 1);
    }, 2000 + Math.random() * 1000);
    return () => clearTimeout(timer);
  }, [asset]);

  useEffect(() => {
    const unsubscribe = chestManager.subscribe((event: ChestEvent) => {
      if (event.type === "CHEST_CYCLE_STARTED") {
        if (popupTimer.current) clearTimeout(popupTimer.current);
        setAsset(WAIT_ASSETS[Math.floor(Math.random() * WAIT_ASSETS.length)]);
        setWaitNonce((nonce) => nonce + 1);
        setReward(null);
        setWinnerState(null);
        setPopupVisible(false);
        setBurstKey((key) => key + 1);
      }
      if (event.type === "CHEST_CONTRIBUTION") {
        setBurstKey((key) => key + 1);
      }
      if (event.type === "CHEST_OPENING_STARTED") {
        setAsset(OPEN_ASSET);
        setWaitNonce((nonce) => nonce + 1);
        setWinnerState((event.payload.winner as "A" | "B" | null) ?? null);
        setBurstKey((key) => key + 1);
      }
      if (event.type === "CHEST_REWARD_SELECTED") {
        if (popupTimer.current) clearTimeout(popupTimer.current);
        const rewardType = event.payload.rewardType as ChestRewardChoice;
        setReward(rewardType);
        setPopupVisible(true);
        popupTimer.current = setTimeout(() => setPopupVisible(false), 2000);
      }
      if (event.type === "CHEST_REWARD_APPLIED") {
        if (popupTimer.current) clearTimeout(popupTimer.current);
        setPopupVisible(false);
      }
    });

    return () => {
      unsubscribe();
      if (popupTimer.current) clearTimeout(popupTimer.current);
    };
  }, []);

  const accent = isSuddenDeath
    ? "#f97316"
    : activeWinner === "A" ? teamAColor : activeWinner === "B" ? teamBColor : "#fbbf24";
  const showReveal = activeVisual === "REWARD_REVEAL" || activeVisual === "REWARD_ACTIVE";
  const showSuddenDeath = activeVisual === "SUDDEN_DEATH";
  const dismissPopup = useCallback(() => setPopupVisible(false), []);

  return (
    <div className="relative flex flex-col items-center justify-center shrink-0 w-[96px] min-h-[76px]">
      <ParticleField active={asset !== OPEN_ASSET} battleMode={battleMode} burstKey={burstKey} />
      <div
        className="absolute inset-x-0 top-0 bottom-0 rounded-xl pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${accent}20, transparent 70%)`,
          boxShadow: showReveal ? `0 0 24px ${accent}50` : showSuddenDeath ? `0 0 24px ${accent}50, 0 0 48px ${accent}25` : undefined,
          ...(showSuddenDeath ? { animation: "idle-blink 1.5s infinite" } : {}),
        }}
      />
      <img
        key={`${asset}-${waitNonce}`}
        src={asset}
        alt="Community chest"
        className="relative z-10 w-[84px] h-16 object-contain drop-shadow-lg"
        onError={(event) => {
          const image = event.currentTarget;
          image.src = WAIT_ASSETS[0];
        }}
      />
      <div className="relative z-10 text-[7px] font-black uppercase tracking-[0.12em]" style={{ color: showSuddenDeath ? accent : "rgba(255,255,255,0.6)" }}>
        {showSuddenDeath ? "SUDDEN DEATH" : activeVisual === "REWARD_ACTIVE" ? "ACTIVE" : showReveal ? "REVEAL" : "CHEST"}
      </div>
      {activeReward && (
        <RewardPopup
          reward={activeReward}
          teamColor={accent}
          teamName={activeWinner === "A" ? teamAName : activeWinner === "B" ? teamBName : "TEAM"}
          visible={popupVisible}
          onDismiss={dismissPopup}
        />
      )}
    </div>
  );
}
