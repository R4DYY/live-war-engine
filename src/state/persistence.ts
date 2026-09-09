import type { BattleConfig } from "@/domain/types";
import { createDefaultBattleConfig } from "@/data/defaults";

const STORAGE_KEY = "lwe_draft_config";
const STORAGE_VERSION = 2;

interface StoredConfig {
  version: number;
  config: BattleConfig;
}

export function saveDraftConfig(config: BattleConfig): void {
  try {
    const data: StoredConfig = { version: STORAGE_VERSION, config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or disabled
  }
}

export function loadDraftConfig(): BattleConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultBattleConfig();

    const parsed: StoredConfig = JSON.parse(raw);
    if (
      !parsed.config ||
      !parsed.config.duelId ||
      !parsed.config.battleThemeId ||
      !parsed.config.combat
    ) {
      return createDefaultBattleConfig();
    }

    if (parsed.version < STORAGE_VERSION) {
      return migrateConfig(parsed.config);
    }

    return parsed.config;
  } catch {
    return createDefaultBattleConfig();
  }
}

function migrateConfig(old: BattleConfig): BattleConfig {
  return {
    ...old,
    combat: {
      ...old.combat,
      formationGap: old.combat.formationGap,
      meleeFrontageSlots: old.combat.meleeFrontageSlots,
      baseAttackSlots: old.combat.baseAttackSlots,
    },
  };
}
