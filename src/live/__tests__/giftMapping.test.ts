import { describe, it, expect } from "vitest";
import { mapGift, getMappingTable } from "@/live/giftMapper";

const baseViewer = { id: "u1", username: "viewer1" };

function mapByName(name: string, repeatCount = 1, coinValue?: number) {
  return mapGift({ giftName: name, repeatCount, coinValue, viewer: baseViewer });
}

function mapById(giftId: string, repeatCount = 1) {
  return mapGift({ giftId, repeatCount, viewer: baseViewer });
}

describe("giftMapper — 12 combat gift mappings", () => {
  it("Rose → A / T1 / 1 coin", () => {
    const r = mapByName("Rose");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("A");
    expect(r.combatGift!.tier).toBe("T1");
    expect(r.combatGift!.expectedCoins).toBe(1);
  });

  it("Ice Cream Cone → B / T1 / 1 coin", () => {
    const r = mapByName("Ice Cream Cone");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("B");
    expect(r.combatGift!.tier).toBe("T1");
    expect(r.combatGift!.expectedCoins).toBe(1);
  });

  it("Rosa → A / T2 / 10 coins", () => {
    const r = mapByName("Rosa");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("A");
    expect(r.combatGift!.tier).toBe("T2");
    expect(r.combatGift!.expectedCoins).toBe(10);
  });

  it("Friendship Necklace → B / T2 / 10 coins", () => {
    const r = mapByName("Friendship Necklace");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("B");
    expect(r.combatGift!.tier).toBe("T2");
    expect(r.combatGift!.expectedCoins).toBe(10);
  });

  it("Doughnut → A / T3 / 30 coins", () => {
    const r = mapByName("Doughnut");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("A");
    expect(r.combatGift!.tier).toBe("T3");
    expect(r.combatGift!.expectedCoins).toBe(30);
  });

  it("Energy Capsule → B / T3 / 30 coins", () => {
    const r = mapByName("Energy Capsule");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("B");
    expect(r.combatGift!.tier).toBe("T3");
    expect(r.combatGift!.expectedCoins).toBe(30);
  });

  it("Hearts → A / T4 / 199 coins", () => {
    const r = mapByName("Hearts");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("A");
    expect(r.combatGift!.tier).toBe("T4");
    expect(r.combatGift!.expectedCoins).toBe(199);
  });

  it("Sunglasses → B / T4 / 199 coins", () => {
    const r = mapByName("Sunglasses");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("B");
    expect(r.combatGift!.tier).toBe("T4");
    expect(r.combatGift!.expectedCoins).toBe(199);
  });

  it("Money Gun → A / T5 / 500 coins", () => {
    const r = mapByName("Money Gun");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("A");
    expect(r.combatGift!.tier).toBe("T5");
    expect(r.combatGift!.expectedCoins).toBe(500);
  });

  it("VR Goggles → B / T5 / 500 coins", () => {
    const r = mapByName("VR Goggles");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("B");
    expect(r.combatGift!.tier).toBe("T5");
    expect(r.combatGift!.expectedCoins).toBe(500);
  });

  it("Star of Red Carpet → A / T6 / 1999 coins", () => {
    const r = mapByName("Star of Red Carpet");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("A");
    expect(r.combatGift!.tier).toBe("T6");
    expect(r.combatGift!.expectedCoins).toBe(1999);
  });

  it("Mystery Firework → B / T6 / 1999 coins", () => {
    const r = mapByName("Mystery Firework");
    expect(r.status).toBe("MAPPED");
    expect(r.combatGift!.team).toBe("B");
    expect(r.combatGift!.tier).toBe("T6");
    expect(r.combatGift!.expectedCoins).toBe(1999);
  });
});

describe("giftMapper — name normalization", () => {
  it("ignores case and whitespace", () => {
    expect(mapByName("  rose  ").combatGift!.tier).toBe("T1");
    expect(mapByName("ROSE").combatGift!.tier).toBe("T1");
    expect(mapByName("  Ice  Cream Cone ").combatGift!.team).toBe("B");
  });

  it("Rose ≠ Rosa (different gifts)", () => {
    expect(mapByName("Rose").combatGift!.tier).toBe("T1");
    expect(mapByName("Rosa").combatGift!.tier).toBe("T2");
  });
});

describe("giftMapper — unknown gifts", () => {
  it("returns UNKNOWN_GIFT for unrecognized names", () => {
    const r = mapByName("Galaxy");
    expect(r.status).toBe("UNKNOWN_GIFT");
    expect(r.combatGift).toBeUndefined();
  });

  it("returns UNKNOWN_GIFT for unrecognized IDs", () => {
    const r = mapById("random_id_999");
    expect(r.status).toBe("UNKNOWN_GIFT");
  });
});

describe("giftMapper — streak / repeat", () => {
  it("quantity = repeatCount, not cumulative", () => {
    const r = mapByName("Rose", 5);
    expect(r.combatGift!.quantity).toBe(5);
  });

  it("quantity = 1 when repeatCount is 1", () => {
    const r = mapByName("Rose", 1);
    expect(r.combatGift!.quantity).toBe(1);
  });
});

describe("giftMapper — config table", () => {
  it("has exactly 12 mappings", () => {
    expect(getMappingTable().length).toBe(12);
  });

  it("6 red (A) + 6 blue (B)", () => {
    const table = getMappingTable();
    expect(table.filter((m) => m.team === "A").length).toBe(6);
    expect(table.filter((m) => m.team === "B").length).toBe(6);
  });

  it("one mapping per tier per team", () => {
    const table = getMappingTable();
    for (const tier of ["T1", "T2", "T3", "T4", "T5", "T6"]) {
      expect(table.filter((m) => m.tier === tier && m.team === "A").length).toBe(1);
      expect(table.filter((m) => m.tier === tier && m.team === "B").length).toBe(1);
    }
  });
});
