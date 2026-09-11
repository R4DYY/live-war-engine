import type { BattleConfig, TierId } from "@/domain/types";
import { COMMANDERS } from "@/data/commanders";
import { DUELS } from "@/data/duels";
import { BATTLE_THEMES } from "@/data/themes";
import { TIER_IDS } from "@/domain/types";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateBattleConfig(
  config: BattleConfig
): ValidationError[] {
  const errors: ValidationError[] = [];

  const duel = DUELS.find((d) => d.id === config.duelId);
  if (!duel) {
    errors.push({ field: "duelId", message: `Duel "${config.duelId}" not found` });
  }

  if (!BATTLE_THEMES[config.battleThemeId]) {
    errors.push({
      field: "battleThemeId",
      message: `Theme "${config.battleThemeId}" not found`,
    });
  }

  const cmdA = COMMANDERS.find((c) => c.id === config.teamA.commanderId);
  if (!cmdA) {
    errors.push({
      field: "teamA.commanderId",
      message: `Commander A "${config.teamA.commanderId}" not found`,
    });
  }

  const cmdB = COMMANDERS.find((c) => c.id === config.teamB.commanderId);
  if (!cmdB) {
    errors.push({
      field: "teamB.commanderId",
      message: `Commander B "${config.teamB.commanderId}" not found`,
    });
  }

  if (config.combat.baseHp <= 0) {
    errors.push({ field: "combat.baseHp", message: "Base HP must be > 0" });
  }

  if (config.combat.durationSeconds <= 0) {
    errors.push({
      field: "combat.durationSeconds",
      message: "Duration must be > 0",
    });
  }

  if (config.combat.autoSpawnIntervalSeconds <= 0) {
    errors.push({
      field: "combat.autoSpawnIntervalSeconds",
      message: "Auto spawn interval must be > 0",
    });
  }

  for (const tierId of TIER_IDS) {
    if (!config.tiers[tierId as TierId]) {
      errors.push({
        field: `tiers.${tierId}`,
        message: `Tier ${tierId} config missing`,
      });
    }
  }

  return errors;
}
