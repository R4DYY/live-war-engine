import type { BattleThemeId, TierId } from "@/domain/types";
import { getCharacterAssets, getPreloadList, teamToFolder, type CharacterAssets, type AssetState } from "./characterAssetResolver";
import type { ArenaTeam } from "@/simulation/types";

type Availability = "loading" | "available" | "missing";

interface CachedImage {
  img: HTMLImageElement;
  status: Availability;
}

const cache = new Map<string, CachedImage>();

// Subscribers notified whenever an image finishes loading (success or error).
// This lets the React layer re-render when a GIF becomes available.
const subscribers = new Set<() => void>();

function notify(): void {
  for (const fn of subscribers) fn();
}

function loadUrl(url: string): CachedImage {
  const existing = cache.get(url);
  if (existing) return existing;

  const img = new Image();
  const newEntry: CachedImage = { img, status: "loading" };
  img.onload = () => { newEntry.status = "available"; notify(); };
  img.onerror = () => { newEntry.status = "missing"; notify(); };
  img.src = url;
  cache.set(url, newEntry);
  return newEntry;
}

function getUrlStatus(url: string): Availability {
  return cache.get(url)?.status ?? "loading";
}

export function preloadThemeAssets(theme: BattleThemeId): void {
  clearImageCache();
  for (const assets of getPreloadList(theme)) {
    loadUrl(assets.idle);
    loadUrl(assets.walk);
    loadUrl(assets.attack);
    loadUrl(assets.shock);
  }
}

export function clearImageCache(): void {
  cache.clear();
  notify();
}

export function subscribeImageCache(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

/**
 * Returns the best asset URL for the given unit's visual state.
 *
 * Priority: requested state (if available or loading) → idle → null
 *
 * If the requested GIF is still loading, we return it anyway — the browser
 * will display the first frame and begin animating once it finishes loading.
 * This avoids falling back to the static PNG permanently while the GIF loads.
 */
export function resolveSpriteUrl(
  theme: BattleThemeId,
  team: ArenaTeam,
  tier: TierId,
  state: AssetState
): string | null {
  const folder = teamToFolder(team);
  const assets = getCharacterAssets(theme, folder, tier);
  return resolveByPriority(assets, state);
}

function resolveByPriority(assets: CharacterAssets, state: AssetState): string | null {
  const order: Record<AssetState, AssetState[]> = {
    idle: ["idle"],
    walk: ["walk", "idle"],
    attack: ["attack", "idle"],
    shock: ["shock", "attack", "idle"],
  };
  for (const s of order[state]) {
    const url = assets[s];
    const status = getUrlStatus(url);
    if (status === "available") return url;
  }
  // Requested asset is still loading — return it so it shows once loaded
  const requestedUrl = assets[state];
  if (getUrlStatus(requestedUrl) === "loading") return requestedUrl;
  // Fall back to idle if the requested asset is missing
  if (state !== "idle") {
    const idleStatus = getUrlStatus(assets.idle);
    if (idleStatus === "available" || idleStatus === "loading") return assets.idle;
  }
  return null;
}
