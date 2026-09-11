import { create } from "zustand";
import type { CombatGift } from "@/live/giftMapper";
import type { TeamSide } from "@/live/types";

export interface GiftToast {
  id: string;
  username: string;
  giftName: string;
  actionLabel: string;
  team: TeamSide;
  quantity: number;
  createdAt: number;
}

const MAX_VISIBLE = 3;
const TOAST_TTL_MS = 2800;
const AGGREGATE_WINDOW_MS = 1500;
const HIGH_TIER = new Set(["T4", "T5", "T6"]);

const TIER_ACTION: Record<string, string> = {
  T1: "TROOP DEPLOYED",
  T2: "SPECIALIST DEPLOYED",
  T3: "HEALER DEPLOYED",
  T4: "BREAKER DEPLOYED",
  T5: "BOSS SUMMONED",
  T6: "ULTIMATE ACTIVATED",
};

interface ToastStore {
  toasts: GiftToast[];
  addToast: (combatGift: CombatGift) => void;
  dismiss: (id: string) => void;
  reset: () => void;
}

let toastSeq = 0;

export const useGiftToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (combatGift) => {
    const { viewer, giftName, tier, team, quantity } = combatGift;
    const username = viewer.username ?? "unknown";
    const actionLabel = TIER_ACTION[tier] ?? "GIFT RECEIVED";
    const now = Date.now();

    // Try to aggregate with a recent toast from the same user + same gift
    if (!HIGH_TIER.has(tier)) {
      const existing = get().toasts.find(
        (t) =>
          t.username === username &&
          t.giftName === giftName &&
          t.team === team &&
          now - t.createdAt < AGGREGATE_WINDOW_MS
      );
      if (existing) {
        set({
          toasts: get().toasts.map((t) =>
            t.id === existing.id
              ? { ...t, quantity: t.quantity + quantity, createdAt: now }
              : t
          ),
        });
        return;
      }
    }

    const id = `toast-${++toastSeq}`;
    const toast: GiftToast = {
      id,
      username,
      giftName,
      actionLabel,
      team,
      quantity,
      createdAt: now,
    };

    let next = [...get().toasts, toast];
    if (next.length > MAX_VISIBLE) next = next.slice(next.length - MAX_VISIBLE);

    set({ toasts: next });

    setTimeout(() => {
      get().dismiss(id);
    }, TOAST_TTL_MS);
  },

  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  reset: () => set({ toasts: [] }),
}));
