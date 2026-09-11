import { useEffect, useMemo, useRef, useState } from "react";
import { DUELS } from "@/data/duels";
import { getCommander } from "@/data/commanders";
import { useCountdown } from "@/hooks/useCountdown";
import type { DuelDefinition, CommanderDefinition } from "@/domain/types";
import { selectNextDuel, type SelectionResult } from "@/engine/nextGameSelector";
import EntityAvatar from "@/components/EntityAvatar";
import "./next-game-voting.css";

const VOTING_DUELS = DUELS.filter((duel) => duel.enabled);
const DEFAULT_VOTES = VOTING_DUELS.map((_, index) => 62 - ((index * 7) % 24));
const ANIMATION_DURATION_MS = 2500;
const SAFETY_TIMEOUT_MS = 3500;

interface NextGameVotingScreenProps {
  onBattleStarting?: (duel: DuelDefinition) => void;
  currentDuelId?: string | null;
  recentDuelIds?: string[];
}

export function NextGameVotingScreen({
  onBattleStarting,
  currentDuelId = null,
  recentDuelIds = [],
}: NextGameVotingScreenProps) {
  const { intermissionMs } = useCountdown();
  const [votes, setVotes] = useState<number[]>(DEFAULT_VOTES);
  const [leadPulseId, setLeadPulseId] = useState<string | null>(null);
  const [selectedDuel, setSelectedDuel] = useState<DuelDefinition | null>(null);
  const [selectionResult, setSelectionResult] = useState<SelectionResult | null>(null);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [animationDone, setAnimationDone] = useState(false);
  const selectionLockedRef = useRef(false);

  const secondsLeft = Math.max(0, Math.ceil(intermissionMs / 1000));
  const elapsedSeconds = Math.max(0, 10 - intermissionMs / 1000);
  const displayPhase = elapsedSeconds < 5 ? "next-game" : "vote-now";
  const isFinalCountdown = secondsLeft <= 3 && secondsLeft > 0;

  const leaderIndex = useMemo(
    () => votes.reduce((best, vote, index) => (vote > votes[best] ? index : best), 0),
    [votes]
  );
  const leader = VOTING_DUELS[leaderIndex];

  // Simulated vote drift
  useEffect(() => {
    if (selectedDuel || intermissionMs <= 0) return;
    const interval = window.setInterval(() => {
      setVotes((current) => {
        const next = [...current];
        const previousLeader = next.reduce((best, vote, index) => (vote > next[best] ? index : best), 0);
        const target = Math.floor(Math.random() * next.length);
        const direction = Math.random() > 0.42 ? 1 : -1;
        next[target] = Math.min(88, Math.max(18, next[target] + direction * (1 + Math.floor(Math.random() * 3))));
        const nextLeader = next.reduce((best, vote, index) => (vote > next[best] ? index : best), 0);
        if (nextLeader !== previousLeader) setLeadPulseId(VOTING_DUELS[nextLeader].id);
        return next;
      });
    }, 720);
    return () => window.clearInterval(interval);
  }, [intermissionMs, selectedDuel]);

  // Selection + animation when countdown ends
  useEffect(() => {
    if (selectionLockedRef.current || intermissionMs > 0) return;
    selectionLockedRef.current = true;

    const result = selectNextDuel({
      votes,
      currentDuelId,
      recentDuelIds,
    });

    setSelectionResult(result);
    setSelectedDuel(result.duel);

    const winnerIdx = VOTING_DUELS.findIndex((d) => d.id === result.duel.id);
    if (result.mode === "VOTED") {
      setAnimationDone(true);
      onBattleStarting?.(result.duel);
      return;
    }

    // Roulette animation for TIE_RANDOM and NO_VOTE_RANDOM
    const steps: number[] = [];
    const totalSteps = 14;
    for (let i = 0; i < totalSteps; i++) {
      steps.push(Math.floor(Math.random() * VOTING_DUELS.length));
    }
    steps[totalSteps - 2] = winnerIdx;
    steps[totalSteps - 1] = winnerIdx;

    let stepIdx = 0;
    const animate = () => {
      if (stepIdx >= steps.length) {
        setAnimatingIndex(null);
        setAnimationDone(true);
        onBattleStarting?.(result.duel);
        return;
      }
      setAnimatingIndex(steps[stepIdx]);
      stepIdx++;
      const delay = 80 + (stepIdx / steps.length) * 220;
      window.setTimeout(animate, delay);
    };

    animate();

    // Safety timeout — forces progression even if animation fails
    const safety = window.setTimeout(() => {
      setAnimationDone(true);
      onBattleStarting?.(result.duel);
    }, SAFETY_TIMEOUT_MS);

    return () => window.clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intermissionMs]);

  useEffect(() => {
    if (!leadPulseId) return;
    const timeout = window.setTimeout(() => setLeadPulseId(null), 1000);
    return () => window.clearTimeout(timeout);
  }, [leadPulseId]);

  const isRandomMode = selectionResult?.mode === "TIE_RANDOM" || selectionResult?.mode === "NO_VOTE_RANDOM";
  const showRoulette = isRandomMode && !animationDone;

  return (
    <div className="next-game-screen" aria-label="Next game voting">
      <div className="next-game-orb next-game-orb-left" />
      <div className="next-game-orb next-game-orb-right" />
      <header className="next-game-header">
        <span className="next-game-kicker">LIVE ARENA</span>
        <h1>{showRoulette ? "CHOOSING NEXT BATTLE..." : displayPhase === "next-game" ? "NEXT GAME" : "VOTE NOW"}</h1>
        <p>
          {showRoulette
            ? "RANDOM BATTLE"
            : displayPhase === "next-game"
            ? "COMING UP"
            : "CHOOSE THE NEXT BATTLE"}
        </p>
      </header>

      <main className={`next-game-grid ${selectedDuel && animationDone ? "next-game-grid-finished" : ""}`}>
        {VOTING_DUELS.map((duel, index) => {
          const isLeader = index === leaderIndex;
          const isWinner = selectedDuel?.id === duel.id && animationDone;
          const isLoser = Boolean(selectedDuel && animationDone && !isWinner);
          const isHighlighted = showRoulette && animatingIndex === index;
          const commanderA = getCommander(duel.commanderAId);
          const commanderB = getCommander(duel.commanderBId);
          const percentA = votes[index];
          const percentB = 100 - percentA;

          return (
            <button
              type="button"
              key={duel.id}
              className={`next-game-card ${isLeader ? "next-game-card-leader" : ""} ${leadPulseId === duel.id ? "next-game-card-pulse" : ""} ${isWinner ? "next-game-card-winner" : ""} ${isLoser ? "next-game-card-loser" : ""} ${isHighlighted ? "next-game-card-highlight" : ""} ${showRoulette && !isHighlighted ? "next-game-card-dim" : ""}`}
              onClick={() => {
                if (selectedDuel || displayPhase !== "vote-now" || showRoulette) return;
                setVotes((current) => current.map((vote, voteIndex) => voteIndex === index ? Math.min(88, vote + 6) : vote));
                setLeadPulseId(duel.id);
              }}
            >
              <div className="next-game-card-topline">
                {displayPhase === "vote-now" && leadPulseId === duel.id && <strong>TAKES THE LEAD</strong>}
              </div>
              <div className="next-game-contestants">
                <ContestantImage entity={commanderA} name={commanderA?.displayName ?? duel.commanderAId} team="red" />
                <span className="next-game-vs">VS</span>
                <ContestantImage entity={commanderB} name={commanderB?.displayName ?? duel.commanderBId} team="blue" />
              </div>
              <div className="next-game-names">
                <span>{commanderA?.displayName ?? duel.commanderAId}</span>
                <span>{commanderB?.displayName ?? duel.commanderBId}</span>
              </div>
              {!showRoulette && (
                <>
                  <div className="next-game-percentages">
                    <b>{percentA}%</b>
                    <b>{percentB}%</b>
                  </div>
                  <div className="next-game-vote-bar" aria-label={`${percentA}% versus ${percentB}%`}>
                    <span style={{ width: `${percentA}%` }} />
                    <span style={{ width: `${percentB}%` }} />
                  </div>
                </>
              )}
            </button>
          );
        })}
      </main>

      <footer className="next-game-footer">
        {selectedDuel && animationDone ? (
          <strong className="next-game-starting">{selectedDuel.displayName} — BATTLE STARTING</strong>
        ) : showRoulette ? (
          <span className="next-game-roulette-text">SELECTING...</span>
        ) : isFinalCountdown ? (
          <strong className="next-game-countdown-number">{secondsLeft}</strong>
        ) : (
          <span>NEXT BATTLE IN <strong>{String(secondsLeft).padStart(2, "0")}s</strong></span>
        )}
      </footer>
    </div>
  );
}

function ContestantImage({ entity, name, team }: { entity: CommanderDefinition | undefined; name: string; team: "red" | "blue" }) {
  return (
    <div className={`next-game-portrait next-game-portrait-${team}`}>
      <EntityAvatar entity={entity} label={name} size={58} className="h-full w-full" />
    </div>
  );
}
