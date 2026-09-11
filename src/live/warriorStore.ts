import { create } from "zustand";
import type { TeamSide } from "@/live/types";
import type { CombatGift } from "@/live/giftMapper";

export interface WarriorContribution {
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  team: TeamSide;
  totalCoins: number;
  giftCount: number;
  lastGiftAt: number;
  firstSeenAt: number;
}

interface WarriorStore {
  teamA: WarriorContribution[];
  teamB: WarriorContribution[];

  recordContribution: (combatGift: CombatGift) => void;
  recordChestContribution: (input: {
    userId: string;
    username?: string;
    nickname?: string;
    avatarUrl?: string;
    team: TeamSide;
    coins: number;
  }) => void;
  getTop3: (team: TeamSide) => WarriorContribution[];
  reset: () => void;
}

function sortWarriors(list: WarriorContribution[]): WarriorContribution[] {
  return [...list].sort((a, b) => {
    if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
    if (b.giftCount !== a.giftCount) return b.giftCount - a.giftCount;
    return a.firstSeenAt - b.firstSeenAt;
  });
}

export const useWarriorStore = create<WarriorStore>((set, get) => ({
  teamA: [],
  teamB: [],

  recordContribution: (combatGift) => {
    const { viewer, team, expectedCoins, quantity } = combatGift;
    const userId = viewer.id ?? viewer.username ?? "unknown";
    const coins = expectedCoins * quantity;
    const list = team === "A" ? get().teamA : get().teamB;
    const existing = list.find((w) => w.userId === userId);
    let updated: WarriorContribution[];

    if (existing) {
      updated = list.map((w) =>
        w.userId === userId
          ? {
              ...w,
              totalCoins: w.totalCoins + coins,
              giftCount: w.giftCount + 1,
              lastGiftAt: Date.now(),
              username: viewer.username ?? w.username,
              nickname: viewer.nickname ?? w.nickname,
              avatarUrl: viewer.avatarUrl ?? w.avatarUrl,
            }
          : w
      );
    } else {
      updated = [
        ...list,
        {
          userId,
          username: viewer.username ?? "unknown",
          nickname: viewer.nickname,
          avatarUrl: viewer.avatarUrl,
          team,
          totalCoins: coins,
          giftCount: 1,
          lastGiftAt: Date.now(),
          firstSeenAt: Date.now(),
        },
      ];
    }

    if (team === "A") set({ teamA: sortWarriors(updated).slice(0, 50) });
    else set({ teamB: sortWarriors(updated).slice(0, 50) });
  },

  recordChestContribution: (input) => {
    const { userId, username, nickname, avatarUrl, team, coins } = input;
    const list = team === "A" ? get().teamA : get().teamB;
    const existing = list.find((w) => w.userId === userId);
    let updated: WarriorContribution[];

    if (existing) {
      updated = list.map((w) =>
        w.userId === userId
          ? { ...w, totalCoins: w.totalCoins + coins, lastGiftAt: Date.now() }
          : w
      );
    } else {
      updated = [
        ...list,
        {
          userId,
          username: username ?? "unknown",
          nickname,
          avatarUrl,
          team,
          totalCoins: coins,
          giftCount: 0,
          lastGiftAt: Date.now(),
          firstSeenAt: Date.now(),
        },
      ];
    }

    if (team === "A") set({ teamA: sortWarriors(updated).slice(0, 50) });
    else set({ teamB: sortWarriors(updated).slice(0, 50) });
  },

  getTop3: (team) => {
    const list = team === "A" ? get().teamA : get().teamB;
    return sortWarriors(list).slice(0, 3);
  },

  reset: () => set({ teamA: [], teamB: [] }),
}));
