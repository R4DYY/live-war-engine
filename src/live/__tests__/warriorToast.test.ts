import { describe, it, expect, beforeEach } from "vitest";
import { useWarriorStore } from "@/live/warriorStore";
import { useGiftToastStore } from "@/live/giftToastStore";
import { mapGift, type CombatGift } from "@/live/giftMapper";

function makeCombatGift(name: string, team: "A" | "B", tier: string, coins: number, qty: number, userId = "u1"): CombatGift {
  return {
    type: "COMBAT_GIFT",
    source: "TIKTOK",
    team,
    tier: tier as CombatGift["tier"],
    quantity: qty,
    giftId: name,
    giftName: name,
    expectedCoins: coins,
    viewer: { id: userId, username: `user_${userId}` },
  };
}

describe("WarriorStore — scoring", () => {
  beforeEach(() => useWarriorStore.getState().reset());

  it("Rose x1 → 1 coin contribution for Team A", () => {
    const gift = makeCombatGift("Rose", "A", "T1", 1, 1);
    useWarriorStore.getState().recordContribution(gift);
    const top3 = useWarriorStore.getState().getTop3("A");
    expect(top3[0].totalCoins).toBe(1);
    expect(top3[0].giftCount).toBe(1);
  });

  it("Rose x5 → 5 coins contribution", () => {
    const gift = makeCombatGift("Rose", "A", "T1", 1, 5);
    useWarriorStore.getState().recordContribution(gift);
    expect(useWarriorStore.getState().getTop3("A")[0].totalCoins).toBe(5);
  });

  it("Rosa x1 → 10 coins", () => {
    const gift = makeCombatGift("Rosa", "A", "T2", 10, 1);
    useWarriorStore.getState().recordContribution(gift);
    expect(useWarriorStore.getState().getTop3("A")[0].totalCoins).toBe(10);
  });

  it("Money Gun x1 → 500 coins", () => {
    const gift = makeCombatGift("Money Gun", "A", "T5", 500, 1);
    useWarriorStore.getState().recordContribution(gift);
    expect(useWarriorStore.getState().getTop3("A")[0].totalCoins).toBe(500);
  });

  it("Ice Cream Cone x1 → 1 coin for Team B", () => {
    const gift = makeCombatGift("Ice Cream Cone", "B", "T1", 1, 1);
    useWarriorStore.getState().recordContribution(gift);
    expect(useWarriorStore.getState().getTop3("B")[0].totalCoins).toBe(1);
    expect(useWarriorStore.getState().getTop3("A")).toHaveLength(0);
  });

  it("accumulates coins across multiple gifts from same viewer", () => {
    useWarriorStore.getState().recordContribution(makeCombatGift("Rose", "A", "T1", 1, 1, "alex"));
    useWarriorStore.getState().recordContribution(makeCombatGift("Rose", "A", "T1", 1, 1, "alex"));
    const top3 = useWarriorStore.getState().getTop3("A");
    expect(top3[0].totalCoins).toBe(2);
    expect(top3[0].giftCount).toBe(2);
  });

  it("ranking: A=500, C=199, B=30 → order A, C, B", () => {
    useWarriorStore.getState().recordContribution(makeCombatGift("Money Gun", "A", "T5", 500, 1, "A"));
    useWarriorStore.getState().recordContribution(makeCombatGift("Doughnut", "A", "T3", 30, 1, "B"));
    useWarriorStore.getState().recordContribution(makeCombatGift("Hearts", "A", "T4", 199, 1, "C"));
    const top3 = useWarriorStore.getState().getTop3("A");
    expect(top3[0].userId).toBe("A");
    expect(top3[1].userId).toBe("C");
    expect(top3[2].userId).toBe("B");
  });

  it("reset clears all warriors", () => {
    useWarriorStore.getState().recordContribution(makeCombatGift("Rose", "A", "T1", 1, 1));
    useWarriorStore.getState().reset();
    expect(useWarriorStore.getState().getTop3("A")).toHaveLength(0);
  });
});

describe("GiftToastStore — aggregation", () => {
  beforeEach(() => useGiftToastStore.getState().reset());

  it("creates a toast for a mapped gift", () => {
    const gift = makeCombatGift("Rose", "A", "T1", 1, 1);
    useGiftToastStore.getState().addToast(gift);
    expect(useGiftToastStore.getState().toasts).toHaveLength(1);
    expect(useGiftToastStore.getState().toasts[0].giftName).toBe("Rose");
    expect(useGiftToastStore.getState().toasts[0].actionLabel).toBe("TROOP DEPLOYED");
  });

  it("aggregates repeated low-tier gifts from same user", () => {
    const gift = makeCombatGift("Rose", "A", "T1", 1, 1, "alex");
    for (let i = 0; i < 10; i++) {
      useGiftToastStore.getState().addToast(gift);
    }
    const toasts = useGiftToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].quantity).toBe(10);
  });

  it("does NOT aggregate T4+ gifts", () => {
    const gift = makeCombatGift("Hearts", "A", "T4", 199, 1, "alex");
    useGiftToastStore.getState().addToast(gift);
    useGiftToastStore.getState().addToast(gift);
    expect(useGiftToastStore.getState().toasts).toHaveLength(2);
  });

  it("max 3 toasts visible", () => {
    for (let i = 0; i < 5; i++) {
      useGiftToastStore.getState().addToast(makeCombatGift("Hearts", "A", "T4", 199, 1, `user${i}`));
    }
    expect(useGiftToastStore.getState().toasts.length).toBeLessThanOrEqual(3);
  });
});

describe("Unknown gift — no warrior or toast impact", () => {
  beforeEach(() => {
    useWarriorStore.getState().reset();
    useGiftToastStore.getState().reset();
  });

  it("unknown gift produces no contribution", () => {
    const result = mapGift({ giftName: "Galaxy", repeatCount: 1, viewer: { id: "u1" } });
    expect(result.status).toBe("UNKNOWN_GIFT");
    expect(result.combatGift).toBeUndefined();
    expect(useWarriorStore.getState().getTop3("A")).toHaveLength(0);
    expect(useGiftToastStore.getState().toasts).toHaveLength(0);
  });
});
