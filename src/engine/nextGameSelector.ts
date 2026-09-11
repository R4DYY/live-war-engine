import { DUELS, getDuel } from "@/data/duels";
import type { DuelDefinition } from "@/domain/types";

export type SelectionMode = "VOTED" | "TIE_RANDOM" | "NO_VOTE_RANDOM";

export interface SelectionResult {
  duel: DuelDefinition;
  mode: SelectionMode;
  eligibleCount: number;
  totalVotes: number;
  tiedLeaders: DuelDefinition[];
}

export interface SelectInput {
  votes: number[];
  currentDuelId: string | null;
  recentDuelIds: string[];
  maxRecentCooldown?: number;
}

const DEFAULT_COOLDOWN = 3;

export function getEligibleDuels(
  currentDuelId: string | null,
  recentDuelIds: string[]
): DuelDefinition[] {
  const recentSet = new Set(recentDuelIds);
  return DUELS.filter((d) => {
    if (!d.enabled) return false;
    if (currentDuelId && d.id === currentDuelId) return false;
    if (recentSet.has(d.id)) return false;
    return true;
  });
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function selectNextDuel(input: SelectInput): SelectionResult {
  const { votes, currentDuelId, recentDuelIds } = input;
  const eligible = getEligibleDuels(currentDuelId, recentDuelIds);

  const totalVotes = votes.reduce((sum, v) => sum + Math.max(0, v), 0);

  if (totalVotes > 0 && eligible.length > 0) {
    const maxVotes = Math.max(...votes);
    const leaders = eligible.filter((_, i) => votes[i] === maxVotes);

    if (leaders.length === 1) {
      logSelection("VOTED", leaders[0], eligible.length, totalVotes, leaders);
      return { duel: leaders[0], mode: "VOTED", eligibleCount: eligible.length, totalVotes, tiedLeaders: leaders };
    }

    const winner = randomFrom(leaders);
    logSelection("TIE_RANDOM", winner, eligible.length, totalVotes, leaders);
    return { duel: winner, mode: "TIE_RANDOM", eligibleCount: eligible.length, totalVotes, tiedLeaders: leaders };
  }

  if (eligible.length === 0) {
    const fallback = DUELS.filter((d) => d.enabled && d.id !== currentDuelId);
    const pool = fallback.length > 0 ? fallback : DUELS.filter((d) => d.enabled);
    const winner = randomFrom(pool);
    logSelection("NO_VOTE_RANDOM", winner, pool.length, 0, []);
    return { duel: winner, mode: "NO_VOTE_RANDOM", eligibleCount: pool.length, totalVotes: 0, tiedLeaders: [] };
  }

  if (eligible.length === 1) {
    logSelection("NO_VOTE_RANDOM", eligible[0], 1, 0, []);
    return { duel: eligible[0], mode: "NO_VOTE_RANDOM", eligibleCount: 1, totalVotes: 0, tiedLeaders: [] };
  }

  const winner = randomFrom(eligible);
  logSelection("NO_VOTE_RANDOM", winner, eligible.length, 0, []);
  return { duel: winner, mode: "NO_VOTE_RANDOM", eligibleCount: eligible.length, totalVotes: 0, tiedLeaders: [] };
}

function logSelection(mode: SelectionMode, duel: DuelDefinition, eligibleCount: number, totalVotes: number, tiedLeaders: DuelDefinition[]): void {
  console.log(
    `NEXT_GAME_SELECTION mode=${mode} winner=${duel.id} eligibleCount=${eligibleCount} totalVotes=${totalVotes}${tiedLeaders.length > 1 ? ` tiedLeaders=${tiedLeaders.map((d) => d.id).join(",")}` : ""}`
  );
}

export function buildRecentDuelHistory(
  recentDuelIds: string[],
  currentDuelId: string,
  maxCooldown: number = DEFAULT_COOLDOWN
): string[] {
  const updated = [currentDuelId, ...recentDuelIds.filter((id) => id !== currentDuelId)];
  return updated.slice(0, maxCooldown);
}
