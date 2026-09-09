import type { BattleThemeId, TierId } from "@/domain/types";
import type { ArenaTeam } from "@/simulation/types";

export type AssetState = "idle" | "walk" | "attack" | "shock";

export interface CharacterAssets {
  idle: string;
  walk: string;
  attack: string;
  shock: string;
}

export type TeamFolder = "red" | "blue";

const TIER_FOLDERS: TierId[] = ["T1", "T2", "T3", "T4", "T5"];

export function teamToFolder(team: ArenaTeam): TeamFolder {
  return team === "top" ? "red" : "blue";
}

export function getCharacterAssets(
  theme: BattleThemeId,
  team: TeamFolder,
  tier: TierId
): CharacterAssets {
  const base = `/character/${theme}/${team}`;
  return {
    idle: `${base}/${tier}.png`,
    walk: `${base}/animation/${tier}-walk.gif`,
    attack: `${base}/animation/${tier}-attack.gif`,
    shock: `${base}/animation/${tier}-shock.gif`,
  };
}

export function getPreloadList(theme: BattleThemeId): CharacterAssets[] {
  const list: CharacterAssets[] = [];
  for (const team of ["red", "blue"] as TeamFolder[]) {
    for (const tier of TIER_FOLDERS) {
      list.push(getCharacterAssets(theme, team, tier));
    }
  }
  return list;
}
