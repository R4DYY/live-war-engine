import { describe, expect, it } from "vitest";
import { TikTokEventDeduplicator } from "@/live/tiktokEventDeduplicator";
import { TikTokGiftStreakResolver } from "@/live/tiktokGiftStreakResolver";

describe("TikTok live pipeline helpers", () => {
  it("resolves a repeat gift as incremental quantities", () => {
    const resolver = new TikTokGiftStreakResolver();
    expect(resolver.resolve({ key: "room:user:gift", repeatCount: 1 })).toBe(1);
    expect(resolver.resolve({ key: "room:user:gift", repeatCount: 2 })).toBe(1);
    expect(resolver.resolve({ key: "room:user:gift", repeatCount: 5, repeatEnd: true })).toBe(3);
  });

  it("does not count the final x1 event twice", () => {
    const resolver = new TikTokGiftStreakResolver();
    expect(resolver.resolve({ key: "room:user:gift", repeatCount: 1 })).toBe(1);
    expect(resolver.resolve({ key: "room:user:gift", repeatCount: 1, repeatEnd: true })).toBe(0);
  });

  it("drops duplicate upstream event ids", () => {
    const deduplicator = new TikTokEventDeduplicator();
    expect(deduplicator.accept("event-1")).toBe(true);
    expect(deduplicator.accept("event-1")).toBe(false);
    expect(deduplicator.dropped).toBe(1);
  });
});
