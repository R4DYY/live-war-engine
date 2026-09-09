import type { BattleThemeId } from "@/domain/types";

const MAX_IMAGES = 5;
const BASE_PATH = "/background";

const themeCache = new Map<BattleThemeId, string[]>();
const lastSelected = new Map<BattleThemeId, string>();

function buildCandidates(themeId: BattleThemeId): string[] {
  const cached = themeCache.get(themeId);
  if (cached) return cached;

  const candidates: string[] = [];
  for (let i = 1; i <= MAX_IMAGES; i++) {
    candidates.push(`${BASE_PATH}/${themeId}/${i}.jpg`);
  }
  themeCache.set(themeId, candidates);
  return candidates;
}

export function probeBackgrounds(themeId: BattleThemeId): Promise<string[]> {
  const candidates = buildCandidates(themeId);
  return Promise.all(
    candidates.map(
      (url) =>
        new Promise<string | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(url);
          img.onerror = () => resolve(null);
          img.src = url;
        })
    )
  ).then((results) => results.filter((u): u is string => u !== null));
}

export function selectBackground(themeId: BattleThemeId, available: string[]): string | null {
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  const last = lastSelected.get(themeId);
  let pool = available;
  if (last && available.length > 1) {
    pool = available.filter((u) => u !== last);
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  lastSelected.set(themeId, chosen);
  return chosen;
}

export async function resolveBackground(themeId: BattleThemeId): Promise<string | null> {
  const available = await probeBackgrounds(themeId);
  return selectBackground(themeId, available);
}

export function getAvailableCount(themeId: BattleThemeId): number {
  return buildCandidates(themeId).length;
}
