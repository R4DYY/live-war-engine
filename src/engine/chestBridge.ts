import type { GiftEvent, NormalizedLiveEvent } from "@/live/types";
import { liveEventBus } from "@/live/liveEventBus";
import { chestManager } from "@/engine/chestManager";
import type { ChestEvent } from "@/engine/chestManager";

let unsubscribe: (() => void) | null = null;
let chestUnsubscribe: (() => void) | null = null;

function handleEvent(event: NormalizedLiveEvent): void {
  if (event.type === "LIKE") {
    chestManager.addLikes(event.likeCount);
  } else if (event.type === "GIFT") {
    handleChestGift(event);
  } else if (event.type === "CHEST_CONTRIBUTION") {
    chestManager.addContribution({
      userId: event.userId,
      username: event.username,
      team: (event.team === "A" || event.team === "B") ? event.team : "A",
      points: event.points,
    });
  }
}

function handleChestGift(event: GiftEvent): void {
  const mappings = chestManager.getConfig()?.chestGiftMappings;
  if (!mappings) return;
  const team = event.giftName === mappings.red.giftName
    ? "A"
    : event.giftName === mappings.blue.giftName
    ? "B"
    : null;
  if (!team) return;
  const giftCount = Math.max(1, event.repeatCount);
  const points = (team === "A" ? mappings.red.points : mappings.blue.points) * giftCount;
  chestManager.addContribution({
    userId: event.userId,
    username: event.username,
    team,
    points,
  });
}

export function startChestBridge(onChestEvent?: (event: ChestEvent) => void): void {
  if (unsubscribe) unsubscribe();
  unsubscribe = liveEventBus.subscribe(handleEvent);

  if (chestUnsubscribe) chestUnsubscribe();
  if (onChestEvent) {
    chestUnsubscribe = chestManager.subscribe(onChestEvent);
  }
}

export function stopChestBridge(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (chestUnsubscribe) {
    chestUnsubscribe();
    chestUnsubscribe = null;
  }
}
