import { describe, it, expect } from "vitest";
import { selectNextDuel, getEligibleDuels } from "@/engine/nextGameSelector";
import { DUELS } from "@/data/duels";

const allDuelIds = DUELS.filter((d) => d.enabled).map((d) => d.id);
const zeroVotes = allDuelIds.map(() => 0);

describe("nextGameSelector — no votes", () => {
  it("selects one eligible duel when 0 votes", () => {
    const result = selectNextDuel({ votes: zeroVotes, currentDuelId: null, recentDuelIds: [] });
    expect(result.duel).toBeDefined();
    expect(result.mode).toBe("NO_VOTE_RANDOM");
    expect(result.totalVotes).toBe(0);
  });

  it("does NOT systematically pick index 0", () => {
    const picks = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const result = selectNextDuel({ votes: zeroVotes, currentDuelId: null, recentDuelIds: [] });
      picks.add(result.duel.id);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe("nextGameSelector — votes exist", () => {
  it("A=10, B=4, C=0 → A always wins", () => {
    const votes = [...zeroVotes];
    votes[0] = 10;
    votes[1] = 4;
    votes[2] = 0;
    for (let i = 0; i < 20; i++) {
      const result = selectNextDuel({ votes, currentDuelId: null, recentDuelIds: [] });
      expect(result.duel.id).toBe(DUELS[0].id);
      expect(result.mode).toBe("VOTED");
    }
  });
});

describe("nextGameSelector — tie handling", () => {
  it("A=10, B=10, C=4 → random only between A and B", () => {
    const votes = [...zeroVotes];
    votes[0] = 10;
    votes[1] = 10;
    votes[2] = 4;
    const winners = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const result = selectNextDuel({ votes, currentDuelId: null, recentDuelIds: [] });
      expect([DUELS[0].id, DUELS[1].id]).toContain(result.duel.id);
      expect(result.mode).toBe("TIE_RANDOM");
      winners.add(result.duel.id);
    }
    expect(winners.size).toBe(2);
  });
});

describe("nextGameSelector — cooldown", () => {
  it("first duel under cooldown, 0 votes → first duel cannot be selected", () => {
    const recentDuelIds = [DUELS[0].id];
    for (let i = 0; i < 50; i++) {
      const result = selectNextDuel({ votes: zeroVotes, currentDuelId: null, recentDuelIds });
      expect(result.duel.id).not.toBe(DUELS[0].id);
    }
  });

  it("current duel excluded", () => {
    const currentId = DUELS[3].id;
    for (let i = 0; i < 50; i++) {
      const result = selectNextDuel({ votes: zeroVotes, currentDuelId: currentId, recentDuelIds: [] });
      expect(result.duel.id).not.toBe(currentId);
    }
  });
});

describe("nextGameSelector — single eligible", () => {
  it("only one eligible duel → that duel selected", () => {
    const recentDuelIds = DUELS.slice(1, DUELS.length - 1).map((d) => d.id);
    const currentDuelId = DUELS[DUELS.length - 1].id;
    const eligible = getEligibleDuels(currentDuelId, recentDuelIds);
    expect(eligible.length).toBe(1);
    const result = selectNextDuel({ votes: zeroVotes, currentDuelId, recentDuelIds });
    expect(result.duel.id).toBe(eligible[0].id);
  });
});

describe("nextGameSelector — zero eligible fallback", () => {
  it("all duels on cooldown → falls back to non-current enabled duels", () => {
    const currentDuelId = DUELS[0].id;
    const recentDuelIds = DUELS.slice(1).map((d) => d.id);
    const result = selectNextDuel({ votes: zeroVotes, currentDuelId, recentDuelIds });
    expect(result.duel).toBeDefined();
    expect(result.duel.id).not.toBe(currentDuelId);
  });
});

describe("nextGameSelector — logging", () => {
  it("logs NEXT_GAME_SELECTION with mode and winner", () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (msg: string) => logs.push(msg);
    selectNextDuel({ votes: zeroVotes, currentDuelId: null, recentDuelIds: [] });
    console.log = original;
    expect(logs.some((l) => l.includes("NEXT_GAME_SELECTION"))).toBe(true);
    expect(logs.some((l) => l.includes("mode=NO_VOTE_RANDOM"))).toBe(true);
  });
});
