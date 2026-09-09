import type {
  ChestConfig,
  ChestRewardConfig,
  ChestRewardType,
  TeamSide,
  ChestTiePolicy,
} from "@/domain/types";
import type { ArenaTeam } from "@/simulation/types";
import {
  setSpawnMultiplier,
  clearSpawnMultiplier,
  applyTeamEffect,
  clearTeamEffects,
  healBase,
  transformGiant,
} from "@/simulation/arenaEngine";

// ─── Chest Types ────────────────────────────────────────────────────

export type ChestVisualState = "FILLING" | "NEAR_UNLOCK" | "UNLOCKING" | "SUDDEN_DEATH" | "REWARD_REVEAL" | "REWARD_ACTIVE";

export const REWARD_POPUP_DURATION_MS = 2000;

export const REWARD_ICON_PATHS: Record<ChestRewardChoice, string> = {
  BASE_REPAIR: "/ui/chest-reward/HEAL.png",
  SPAWN_MULTIPLIER: "/ui/chest-reward/MEGA-ARMY.png",
  GIANT: "/ui/chest-reward/GIANT-TROOP.png",
  SHIELD: "/ui/chest-reward/WAR-SHIELD.png",
  RAGE: "/ui/chest-reward/RAGE-MODE.png",
};

export const REWARD_INFO: Record<ChestRewardChoice, { title: string; detail: string }> = {
  BASE_REPAIR: { title: "BASE HEAL", detail: "+10% BASE HP" },
  SPAWN_MULTIPLIER: { title: "MEGA ARMY", detail: "x2 SPAWN — 15s" },
  GIANT: { title: "GIANT TROOP", detail: "T1 CHARGER DEPLOYED" },
  SHIELD: { title: "WAR SHIELD", detail: "BASE PROTECTED — 12s" },
  RAGE: { title: "RAGE MODE", detail: "+35% SPEED / POWER — 12s" },
};
export type ChestRewardChoice = "BASE_REPAIR" | "SPAWN_MULTIPLIER" | "GIANT" | "SHIELD" | "RAGE";

export interface ChestOpenOptions {
  rewardType?: ChestRewardChoice;
  multiplier?: number;
  team?: TeamSide | "AUTO";
  source?: "AUTO" | "ADMIN";
}

export interface ChestContribution {
  userId?: string;
  username?: string;
  team: TeamSide;
  points: number;
}

export interface ChestRewardEffect {
  team: ArenaTeam;
  type: ChestRewardType;
  multiplier: number;
  startedAt: number;
  endsAt: number;
}

export interface ChestCycle {
  id: number;
  currentLikes: number;
  teamAContributions: number;
  teamBContributions: number;
  unlocked: boolean;
  suddenDeath: boolean;
  winner: TeamSide | null;
  rewardEffects: ChestRewardEffect[];
  startedAt: number;
  unlockedAt: number | null;
  selectedReward: ChestRewardChoice | null;
}

export interface ChestMetrics {
  totalLikes: number;
  chestsUnlocked: number;
  chestsWonA: number;
  chestsWonB: number;
  chestTies: number;
  contributionsA: number;
  contributionsB: number;
  timeToChestUnlock: number[];
  rewardType: string;
  rewardTeam: TeamSide | null;
  rewardDuration: number;
}

export interface ChestSnapshot {
  cycle: ChestCycle | null;
  progress: number;
  visualState: ChestVisualState;
  cta: string;
  selectedReward: ChestRewardChoice | null;
}

export interface ChestEvent {
  type:
    | "CHEST_CYCLE_STARTED"
    | "CHEST_PROGRESS"
    | "CHEST_CONTRIBUTION"
    | "CHEST_UNLOCKED"
    | "CHEST_REWARD_APPLIED"
    | "CHEST_REWARD_EXPIRED"
    | "CHEST_OPENING_STARTED"
    | "CHEST_REWARD_SELECTED"
    | "CHEST_SUDDEN_DEATH_STARTED"
    | "CHEST_WINNER_RESOLVED";
  payload: Record<string, unknown>;
  timestamp: number;
}

type ChestEventListener = (event: ChestEvent) => void;

// ─── Reward Application Architecture ────────────────────────────────
//
// Each reward type maps to an applicator function. New reward types
// (BASE_REPAIR, SHIELD, RAGE, SPEED, GIANT, AIRSTRIKE) can be added
// here without modifying the chest manager itself.

interface RewardContext {
  team: TeamSide;
  arenaTeam: ArenaTeam;
  reward: ChestRewardConfig;
  endsAt: number;
}

interface RewardResult {
  effect: ChestRewardEffect;
}

type RewardApplicator = (ctx: RewardContext) => RewardResult | null;

const rewardApplicators: Partial<Record<ChestRewardType, RewardApplicator>> = {
  SPAWN_MULTIPLIER: (ctx) => {
    setSpawnMultiplier(ctx.arenaTeam, ctx.reward.multiplier, ctx.endsAt);
    return { effect: createEffect(ctx, "SPAWN_MULTIPLIER", ctx.reward.multiplier) };
  },
  BASE_REPAIR: (ctx) => {
    healBase(ctx.arenaTeam, ctx.reward.multiplier || 10);
    return { effect: createEffect(ctx, "BASE_REPAIR", ctx.reward.multiplier || 10) };
  },
  SHIELD: (ctx) => {
    applyTeamEffect(ctx.arenaTeam, "SHIELD", ctx.reward.multiplier || 0.3, ctx.endsAt, 150);
    return { effect: createEffect(ctx, "SHIELD", ctx.reward.multiplier || 0.3) };
  },
  RAGE: (ctx) => {
    applyTeamEffect(ctx.arenaTeam, "RAGE", ctx.reward.multiplier || 1.35, ctx.endsAt);
    return { effect: createEffect(ctx, "RAGE", ctx.reward.multiplier || 1.35) };
  },
  GIANT: (ctx) => {
    const giant = transformGiant(ctx.arenaTeam);
    if (!giant) return null;
    applyTeamEffect(ctx.arenaTeam, "GIANT", 1, ctx.endsAt);
    return { effect: createEffect(ctx, "GIANT", 1) };
  },
};

function createEffect(ctx: RewardContext, type: ChestRewardType, multiplier: number): ChestRewardEffect {
  return { team: ctx.arenaTeam, type, multiplier, startedAt: Date.now(), endsAt: ctx.endsAt };
}

export function selectChestReward(): ChestRewardChoice {
  const rewards: ChestRewardChoice[] = ["BASE_REPAIR", "SPAWN_MULTIPLIER", "GIANT", "SHIELD", "RAGE"];
  return rewards[Math.floor(Math.random() * rewards.length)];
}

function applyChestReward(
  team: TeamSide,
  reward: ChestRewardConfig,
  cycleEffects: ChestRewardEffect[]
): ChestRewardEffect | null {
  const arenaTeam: ArenaTeam = team === "A" ? "top" : "bottom";
  const endsAt = Date.now() + reward.durationSeconds * 1000;
  const applicator = rewardApplicators[reward.type];
  if (!applicator) return null;

  const result = applicator({ team, arenaTeam, reward, endsAt });
  if (!result) return null;

  cycleEffects.push(result.effect);
  return result.effect;
}

// ─── Chest Manager ──────────────────────────────────────────────────

class ChestManager {
  private config: ChestConfig | null = null;
  private cycle: ChestCycle | null = null;
  private metrics: ChestMetrics = this.emptyMetrics();
  private listeners = new Set<ChestEventListener>();
  private lastProgressEmit = 0;
  private rewardCheckInterval: ReturnType<typeof setInterval> | null = null;
  private pendingCycleTimeout: ReturnType<typeof setTimeout> | null = null;

  init(config: ChestConfig): void {
    this.config = config;
    this.metrics = this.emptyMetrics();
    this.startNewCycle();
    this.startRewardChecker();
  }

  reset(): void {
    this.config = null;
    this.cycle = null;
    this.metrics = this.emptyMetrics();
    if (this.rewardCheckInterval) {
      clearInterval(this.rewardCheckInterval);
      this.rewardCheckInterval = null;
    }
    if (this.pendingCycleTimeout) {
      clearTimeout(this.pendingCycleTimeout);
      this.pendingCycleTimeout = null;
    }
    clearSpawnMultiplier("top");
    clearSpawnMultiplier("bottom");
    clearTeamEffects();
  }

  getConfig(): ChestConfig | null {
    return this.config;
  }

  getCycle(): ChestCycle | null {
    return this.cycle;
  }

  getMetrics(): ChestMetrics {
    return { ...this.metrics };
  }

  getProgress(): number {
    if (!this.cycle || !this.config) return 0;
    return Math.min(1, this.cycle.currentLikes / this.config.likeThreshold);
  }

  getVisualState(): ChestVisualState {
    if (!this.cycle || !this.config) return "FILLING";
    if (this.cycle.rewardEffects.length > 0) return "REWARD_ACTIVE";
    if (this.cycle.unlocked && !this.cycle.suddenDeath) return "REWARD_REVEAL";
    if (this.cycle.suddenDeath) return "SUDDEN_DEATH";
    if (this.getProgress() >= 0.9) return "NEAR_UNLOCK";
    return "FILLING";
  }

  getCTAMessage(): string {
    if (!this.cycle || !this.config) return "";
    const progress = this.getProgress();
    if (this.cycle.rewardEffects.length > 0) {
      const remaining = Math.ceil(
        Math.max(...this.cycle.rewardEffects.map((e) => e.endsAt)) - Date.now()
      ) / 1000;
      const teamName = this.cycle.winner === "A" ? "TEAM A" : this.cycle.winner === "B" ? "TEAM B" : "BOTH";
      const mult = this.cycle.rewardEffects[0]?.multiplier ?? 2;
      return `${teamName} x${mult} SPAWN — ${Math.ceil(remaining)}s`;
    }
    if (this.cycle.unlocked) {
      if (this.cycle.winner === "A") return "TEAM A WON THE CHEST";
      if (this.cycle.winner === "B") return "TEAM B WON THE CHEST";
      return "CHEST TIED — NO REWARD";
    }
    if (progress >= 0.9) return "CHEST ALMOST READY";
    if (this.cycle.teamAContributions > this.cycle.teamBContributions) return "TEAM A LEADS THE CHEST";
    if (this.cycle.teamBContributions > this.cycle.teamAContributions) return "TEAM B LEADS THE CHEST";
    if (this.cycle.teamAContributions > 0) return "CHEST TIED";
    return "LIKE TO UNLOCK THE CHEST";
  }

  getSnapshot(): ChestSnapshot {
    return {
      cycle: this.cycle ? { ...this.cycle, rewardEffects: [...this.cycle.rewardEffects] } : null,
      progress: this.getProgress(),
      visualState: this.getVisualState(),
      cta: this.getCTAMessage(),
      selectedReward: this.cycle?.selectedReward ?? null,
    };
  }

  // ─── Like Processing ──────────────────────────────────────────────

  addLikes(count: number): void {
    if (!this.cycle || !this.config || this.cycle.unlocked) return;
    this.cycle.currentLikes += count;
    this.metrics.totalLikes += count;

    const now = Date.now();
    if (now - this.lastProgressEmit > 200) {
      this.lastProgressEmit = now;
      this.emit("CHEST_PROGRESS", {
        currentLikes: this.cycle.currentLikes,
        threshold: this.config.likeThreshold,
        progress: this.getProgress(),
      });
    }

    if (this.cycle.currentLikes >= this.config.likeThreshold) {
      this.resolveCycle();
    }
  }

  // ─── Contributions ────────────────────────────────────────────────

  addContribution(contribution: ChestContribution): void {
    if (!this.cycle || !this.config) return;
    if (this.cycle.unlocked && !this.cycle.suddenDeath) return;
    const points = contribution.points * this.config.contributionPointsPerChestGift;
    if (contribution.team === "A") {
      this.cycle.teamAContributions += points;
      this.metrics.contributionsA += points;
    } else {
      this.cycle.teamBContributions += points;
      this.metrics.contributionsB += points;
    }
    this.emit("CHEST_CONTRIBUTION", {
      team: contribution.team,
      points,
      userId: contribution.userId,
      username: contribution.username,
      teamA: this.cycle.teamAContributions,
      teamB: this.cycle.teamBContributions,
    });
    if (this.cycle.suddenDeath) {
      this.resolveSuddenDeath(contribution.team);
    }
  }

  // ─── Unlock / Resolve ─────────────────────────────────────────────

  private resolveCycle(): void {
    if (!this.cycle || !this.config) return;
    this.cycle.unlocked = true;
    this.cycle.unlockedAt = Date.now();
    this.metrics.chestsUnlocked++;
    this.metrics.timeToChestUnlock.push((this.cycle.unlockedAt - this.cycle.startedAt) / 1000);

    const winner = this.resolveWinner();
    if (winner) {
      this.cycle.winner = winner;
      this.emit("CHEST_UNLOCKED", {
        chestCycleId: this.cycle.id,
        teamA: this.cycle.teamAContributions,
        teamB: this.cycle.teamBContributions,
        winner,
        tiePolicy: this.config.tiePolicy,
      });
      this.emit("CHEST_WINNER_RESOLVED", { chestCycleId: this.cycle.id, winner, source: "AUTO" });
      this.openChest({ source: "AUTO" });
    } else if (this.config.tiePolicy === "SUDDEN_DEATH") {
      this.metrics.chestTies++;
      this.cycle.suddenDeath = true;
      this.emit("CHEST_UNLOCKED", {
        chestCycleId: this.cycle.id,
        teamA: this.cycle.teamAContributions,
        teamB: this.cycle.teamBContributions,
        winner: null,
        tiePolicy: this.config.tiePolicy,
      });
      this.emit("CHEST_SUDDEN_DEATH_STARTED", { chestCycleId: this.cycle.id });
    } else {
      const tie = this.resolveTie();
      this.cycle.winner = tie.winner;
      const tieBoth = tie.both;
      this.emit("CHEST_UNLOCKED", {
        chestCycleId: this.cycle.id,
        teamA: this.cycle.teamAContributions,
        teamB: this.cycle.teamBContributions,
        winner: tie.winner,
        tiePolicy: this.config.tiePolicy,
      });
      if (tie.winner || tieBoth || this.config.tiePolicy === "NO_REWARD") {
        this.openChest({ source: "AUTO" });
      }
    }
  }

  private resolveTie(): { winner: TeamSide | null; both: boolean } {
    if (!this.config) return { winner: null, both: false };
    const policy: ChestTiePolicy = this.config.tiePolicy;
    if (policy === "NO_REWARD") return { winner: null, both: false };
    if (policy === "BOTH_TEAMS") return { winner: null, both: true };
    if (policy === "RANDOM") return { winner: Math.random() < 0.5 ? "A" : "B", both: false };
    return { winner: null, both: false };
  }

  private applyReward(team: TeamSide, selectedReward?: ChestRewardConfig): void {
    if (!this.config || !this.cycle) return;
    const reward: ChestRewardConfig = selectedReward ?? this.config.reward;

    const effect = applyChestReward(team, reward, this.cycle.rewardEffects);
    if (!effect) return;

    this.metrics.rewardType = reward.type;
    this.metrics.rewardTeam = team;
    this.metrics.rewardDuration = reward.durationSeconds;

    this.emit("CHEST_REWARD_APPLIED", {
      team,
      rewardType: reward.type,
      multiplier: reward.multiplier,
      durationSeconds: reward.durationSeconds,
      endsAt: effect.endsAt,
    });
  }

  private startRewardChecker(): void {
    if (this.rewardCheckInterval) clearInterval(this.rewardCheckInterval);
    this.rewardCheckInterval = setInterval(() => {
      if (!this.cycle) return;
      const now = Date.now();
      const expired = this.cycle.rewardEffects.filter((e) => now >= e.endsAt);
      for (const eff of expired) {
        clearSpawnMultiplier(eff.team);
        this.emit("CHEST_REWARD_EXPIRED", {
          team: eff.team === "top" ? "A" : "B",
        });
      }
      this.cycle.rewardEffects = this.cycle.rewardEffects.filter(
        (e) => now < e.endsAt
      );
    }, 500);
  }

  // ─── Cycle Management ─────────────────────────────────────────────

  private startNewCycle(): void {
    this.startNewCycleWithLikes(0);
  }

  private startNewCycleWithLikes(carry: number): void {
    if (!this.config) return;
    this.cycle = {
      id: (this.cycle?.id ?? 0) + 1,
      currentLikes: carry,
      teamAContributions: 0,
      teamBContributions: 0,
      unlocked: false,
      suddenDeath: false,
      winner: null,
      rewardEffects: [],
      startedAt: Date.now(),
      unlockedAt: null,
      selectedReward: null,
    };
    this.emit("CHEST_CYCLE_STARTED", {
      chestCycleId: this.cycle.id,
      carryOverLikes: carry,
    });
  }

  // ─── Dev/Test Helpers ─────────────────────────────────────────────

  setChestProgress(percent: number): void {
    if (!this.cycle || !this.config) return;
    const target = Math.floor(this.config.likeThreshold * (percent / 100));
    this.cycle.currentLikes = Math.min(target, this.config.likeThreshold - 1);
    this.emit("CHEST_PROGRESS", {
      currentLikes: this.cycle.currentLikes,
      threshold: this.config.likeThreshold,
      progress: this.getProgress(),
    });
  }

  forceUnlock(): void {
    this.openChest({ source: "ADMIN" });
  }

  forceOpenWithReward(options: ChestOpenOptions): void {
    this.openChest(options);
  }

  private openChest(options: ChestOpenOptions = {}): void {
    if (!this.cycle || !this.config || this.cycle.suddenDeath) return;
    if (this.cycle.selectedReward !== null) return;
    const likesAtOpening = this.cycle.currentLikes;
    const overflow = options.source === "ADMIN" ? 0 : this.config.carryOverflowLikes
      ? Math.max(0, likesAtOpening - this.config.likeThreshold)
      : 0;
    this.cycle.unlocked = true;
    this.cycle.suddenDeath = false;
    if (!this.cycle.unlockedAt) this.cycle.unlockedAt = Date.now();
    const winner = options.team && options.team !== "AUTO" ? options.team : this.cycle.winner ?? this.resolveWinner();
    const tieBoth = !winner && this.config.tiePolicy === "BOTH_TEAMS";
    this.cycle.winner = winner;
    if (winner === "A") this.metrics.chestsWonA++;
    else if (winner === "B") this.metrics.chestsWonB++;
    else this.metrics.chestTies++;
    this.emit("CHEST_OPENING_STARTED", { chestCycleId: this.cycle.id, source: options.source ?? "AUTO", winner, likes: likesAtOpening });
    const rewardType = options.rewardType ?? selectChestReward();
    const reward: ChestRewardConfig = {
      type: rewardType,
      multiplier: options.multiplier ?? (rewardType === "SPAWN_MULTIPLIER" ? 2 : rewardType === "BASE_REPAIR" ? 10 : rewardType === "SHIELD" ? 0.3 : rewardType === "RAGE" ? 1.35 : 1),
      durationSeconds: rewardType === "BASE_REPAIR" || rewardType === "GIANT" ? 30 : rewardType === "SPAWN_MULTIPLIER" ? this.config.reward.durationSeconds : 12,
    };
    this.cycle.selectedReward = rewardType;
    const recipients = winner ? [winner] : tieBoth ? ["A", "B"] as TeamSide[] : [];
    for (const recipient of recipients) {
      this.emit("CHEST_REWARD_SELECTED", { chestCycleId: this.cycle.id, rewardType, team: recipient, source: options.source ?? "AUTO" });
    }
    this.pendingCycleTimeout = setTimeout(() => {
      for (const recipient of recipients) {
        this.applyReward(recipient, reward);
      }
      this.pendingCycleTimeout = setTimeout(() => {
        this.pendingCycleTimeout = null;
        this.startNewCycleWithLikes(overflow);
      }, 1500);
    }, REWARD_POPUP_DURATION_MS);
  }

  private resolveSuddenDeath(scoringTeam: TeamSide): void {
    if (!this.cycle || !this.config) return;
    this.cycle.winner = scoringTeam;
    this.cycle.suddenDeath = false;
    this.emit("CHEST_WINNER_RESOLVED", { chestCycleId: this.cycle.id, winner: scoringTeam, source: "SUDDEN_DEATH" });
    this.openChest({ source: "AUTO" });
  }

  private resolveWinner(): TeamSide | null {
    if (!this.cycle || !this.config) return null;
    if (this.cycle.teamAContributions > this.cycle.teamBContributions) return "A";
    if (this.cycle.teamBContributions > this.cycle.teamAContributions) return "B";
    return this.resolveTie().winner;
  }

  resetChest(): void {
    if (!this.config) return;
    clearSpawnMultiplier("top");
    clearSpawnMultiplier("bottom");
    clearTeamEffects();
    this.startNewCycle();
  }

  // ─── Events ───────────────────────────────────────────────────────

  subscribe(listener: ChestEventListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(type: ChestEvent["type"], payload: Record<string, unknown>): void {
    const event: ChestEvent = { type, payload, timestamp: Date.now() };
    for (const l of this.listeners) l(event);
  }

  private emptyMetrics(): ChestMetrics {
    return {
      totalLikes: 0,
      chestsUnlocked: 0,
      chestsWonA: 0,
      chestsWonB: 0,
      chestTies: 0,
      contributionsA: 0,
      contributionsB: 0,
      timeToChestUnlock: [],
      rewardType: "SPAWN_MULTIPLIER",
      rewardTeam: null,
      rewardDuration: 0,
    };
  }
}

export const chestManager = new ChestManager();
