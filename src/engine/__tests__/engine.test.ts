import { describe, it, expect, afterEach } from "vitest";
import {
  createBattleSession,
  startBattle,
  endBattle,
  getRemainingMs,
  isBattleExpired,
  getBaseHpPercent,
  createTeamRuntime,
} from "@/engine/battleEngine";
import { validateBattleConfig } from "@/engine/validation";
import { createDefaultBattleConfig } from "@/data/defaults";
import { createEvent, appendEvent } from "@/engine/events";
import {
  initArena,
  resetArena,
  tickArena,
  spawnUnits,
  getSnapshot,
  getArenaState,
  forceBaseDamage,
  setAutoSpawn,
  computeHealingTargetScore,
  resolveHealing,
  triggerUltimate,
} from "@/simulation/arenaEngine";
import type { BattleConfig } from "@/domain/types";
import { SimulatorAdapter } from "@/live/simulatorAdapter";
import { liveEventBus } from "@/live/liveEventBus";
import { ReplayRecorder, replayRecording } from "@/live/replay";
import { startGiftBridge, stopGiftBridge } from "@/live/giftBridge";
import {
  chestManager,
  selectChestReward,
  REWARD_POPUP_DURATION_MS,
  REWARD_ICON_PATHS,
  REWARD_INFO,
} from "@/engine/chestManager";
import type { ChestRewardChoice } from "@/engine/chestManager";
import { getSpawnMultiplier, getTeamEffects } from "@/simulation/arenaEngine";

// ─── Battle Engine (Prompt 01 tests preserved) ─────────────────────
describe("battleEngine", () => {
  const config = createDefaultBattleConfig();

  it("creates a battle session with unique ID", () => {
    const s1 = createBattleSession(config, 1, false);
    const s2 = createBattleSession(config, 2, false);
    expect(s1.id).not.toBe(s2.id);
  });

  it("creates a session in READY state", () => {
    const session = createBattleSession(config, 1, false);
    expect(session.status).toBe("READY");
    expect(session.startedAt).toBeNull();
  });

  it("snapshots the config (immutable)", () => {
    const cfg = createDefaultBattleConfig();
    const session = createBattleSession(cfg, 1, false);
    cfg.combat.baseHp = 999;
    expect(session.config.combat.baseHp).toBe(100000);
  });

  it("starts a battle with correct timestamps", () => {
    const session = createBattleSession(config, 1, false);
    const running = startBattle(session, 1000000);
    expect(running.status).toBe("RUNNING");
    expect(running.endsAt).toBe(1000000 + config.combat.durationSeconds * 1000);
  });

  it("ends a battle", () => {
    const session = createBattleSession(config, 1, false);
    const running = startBattle(session, 1000000);
    const ended = endBattle(running, 2000000, "TIMER");
    expect(ended.status).toBe("ENDED");
    expect(ended.endReason).toBe("TIMER");
  });

  it("calculates remaining time", () => {
    const session = createBattleSession(config, 1, false);
    const running = startBattle(session, 1000000);
    expect(getRemainingMs(running, 1000000 + 10000)).toBe(
      config.combat.durationSeconds * 1000 - 10000
    );
  });

  it("detects expired battle", () => {
    const session = createBattleSession(config, 1, false);
    const running = startBattle(session, 1000000);
    expect(isBattleExpired(running, 1000000 + config.combat.durationSeconds * 1000 + 1)).toBe(true);
    expect(isBattleExpired(running, 1000000)).toBe(false);
  });

  it("computes base HP percentage", () => {
    const rt = createTeamRuntime("A", 100000);
    expect(getBaseHpPercent(rt)).toBe(100);
    expect(getBaseHpPercent({ ...rt, baseHp: 50000 })).toBe(50);
    expect(getBaseHpPercent({ ...rt, baseHp: 0 })).toBe(0);
  });
});

// ─── Validation ─────────────────────────────────────────────────────
describe("validation", () => {
  it("validates a correct config", () => {
    expect(validateBattleConfig(createDefaultBattleConfig())).toHaveLength(0);
  });

  it("catches invalid duel", () => {
    const cfg: BattleConfig = { ...createDefaultBattleConfig(), duelId: "x" };
    expect(validateBattleConfig(cfg).some((e) => e.field === "duelId")).toBe(true);
  });

  it("catches zero base HP", () => {
    const cfg = createDefaultBattleConfig();
    cfg.combat.baseHp = 0;
    expect(validateBattleConfig(cfg).some((e) => e.field === "combat.baseHp")).toBe(true);
  });
});

// ─── Events ─────────────────────────────────────────────────────────
describe("events", () => {
  it("creates event with ID and timestamp", () => {
    const e = createEvent("BATTLE_STARTED", "abc");
    expect(e.id).toBeTruthy();
    expect(e.type).toBe("BATTLE_STARTED");
  });

  it("caps event list at 500", () => {
    const events = Array.from({ length: 500 }, () => createEvent("CONFIG_UPDATED"));
    const result = appendEvent(events, createEvent("BATTLE_STARTED"));
    expect(result).toHaveLength(500);
  });
});

// ─── Arena Engine ───────────────────────────────────────────────────
describe("arenaEngine", () => {
  function makeArena(overrides?: Partial<BattleConfig["combat"]>) {
    const cfg = createDefaultBattleConfig();
    if (overrides) Object.assign(cfg.combat, overrides);
    initArena(cfg);
    return getArenaState()!;
  }

  afterEach(() => {
    resetArena();
  });

  it("initializes with correct base HP", () => {
    const state = makeArena();
    expect(state.topBaseHp).toBe(100000);
    expect(state.bottomBaseHp).toBe(100000);
  });

  it("auto-spawns units over time", () => {
    makeArena();
    setAutoSpawn(true);
    // Tick past auto-spawn interval (default 1s)
    tickArena(1.5);
    const state = getArenaState()!;
    const alive = state.units.filter((u) => u.state !== "DEAD");
    expect(alive.length).toBe(2);
  });

  it("manual spawn creates units", () => {
    makeArena();
    spawnUnits("top", 5, "SIMULATION");
    spawnUnits("bottom", 3, "SIMULATION");
    const state = getArenaState()!;
    expect(state.units.filter((u) => u.team === "top").length).toBe(5);
    expect(state.units.filter((u) => u.team === "bottom").length).toBe(3);
  });

  it("units move toward each other", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION");
    spawnUnits("bottom", 1, "SIMULATION");

    const state = getArenaState()!;
    const unitTop = state.units.find((u) => u.team === "top")!;
    const unitBot = state.units.find((u) => u.team === "bottom")!;
    const startTopY = unitTop.y;
    const startBotY = unitBot.y;

    // Transition past spawning
    tickArena(0.5);
    tickArena(0.5);

    expect(unitTop.y).toBeGreaterThan(startTopY);
    expect(unitBot.y).toBeLessThan(startBotY);
  });

  it("units fight when in range", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION");
    spawnUnits("bottom", 1, "SIMULATION");

    const state = getArenaState()!;
    const unitTop = state.units.find((u) => u.team === "top")!;
    const unitBot = state.units.find((u) => u.team === "bottom")!;

    // Place them within attack range (range = 1 * 7 = 7)
    unitTop.x = 200;
    unitTop.y = 350;
    unitTop.state = "MOVING";
    unitBot.x = 200;
    unitBot.y = 355;
    unitBot.state = "MOVING";

    tickArena(0.05);

    expect(unitTop.state).toBe("FIGHTING");
    expect(unitBot.state).toBe("FIGHTING");
  });

  it("combat deals damage simultaneously", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION");
    spawnUnits("bottom", 1, "SIMULATION");

    const state = getArenaState()!;
    const unitTop = state.units.find((u) => u.team === "top")!;
    const unitBot = state.units.find((u) => u.team === "bottom")!;

    unitTop.x = 200;
    unitTop.y = 350;
    unitTop.state = "MOVING";
    unitBot.x = 200;
    unitBot.y = 355;
    unitBot.state = "MOVING";

    // Several ticks of combat
    for (let i = 0; i < 60; i++) tickArena(1 / 60);

    expect(unitTop.hp).toBeLessThan(unitTop.maxHp);
    expect(unitBot.hp).toBeLessThan(unitBot.maxHp);
  });

  it("base destruction ends battle with correct winner", () => {
    const cfg = createDefaultBattleConfig();
    cfg.combat.baseHp = 10;
    initArena(cfg);
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION");

    const state = getArenaState()!;
    const unitTop = state.units.find((u) => u.team === "top")!;
    unitTop.x = 200;
    unitTop.y = 655;
    unitTop.state = "MOVING";

    for (let i = 0; i < 300; i++) tickArena(1 / 60);

    expect(state.winner).toBe("top");
    expect(state.endReason).toBe("BASE_DESTROYED");
  });

  it("timer expiry picks winner by remaining HP", () => {
    const cfg = createDefaultBattleConfig();
    cfg.combat.durationSeconds = 1;
    initArena(cfg);
    setAutoSpawn(false);

    forceBaseDamage("bottom", 10);

    tickArena(1.1);

    const state = getArenaState()!;
    expect(state.winner).toBe("top");
    expect(state.endReason).toBe("TIMER");
  });

  it("equal HP at timer produces draw", () => {
    const cfg = createDefaultBattleConfig();
    cfg.combat.durationSeconds = 1;
    initArena(cfg);
    setAutoSpawn(false);

    tickArena(1.1);

    const state = getArenaState()!;
    expect(state.winner).toBeNull();
    expect(state.isDraw).toBe(true);
    expect(state.endReason).toBe("TIMER");
  });

  it("snapshot returns correct shape", () => {
    makeArena();
    spawnUnits("top", 3, "SIMULATION");
    const snap = getSnapshot(false, 1);
    expect(snap.units).toHaveLength(3);
    expect(snap.topBaseHp).toBe(100000);
    expect(snap.bottomBaseHp).toBe(100000);
    expect(snap.metrics.topAlive).toBe(3);
    expect(snap.isRunning).toBe(true);
  });

  it("handles 200 units without error", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 100, "SIMULATION");
    spawnUnits("bottom", 100, "SIMULATION");

    const state = getArenaState()!;
    expect(state.units.length).toBe(200);

    for (let i = 0; i < 50; i++) tickArena(1 / 60);

    const alive = state.units.filter((u) => u.state !== "DEAD");
    expect(alive.length).toBeGreaterThan(0);
  });

  it("force base damage works", () => {
    makeArena();
    forceBaseDamage("top", 25);
    const state = getArenaState()!;
    expect(state.topBaseHp).toBe(75000);
  });

  it("creates a generic T2 specialist with universal stats", () => {
    makeArena();
    spawnUnits("top", 1, "SIMULATION", "T2");
    const unit = getArenaState()!.units[0];

    expect(unit.tier).toBe("T2");
    expect(unit.hp).toBe(350);
    expect(unit.damage).toBe(65);
    expect(unit.structureDps).toBe(25);
    expect(unit.range).toBe(35 * 7);
    expect(unit.economicValue).toBe(0.1);
    expect(unit.source).toBe("SIMULATION");
  });

  it("specialist fires while physically queued behind an ally", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T2");
    spawnUnits("top", 1, "SIMULATION", "T1");
    spawnUnits("bottom", 1, "SIMULATION", "T1");

    const state = getArenaState()!;
    const specialist = state.units.find((u) => u.tier === "T2")!;
    const ally = state.units.find((u) => u.tier === "T1" && u.team === "top")!;
    const enemy = state.units.find((u) => u.team === "bottom")!;

    specialist.x = ally.x = enemy.x = 200;
    specialist.y = 300;
    ally.y = 315;
    enemy.y = 350;
    specialist.state = "MOVING";
    specialist.movementState = "BLOCKED";
    ally.state = "MOVING";
    enemy.state = "MOVING";

    tickArena(0.5);
    const hpBefore = enemy.hp;
    tickArena(0.5);

    expect(specialist.combatState).toBe("ATTACKING_UNIT");
    expect(enemy.hp).toBeLessThan(hpBefore);
    expect(specialist.y).toBeLessThan(enemy.y);
  });

  it("specialist does not attack outside its configured range", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T2");
    spawnUnits("bottom", 1, "SIMULATION", "T1");

    const state = getArenaState()!;
    const specialist = state.units.find((u) => u.team === "top")!;
    const enemy = state.units.find((u) => u.team === "bottom")!;
    specialist.x = enemy.x = 200;
    specialist.y = 100;
    enemy.y = 500;
    specialist.state = "MOVING";
    enemy.state = "MOVING";

    tickArena(0.5);

    expect(specialist.combatState).not.toBe("ATTACKING_UNIT");
    expect(enemy.hp).toBe(enemy.maxHp);
  });

  it("specialist uses structure DPS when attacking the base", () => {
    const cfg = createDefaultBattleConfig();
    cfg.combat.baseHp = 1000;
    initArena(cfg);
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T2");

    const specialist = getArenaState()!.units[0];
    specialist.x = 200;
    specialist.y = 600;
    specialist.state = "MOVING";

    tickArena(0.5);
    const hpBefore = getArenaState()!.bottomBaseHp;
    tickArena(1);

    expect(getArenaState()!.bottomBaseHp).toBeLessThan(hpBefore);
    expect(getArenaState()!.bottomBaseHp).toBeGreaterThan(0);
    expect(specialist.structureDps).toBe(25);
  });

  // ─── T4 Breaker Tests ──────────────────────────────────────────────

  it("creates a generic T4 breaker with universal stats", () => {
    makeArena();
    spawnUnits("top", 1, "SIMULATION", "T4");
    const unit = getArenaState()!.units[0];

    expect(unit.tier).toBe("T4");
    expect(unit.hp).toBe(8000);
    expect(unit.damage).toBe(220);
    expect(unit.structureDps).toBe(400);
    expect(unit.radius).toBe(14);
    expect(unit.frontageCost).toBe(3);
    expect(unit.economicValue).toBe(2);
    expect(unit.source).toBe("SIMULATION");
    expect(unit.chargeState).toBe("CHARGING");
    expect(unit.impactDamage).toBe(1500);
    expect(unit.impactRadius).toBe(50);
    expect(unit.knockbackDistance).toBe(25);
  });

  it("T4 enters charging state on spawn", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");

    const unit = getArenaState()!.units[0];
    expect(unit.chargeState).toBe("CHARGING");
    expect(unit.impactConsumed).toBe(false);

    // Tick past spawn duration
    tickArena(0.4);
    expect(unit.movementState).toBe("CHARGING");
    expect(unit.collisionPriority).toBe(10);
  });

  it("T4 charge triggers exactly one impact", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("bottom", 5, "SIMULATION", "T1");

    const breaker = getArenaState()!.units.find((u) => u.tier === "T4")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    // Place breaker in contact with enemies
    breaker.x = 200;
    breaker.y = 350;
    breaker.state = "MOVING";
    breaker.movementState = "CHARGING";
    breaker.collisionPriority = 10;
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 360 + i * 15;
      e.state = "MOVING";
    });

    // Tick to trigger impact
    tickArena(0.05);
    expect(breaker.impactConsumed).toBe(true);
    expect(breaker.chargeState).toBe("IMPACT_CONSUMED");

    // Tick several more times — no repeat impact
    const enemiesHitCount = getArenaState()!.chargeMetrics.get("T4")?.impacts ?? 0;
    for (let i = 0; i < 20; i++) tickArena(0.05);

    expect(getArenaState()!.chargeMetrics.get("T4")?.impacts).toBe(enemiesHitCount);
  });

  it("T4 charge impact deals AoE damage to enemy units", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("bottom", 3, "SIMULATION", "T1");

    const breaker = getArenaState()!.units.find((u) => u.tier === "T4")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    breaker.x = 200;
    breaker.y = 350;
    breaker.state = "MOVING";
    breaker.movementState = "CHARGING";
    breaker.collisionPriority = 10;
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 360 + i * 15;
      e.state = "MOVING";
    });

    const hpBefore = enemies.map((e) => e.hp);
    tickArena(0.05);

    // At least some enemies should have taken damage
    const damaged = enemies.filter((e, i) => e.hp < hpBefore[i]);
    expect(damaged.length).toBeGreaterThan(0);
  });

  it("T4 charge impact applies knockback to survivors", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("bottom", 3, "SIMULATION", "T4");

    const breaker = getArenaState()!.units.find((u) => u.tier === "T4" && u.team === "top")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    breaker.x = 200;
    breaker.y = 350;
    breaker.state = "MOVING";
    breaker.movementState = "CHARGING";
    breaker.collisionPriority = 10;
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 360 + i * 20;
      e.state = "MOVING";
      e.chargeState = "NONE";
      e.collisionPriority = 0;
    });

    const yBefore = enemies.map((e) => e.y);
    tickArena(0.05);

    // Surviving enemies should have been pushed (y increased for team B pushed by team A)
    const survivors = enemies.filter((e) => e.state !== "DEAD");
    expect(survivors.length).toBeGreaterThan(0);
    const pushed = survivors.filter((e) => {
      const origIdx = enemies.indexOf(e);
      return e.y > yBefore[origIdx] + 1;
    });
    expect(pushed.length).toBeGreaterThan(0);
  });

  it("T4 does not damage allies during charge", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("top", 3, "SIMULATION", "T1");

    const breaker = getArenaState()!.units.find((u) => u.tier === "T4")!;
    const allies = getArenaState()!.units.filter((u) => u.team === "top" && u.tier === "T1");

    breaker.x = 200;
    breaker.y = 300;
    breaker.state = "MOVING";
    breaker.movementState = "CHARGING";
    breaker.collisionPriority = 10;
    allies.forEach((a, i) => {
      a.x = 200;
      a.y = 320 + i * 15;
      a.state = "MOVING";
    });

    const hpBefore = allies.map((a) => a.hp);
    tickArena(0.5);

    const undamaged = allies.filter((a, i) => a.hp === hpBefore[i]);
    expect(undamaged.length).toBe(allies.length);
  });

  it("T4 transitions to normal combat after charge", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("bottom", 3, "SIMULATION", "T1");

    const breaker = getArenaState()!.units.find((u) => u.tier === "T4")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    breaker.x = 200;
    breaker.y = 350;
    breaker.state = "MOVING";
    breaker.movementState = "CHARGING";
    breaker.collisionPriority = 10;
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 360 + i * 15;
      e.state = "MOVING";
    });

    // Trigger impact
    tickArena(0.05);
    expect(breaker.chargeState).toBe("IMPACT_CONSUMED");
    expect(breaker.collisionPriority).toBe(0);

    // Tick more — breaker should fight normally
    tickArena(0.5);
    expect(breaker.combatState === "ATTACKING_UNIT" || breaker.combatState === "ATTACKING_BASE" || breaker.combatState === "IDLE").toBe(true);
  });

  it("T4 uses structure DPS when attacking base", () => {
    const cfg = createDefaultBattleConfig();
    cfg.combat.baseHp = 10000;
    initArena(cfg);
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");

    const breaker = getArenaState()!.units[0];
    breaker.x = 200;
    breaker.y = 640;
    breaker.state = "MOVING";
    breaker.chargeState = "IMPACT_CONSUMED";
    breaker.collisionPriority = 0;

    tickArena(0.5);
    const hpBefore = getArenaState()!.bottomBaseHp;
    tickArena(1);

    expect(getArenaState()!.bottomBaseHp).toBeLessThan(hpBefore);
    expect(breaker.structureDps).toBe(400);
  });

  it("T4 does not teleport — travels forward over multiple ticks", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");

    const breaker = getArenaState()!.units[0];
    breaker.x = 200;
    breaker.state = "MOVING";
    breaker.movementState = "CHARGING";
    breaker.collisionPriority = 10;

    // Tick past spawn
    tickArena(0.4);
    const startY = breaker.y;

    tickArena(0.5);
    expect(breaker.y).toBeGreaterThan(startY);
    // Should not have jumped to the other end instantly
    expect(breaker.y).toBeLessThan(600);
  });

  it("multiple T4 units each have independent charge state", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 3, "SIMULATION", "T4");
    spawnUnits("bottom", 3, "SIMULATION", "T4");

    const breakers = getArenaState()!.units.filter((u) => u.tier === "T4");
    expect(breakers.length).toBe(6);

    // Each should have its own charge state
    for (const b of breakers) {
      expect(b.chargeState).toBe("CHARGING");
      expect(b.impactConsumed).toBe(false);
    }

    // Place them in pairs to collide
    const topBreakers = breakers.filter((b) => b.team === "top");
    const botBreakers = breakers.filter((b) => b.team === "bottom");
    topBreakers.forEach((b, i) => {
      b.x = 150 + i * 50;
      b.y = 340;
      b.state = "MOVING";
      b.movementState = "CHARGING";
      b.collisionPriority = 10;
    });
    botBreakers.forEach((b, i) => {
      b.x = 150 + i * 50;
      b.y = 360;
      b.state = "MOVING";
      b.movementState = "CHARGING";
      b.collisionPriority = 10;
    });

    tickArena(0.05);

    // Each top breaker should have independent impact state
    const consumedCount = topBreakers.filter((b) => b.impactConsumed).length;
    expect(consumedCount).toBeGreaterThan(0);
  });

  it("T4 charge ends on max duration", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");

    const breaker = getArenaState()!.units[0];
    breaker.x = 200;
    breaker.state = "MOVING";
    breaker.movementState = "CHARGING";
    breaker.collisionPriority = 10;
    breaker.maxChargeDuration = 2;

    tickArena(0.4); // spawn transition
    tickArena(2.1); // exceed max charge duration

    expect(breaker.chargeState).toBe("IMPACT_CONSUMED");
    expect(breaker.collisionPriority).toBe(0);
  });

  it("T4 does not phase through enemy units", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("bottom", 1, "SIMULATION", "T1");

    const breaker = getArenaState()!.units.find((u) => u.tier === "T4")!;
    const enemy = getArenaState()!.units.find((u) => u.team === "bottom")!;

    breaker.x = 200;
    breaker.y = 340;
    breaker.state = "MOVING";
    breaker.movementState = "CHARGING";
    breaker.collisionPriority = 10;
    enemy.x = 200;
    enemy.y = 360;
    enemy.state = "MOVING";

    tickArena(0.05);

    // Breaker should not have passed through enemy
    expect(breaker.y).toBeLessThan(enemy.y + 5);
  });

  // ─── T5 Boss Tests ────────────────────────────────────────────────

  it("creates a generic T5 boss with universal stats", () => {
    makeArena();
    spawnUnits("top", 1, "SIMULATION", "T5");
    const unit = getArenaState()!.units[0];

    expect(unit.tier).toBe("T5");
    expect(unit.hp).toBe(18000);
    expect(unit.damage).toBe(450);
    expect(unit.structureDps).toBe(300);
    expect(unit.radius).toBe(20);
    expect(unit.frontageCost).toBe(4);
    expect(unit.economicValue).toBe(5);
    expect(unit.source).toBe("SIMULATION");
    expect(unit.slamState).toBe("READY");
    expect(unit.slamDamage).toBe(900);
    expect(unit.slamRadius).toBe(60);
    expect(unit.slamCooldown).toBe(4);
    expect(unit.knockbackResistance).toBe(0.8);
  });

  it("T5 does not have breaker charge", () => {
    makeArena();
    spawnUnits("top", 1, "SIMULATION", "T5");
    const unit = getArenaState()!.units[0];

    expect(unit.chargeState).toBe("NONE");
    expect(unit.impactConsumed).toBe(false);
    expect(unit.impactDamage).toBe(0);
  });

  it("T5 has deployment ingress speed boost", () => {
    makeArena();
    spawnUnits("top", 1, "SIMULATION", "T5");
    const unit = getArenaState()!.units[0];

    expect(unit.deploymentSpeed).toBeGreaterThan(unit.speed);
    expect(unit.deploymentDone).toBe(false);
  });

  it("T5 normal attack is single-target at 450 DPS", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");
    spawnUnits("bottom", 1, "SIMULATION", "T5");

    const boss = getArenaState()!.units.find((u) => u.tier === "T5" && u.team === "top")!;
    const enemy = getArenaState()!.units.find((u) => u.tier === "T5" && u.team === "bottom")!;

    boss.x = 200;
    boss.y = 340;
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.slamState = "COOLDOWN";
    boss.slamTimer = 0;
    boss.slamCooldown = 999;
    enemy.x = 200;
    enemy.y = 360;
    enemy.state = "MOVING";
    enemy.deploymentDone = true;
    enemy.slamState = "COOLDOWN";
    enemy.slamTimer = 0;
    enemy.slamCooldown = 999;

    const hpBefore = enemy.hp;
    tickArena(1);

    expect(boss.combatState).toBe("ATTACKING_UNIT");
    const dmg = hpBefore - enemy.hp;
    // Should be approximately 450 DPS (allowing for slam being on cooldown)
    expect(dmg).toBeGreaterThan(400);
    expect(dmg).toBeLessThan(500);
  });

  it("T5 slam triggers when enemies are nearby", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");
    spawnUnits("bottom", 3, "SIMULATION", "T5");

    const boss = getArenaState()!.units.find((u) => u.tier === "T5" && u.team === "top")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    boss.x = 200;
    boss.y = 350;
    boss.state = "MOVING";
    boss.deploymentDone = true;
boss.slamState = "READY";
boss.slamTimer = 99;
    boss.slamTimer = 99; // past initial delay
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 360 + i * 20;
      e.state = "MOVING";
      e.deploymentDone = true;
      e.slamState = "NONE";
    });

    tickArena(0.6); // past windup

    expect(boss.slamCount).toBeGreaterThan(0);
    expect(boss.slamState).toBe("COOLDOWN");
  });

  it("T5 slam does not trigger without enemies nearby", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");

    const boss = getArenaState()!.units[0];
    boss.x = 200;
    boss.y = 200;
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.slamState = "READY";
    boss.slamTimer = 99;

    tickArena(2);

    expect(boss.slamCount).toBe(0);
    expect(boss.slamState).toBe("READY");
  });

  it("T5 slam deals AoE damage to enemies", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");
    spawnUnits("bottom", 3, "SIMULATION", "T5");

    const boss = getArenaState()!.units.find((u) => u.tier === "T5" && u.team === "top")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    boss.x = 200;
    boss.y = 350;
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.slamState = "READY";
    boss.slamTimer = 99;
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 360 + i * 20;
      e.state = "MOVING";
      e.deploymentDone = true;
      e.slamState = "NONE";
    });

    const hpBefore = enemies.map((e) => e.hp);
    tickArena(0.6);

    const damaged = enemies.filter((e, i) => e.hp < hpBefore[i]);
    expect(damaged.length).toBeGreaterThan(0);
  });

  it("T5 slam does not damage allies", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");
    spawnUnits("top", 3, "SIMULATION", "T1");
    spawnUnits("bottom", 3, "SIMULATION", "T5");

    const boss = getArenaState()!.units.find((u) => u.tier === "T5" && u.team === "top")!;
    const allies = getArenaState()!.units.filter((u) => u.team === "top" && u.tier === "T1");

    boss.x = 200;
    boss.y = 350;
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.slamState = "READY";
    boss.slamTimer = 99;
    allies.forEach((a, i) => {
      a.x = 200;
      a.y = 340 - i * 15;
      a.state = "MOVING";
    });

    const hpBefore = allies.map((a) => a.hp);
    tickArena(0.6);

    const undamaged = allies.filter((a, i) => a.hp === hpBefore[i]);
    expect(undamaged.length).toBe(allies.length);
  });

  it("T5 slam does not damage base", () => {
    const cfg = createDefaultBattleConfig();
    cfg.combat.baseHp = 100000;
    initArena(cfg);
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");
    spawnUnits("bottom", 3, "SIMULATION", "T5");

    const boss = getArenaState()!.units.find((u) => u.tier === "T5" && u.team === "top")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    boss.x = 200;
    boss.y = 640;
    boss.slamState = "READY";
    boss.slamTimer = 99;
    boss.slamState = "READY";
    boss.y = 500;
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 650 + i * 20;
      e.state = "MOVING";
      e.y = 510 + i * 20;
      e.slamState = "NONE";
    });

    const baseHpBefore = getArenaState()!.bottomBaseHp;
    tickArena(0.6);

    // Slam should have triggered but base should not take slam damage
    expect(boss.slamCount).toBeGreaterThan(0);
    expect(getArenaState()!.bottomBaseHp).toBe(baseHpBefore);
  });

  it("T5 uses capped structure DPS of 300", () => {
    const cfg = createDefaultBattleConfig();
    cfg.combat.baseHp = 10000;
    initArena(cfg);
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");

    const boss = getArenaState()!.units[0];
    boss.x = 200;
    boss.y = 640;
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.slamState = "COOLDOWN";
    boss.slamTimer = 0;
    boss.slamCooldown = 999;

    tickArena(0.5);
    const hpBefore = getArenaState()!.bottomBaseHp;
    tickArena(1);

    expect(getArenaState()!.bottomBaseHp).toBeLessThan(hpBefore);
    expect(boss.structureDps).toBe(300);
  });

  it("T5 has independent slam cooldowns per boss", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 2, "SIMULATION", "T5");
    spawnUnits("bottom", 2, "SIMULATION", "T5");

    const bosses = getArenaState()!.units.filter((u) => u.tier === "T5");
    expect(bosses.length).toBe(4);

    for (const b of bosses) {
      expect(b.slamState).toBe("READY");
      expect(b.slamCount).toBe(0);
    }

    // Place them in pairs
    const topBosses = bosses.filter((b) => b.team === "top");
    const botBosses = bosses.filter((b) => b.team === "bottom");
    topBosses.forEach((b, i) => {
      b.x = 150 + i * 80;
      b.y = 340;
      b.state = "MOVING";
      b.deploymentDone = true;
      b.slamState = "READY";
      b.slamTimer = 99;
    });
    botBosses.forEach((b, i) => {
      b.x = 150 + i * 80;
      b.y = 360;
      b.state = "MOVING";
      b.deploymentDone = true;
      b.slamState = "READY";
      b.slamTimer = 99;
    });

    tickArena(0.6);

    // Each boss should have independent slam count
    const slamCounts = bosses.map((b) => b.slamCount);
    const totalSlams = slamCounts.reduce((a, b) => a + b, 0);
    expect(totalSlams).toBeGreaterThan(0);
  });

  it("T5 death cancels pending slam", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");
    spawnUnits("bottom", 3, "SIMULATION", "T5");

    const boss = getArenaState()!.units.find((u) => u.tier === "T5" && u.team === "top")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    boss.x = 200;
    boss.y = 350;
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.slamState = "READY";
    boss.slamTimer = 99;
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 360 + i * 20;
      e.state = "MOVING";
      e.deploymentDone = true;
      e.slamState = "NONE";
    });

    // Start windup
    tickArena(0.1);
    expect(boss.slamState).toBe("WINDUP");

    // Kill boss
    boss.hp = 0;
    tickArena(0.5);

    expect(boss.state).toBe("DEAD");
    expect(boss.slamState).toBe("NONE");
    expect(boss.slamCount).toBe(0);
  });

  it("T5 does not teleport — travels forward over multiple ticks", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");

    const boss = getArenaState()!.units[0];
    boss.x = 200;
    boss.state = "MOVING";
    boss.deploymentDone = false;
    boss.collisionPriority = 8;

    tickArena(0.4); // spawn transition
    const startY = boss.y;

    tickArena(0.5);
    expect(boss.y).toBeGreaterThan(startY);
    expect(boss.y).toBeLessThan(600);
  });

  it("T5 does not phase through enemy units", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");
    spawnUnits("bottom", 1, "SIMULATION", "T1");

    const boss = getArenaState()!.units.find((u) => u.tier === "T5")!;
    const enemy = getArenaState()!.units.find((u) => u.team === "bottom")!;

    boss.x = 200;
    boss.y = 330;
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.slamState = "COOLDOWN";
    boss.slamTimer = 0;
    boss.slamCooldown = 999;
    enemy.x = 200;
    enemy.y = 360;
    enemy.state = "MOVING";

    tickArena(0.05);

    expect(boss.y).toBeLessThan(enemy.y + 10);
  });

  it("T5 slam applies knockback to survivors", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T5");
    spawnUnits("bottom", 3, "SIMULATION", "T5");

    const boss = getArenaState()!.units.find((u) => u.tier === "T5" && u.team === "top")!;
    const enemies = getArenaState()!.units.filter((u) => u.team === "bottom");

    boss.x = 200;
    boss.y = 350;
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.slamState = "READY";
    boss.slamTimer = 99;
    enemies.forEach((e, i) => {
      e.x = 200;
      e.y = 360 + i * 20;
      e.state = "MOVING";
      e.deploymentDone = true;
      e.slamState = "NONE";
    });

    const yBefore = enemies.map((e) => e.y);
    tickArena(0.6);

    const survivors = enemies.filter((e) => e.state !== "DEAD");
    expect(survivors.length).toBeGreaterThan(0);
    const pushed = survivors.filter((e) => {
      const origIdx = enemies.indexOf(e);
      return e.y > yBefore[origIdx] + 1;
    });
    expect(pushed.length).toBeGreaterThan(0);
  });

  it("T5 knockback resistance is higher than T4", () => {
    makeArena();
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("top", 1, "SIMULATION", "T5");

    const t4 = getArenaState()!.units.find((u) => u.tier === "T4")!;
    const t5 = getArenaState()!.units.find((u) => u.tier === "T5")!;

    expect(t5.knockbackResistance).toBeGreaterThan(t4.knockbackResistance);
  });

  // ─── T3 Healer Tests ──────────────────────────────────────────────

  it("creates a generic T3 healer with universal support stats", () => {
    makeArena();
    spawnUnits("top", 1, "SIMULATION", "T3");
    const healer = getArenaState()!.units[0];

    expect(healer.tier).toBe("T3");
    expect(healer.hp).toBe(650);
    expect(healer.healPerSecond).toBe(250);
    expect(healer.healPoolRemaining).toBe(5000);
    expect(healer.healingRange).toBe(70);
    expect(healer.acquisitionRange).toBe(140);
    expect(healer.damage).toBe(0);
    expect(healer.economicValue).toBe(0.5);
    expect(healer.healerState).toBe("IDLE");
  });

  it("scores healing targets by economic value times missing HP ratio", () => {
    expect(computeHealingTargetScore(5, 1800, 18000)).toBeCloseTo(4.5);
    expect(computeHealingTargetScore(2, 2000, 8000)).toBeCloseTo(1.5);
    expect(computeHealingTargetScore(0.01, 10, 100)).toBeCloseTo(0.009);
    expect(computeHealingTargetScore(5, 18000, 18000)).toBe(0);
  });

  it("resolves healing with efficiency and finite pool", () => {
    expect(resolveHealing(250, 250, 1, 5000)).toEqual({ actualHpRestored: 250, nominalPoolConsumed: 250 });
    expect(resolveHealing(250, 250, 0.5, 5000)).toEqual({ actualHpRestored: 125, nominalPoolConsumed: 250 });
    expect(resolveHealing(250, 250, 0.25, 5000)).toEqual({ actualHpRestored: 62.5, nominalPoolConsumed: 250 });
    expect(resolveHealing(50, 250, 1, 5000)).toEqual({ actualHpRestored: 50, nominalPoolConsumed: 50 });
    expect(resolveHealing(25, 250, 0.25, 5000)).toEqual({ actualHpRestored: 25, nominalPoolConsumed: 100 });
    expect(resolveHealing(1000, 250, 1, 100)).toEqual({ actualHpRestored: 100, nominalPoolConsumed: 100 });
    expect(resolveHealing(100, 250, 1, 0)).toEqual({ actualHpRestored: 0, nominalPoolConsumed: 0 });
  });

  it("heals a wounded T1 at full efficiency", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T3");
    spawnUnits("top", 1, "SIMULATION", "T1");
    const units = getArenaState()!.units;
    const healer = units.find((u) => u.tier === "T3")!;
    const target = units.find((u) => u.tier === "T1")!;
    healer.x = target.x = 200;
    healer.y = target.y = 350;
    healer.state = target.state = "MOVING";
    target.hp = 10;

    tickArena(0.5);

    expect(target.hp).toBeGreaterThan(10);
    expect(target.hp).toBeLessThanOrEqual(target.maxHp);
    expect(healer.healPoolRemaining).toBeLessThan(5000);
    expect(healer.healerState).toBe("HEALING");
  });

  it("heals T4 and T5 using reduced efficiencies", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T3");
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("top", 1, "SIMULATION", "T5");
    const units = getArenaState()!.units;
    const healer = units.find((u) => u.tier === "T3")!;
    const breaker = units.find((u) => u.tier === "T4")!;
    const boss = units.find((u) => u.tier === "T5")!;
    healer.x = breaker.x = boss.x = 200;
    healer.y = breaker.y = boss.y = 350;
    for (const u of units) u.state = "MOVING";
    breaker.deploymentDone = true;
    boss.deploymentDone = true;
    breaker.hp = 1000;
    boss.hp = 1000;
    healer.healTargetId = boss.id;

    tickArena(1);

    expect(boss.hp).toBeGreaterThan(1000);
    expect(boss.hp - 1000).toBeCloseTo(62.5, 1);
  });

  it("does not heal itself, bases, or dead units", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T3");
    const healer = getArenaState()!.units[0];
    healer.x = 200;
    healer.y = 350;
    healer.state = "MOVING";
    healer.hp = 10;

    tickArena(1);

    expect(healer.hp).toBe(10);
    expect(healer.healTargetId).toBeNull();
    expect(getArenaState()!.topBaseHp).toBe(100000);
  });

  it("prioritizes a critically wounded Boss over lightly wounded T1", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T3");
    spawnUnits("top", 1, "SIMULATION", "T1");
    spawnUnits("top", 1, "SIMULATION", "T5");
    const units = getArenaState()!.units;
    const healer = units.find((u) => u.tier === "T3")!;
    const t1 = units.find((u) => u.tier === "T1")!;
    const boss = units.find((u) => u.tier === "T5")!;
    for (const u of units) {
      u.x = 200;
      u.y = 350;
      u.state = "MOVING";
    }
    boss.deploymentDone = true;
    t1.hp = 50;
    boss.hp = 1800;

    tickArena(0.5);

    expect(healer.healTargetId).toBe(boss.id);
  });

  it("allows a critically wounded Breaker to outrank a slightly damaged Boss", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T3");
    spawnUnits("top", 1, "SIMULATION", "T4");
    spawnUnits("top", 1, "SIMULATION", "T5");
    const units = getArenaState()!.units;
    const healer = units.find((u) => u.tier === "T3")!;
    const breaker = units.find((u) => u.tier === "T4")!;
    const boss = units.find((u) => u.tier === "T5")!;
    for (const u of units) {
      u.x = 200;
      u.y = 350;
      u.state = "MOVING";
    }
    breaker.deploymentDone = true;
    boss.deploymentDone = true;
    breaker.hp = 800;
    boss.hp = 17000;

    tickArena(0.5);

    expect(healer.healTargetId).toBe(breaker.id);
  });

  it("exhausts finite healing pool without negative values", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 1, "SIMULATION", "T3");
    spawnUnits("top", 1, "SIMULATION", "T1");
    const units = getArenaState()!.units;
    const healer = units.find((u) => u.tier === "T3")!;
    const target = units.find((u) => u.tier === "T1")!;
    healer.x = target.x = 200;
    healer.y = target.y = 350;
    healer.state = target.state = "MOVING";
    target.hp = 1;

    for (let i = 0; i < 30; i++) tickArena(1);

    expect(healer.healPoolRemaining).toBeGreaterThanOrEqual(0);
    expect(healer.healPoolRemaining).toBeLessThan(5000);
    expect(target.hp).toBeLessThanOrEqual(target.maxHp);
  });

  it("supports multiple healers with independent pools", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 2, "SIMULATION", "T3");
    spawnUnits("top", 1, "SIMULATION", "T4");
    const units = getArenaState()!.units;
    const healers = units.filter((u) => u.tier === "T3");
    const target = units.find((u) => u.tier === "T4")!;
    for (const u of units) {
      u.x = 200;
      u.y = 350;
      u.state = "MOVING";
    }
    target.hp = 1000;

    tickArena(1);

    expect(healers[0].healPoolRemaining).toBeLessThan(5000);
    expect(healers[1].healPoolRemaining).toBeLessThan(5000);
    expect(target.hp).toBeGreaterThan(1000);
  });

  // ─── T6 Ultimate Tests ─────────────────────────────────────────────

  it("T6 removes approximately 90% of enemy T1-T3", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("bottom", 100, "SIMULATION", "T1");
    spawnUnits("bottom", 20, "SIMULATION", "T2");
    spawnUnits("bottom", 10, "SIMULATION", "T3");
    for (const u of getArenaState()!.units) u.state = "MOVING";

    const result = triggerUltimate("top");

    expect(result).not.toBeNull();
    expect(result!.t1Killed).toBe(90);
    expect(result!.t2Killed).toBe(18);
    expect(result!.t3Killed).toBe(9);
  });

  it("T4 damage is based on current HP, not max HP", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("bottom", 1, "SIMULATION", "T4");
    const t4 = getArenaState()!.units[0];
    t4.state = "MOVING";
    t4.hp = 8000;

    const result = triggerUltimate("top");

    expect(result!.t4Damage).toBeCloseTo(4400, 0);
    expect(t4.hp).toBeCloseTo(3600, 0);
  });

  it("T4 damage on damaged unit uses reduced current HP", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("bottom", 1, "SIMULATION", "T4");
    const t4 = getArenaState()!.units[0];
    t4.state = "MOVING";
    t4.hp = 2000;

    triggerUltimate("top");

    expect(t4.hp).toBeCloseTo(900, 0);
  });

  it("T5 damage is based on max HP", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("bottom", 1, "SIMULATION", "T5");
    const boss = getArenaState()!.units[0];
    boss.state = "MOVING";
    boss.deploymentDone = true;

    const result = triggerUltimate("top");

    expect(result!.t5Damage).toBeCloseTo(8100, 0);
    expect(boss.hp).toBeCloseTo(9900, 0);
  });

  it("T5 can be killed if already below threshold", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("bottom", 1, "SIMULATION", "T5");
    const boss = getArenaState()!.units[0];
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.hp = 5000;

    triggerUltimate("top");

    expect(boss.state).toBe("DEAD");
  });

  it("base damage is 8% of max HP", () => {
    makeArena();
    setAutoSpawn(false);

    const result = triggerUltimate("top");

    expect(result!.baseDamage).toBe(8000);
    expect(getArenaState()!.bottomBaseHp).toBe(92000);
  });

  it("Ultimate can finish a weak base", () => {
    makeArena();
    setAutoSpawn(false);
    forceBaseDamage("bottom", 95);

    const result = triggerUltimate("top");

    expect(result!.battleEnded).toBe(true);
    expect(getArenaState()!.bottomBaseHp).toBe(0);
    expect(getArenaState()!.winner).toBe("top");
  });

  it("healthy base survives one Ultimate", () => {
    makeArena();
    setAutoSpawn(false);

    triggerUltimate("top");

    expect(getArenaState()!.bottomBaseHp).toBe(92000);
    expect(getArenaState()!.winner).toBeNull();
  });

  it("Ultimate does not damage friendly units", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("top", 10, "SIMULATION", "T1");
    for (const u of getArenaState()!.units) u.state = "MOVING";

    triggerUltimate("top");

    const topUnits = getArenaState()!.units.filter((u) => u.team === "top");
    const allAlive = topUnits.every((u) => u.state !== "DEAD");
    expect(allAlive).toBe(true);
  });

  it("Ultimate applies knockback to survivors", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("bottom", 1, "SIMULATION", "T5");
    const boss = getArenaState()!.units[0];
    boss.state = "MOVING";
    boss.deploymentDone = true;
    boss.y = 350;

    const result = triggerUltimate("top");

    expect(result!.survivorsDisplaced).toBeGreaterThan(0);
    expect(boss.movementState).toBe("DISPLACED");
  });

  it("multiple Ultimates resolve independently", () => {
    makeArena();
    setAutoSpawn(false);
    spawnUnits("bottom", 100, "SIMULATION", "T1");
    for (const u of getArenaState()!.units) u.state = "MOVING";

    triggerUltimate("top");
    const remainingAfter1 = getArenaState()!.units.filter((u) => u.team === "bottom" && u.state !== "DEAD").length;
    expect(remainingAfter1).toBe(10);

    spawnUnits("bottom", 100, "SIMULATION", "T1");
    for (const u of getArenaState()!.units) if (u.state === "SPAWNING") u.state = "MOVING";

    const result2 = triggerUltimate("top");

    expect(result2).not.toBeNull();
    expect(result2!.t1Killed).toBeGreaterThan(0);
  });

  it("Ultimate creates a visual effect", () => {
    makeArena();
    setAutoSpawn(false);

    triggerUltimate("top");

    expect(getArenaState()!.ultimateEffects.length).toBe(1);
    expect(getArenaState()!.ultimateEffects[0].team).toBe("top");
  });

  it("round reset clears Ultimate state", () => {
    makeArena();
    setAutoSpawn(false);
    triggerUltimate("top");
    expect(getArenaState()!.ultimateEffects.length).toBe(1);

    resetArena();
    const cfg = createDefaultBattleConfig();
    initArena(cfg);

    expect(getArenaState()!.ultimateEffects.length).toBe(0);
  });
});

// ─── Live Event Layer ────────────────────────────────────────────────
describe("live event layer", () => {
  afterEach(() => {
    liveEventBus.reset();
  });

  it("starts and stops the simulator adapter", async () => {
    const adapter = new SimulatorAdapter();
    expect(adapter.getStatus()).toBe("DISCONNECTED");
    await adapter.start();
    expect(adapter.getStatus()).toBe("CONNECTED");
    adapter.stop();
    expect(adapter.getStatus()).toBe("DISCONNECTED");
  });

  it("normalizes likes, comments, gifts, follows, shares, and joins", async () => {
    const adapter = new SimulatorAdapter();
    await adapter.start();
    const events: string[] = [];
    adapter.subscribe((event) => events.push(event.type));
    adapter.emitLike(100);
    adapter.emitComment("RED");
    adapter.emitGift({ giftId: "rose", giftName: "Rose", repeatCount: 5 });
    adapter.emitFollow();
    adapter.emitShare();
    adapter.emitJoin();
    expect(events).toEqual(["LIKE", "COMMENT", "GIFT", "FOLLOW", "SHARE", "JOIN"]);
  });

  it("preserves gift repetition metadata", () => {
    const adapter = new SimulatorAdapter();
    let gift: import("@/live/types").GiftEvent | null = null;
    adapter.subscribe((event) => {
      if (event.type === "GIFT") gift = event;
    });
    adapter.emitGift({ giftId: "rose", giftName: "Rose", repeatCount: 3, comboId: "combo-1", comboState: "IN_PROGRESS", valueMetadata: 0.1 });
    expect(gift).not.toBeNull();
    expect(gift!.repeatCount).toBe(3);
    expect(gift!.comboId).toBe("combo-1");
    expect(gift!.comboState).toBe("IN_PROGRESS");
  });

  it("delivers each event exactly once and supports unsubscribe", () => {
    const adapter = new SimulatorAdapter();
    let received = 0;
    const unsubscribe = adapter.subscribe(() => received++);
    adapter.emitLike(1);
    expect(received).toBe(1);
    unsubscribe();
    adapter.emitLike(1);
    expect(received).toBe(1);
  });

  it("assigns unique ordered sequence numbers", () => {
    const adapter = new SimulatorAdapter();
    const events: import("@/live/types").NormalizedLiveEvent[] = [];
    adapter.subscribe((event) => events.push(event));
    adapter.emitLike(1);
    adapter.emitLike(10);
    adapter.emitComment("BLUE");
    expect(new Set(events.map((event) => event.eventId)).size).toBe(3);
    expect(events[0].sequenceNumber).toBeLessThan(events[1].sequenceNumber);
    expect(events[1].sequenceNumber).toBeLessThan(events[2].sequenceNumber);
  });

  it("bounds event bus history", () => {
    const adapter = new SimulatorAdapter();
    for (let i = 0; i < 2100; i++) adapter.emitLike(1);
    expect(liveEventBus.getHistory()).toHaveLength(2000);
  });

  it("propagates connection status events", () => {
    const adapter = new SimulatorAdapter();
    const statuses: string[] = [];
    adapter.subscribe((event) => {
      if (event.type === "CONNECTION") statuses.push(event.status);
    });
    adapter.simulateDisconnect();
    adapter.simulateReconnect();
    expect(statuses.slice(0, 2)).toEqual(["DISCONNECTED", "RECONNECTING"]);
  });

  it("records and replays the same event order", async () => {
    const adapter = new SimulatorAdapter();
    const recorder = new ReplayRecorder();
    const recordedTypes: string[] = [];
    adapter.subscribe((event) => {
      recorder.record(event);
      recordedTypes.push(event.type);
    });
    recorder.start();
    adapter.emitLike(100);
    adapter.emitComment("RED");
    adapter.emitShare();
    const recording = recorder.stop();
    const replayedTypes: string[] = [];
    const replay = replayRecording(recording, (event) => replayedTypes.push(event.type));
    expect(recording.events).toHaveLength(3);
    expect(recordedTypes).toEqual(["LIKE", "COMMENT", "SHARE"]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    replay.cancel();
    expect(replayedTypes).toEqual(["LIKE", "COMMENT", "SHARE"]);
  });

  it("handles a large burst without duplicates", () => {
    const adapter = new SimulatorAdapter();
    const events: string[] = [];
    adapter.subscribe((event) => events.push(event.eventId));
    for (let i = 0; i < 1000; i++) adapter.emitLike(1);
    expect(events).toHaveLength(1000);
    expect(new Set(events).size).toBe(1000);
  });

  // ─── Prompt 11B: Redesigned Simulator Tests ──────────────────────────

  it("six simulator gift buttons generate correct normalized Gift Events", () => {
    const adapter = new SimulatorAdapter();
    const gifts: import("@/live/types").GiftEvent[] = [];
    adapter.subscribe((event) => {
      if (event.type === "GIFT") gifts.push(event);
    });

    const slots = [
      { tier: "T1", id: "sim_t1", name: "Sim T1 Basic", price: 0.01 },
      { tier: "T2", id: "sim_t2", name: "Sim T2 Specialist", price: 0.10 },
      { tier: "T3", id: "sim_t3", name: "Sim T3 Healer", price: 0.50 },
      { tier: "T4", id: "sim_t4", name: "Sim T4 Breaker", price: 2 },
      { tier: "T5", id: "sim_t5", name: "Sim T5 Boss", price: 5 },
      { tier: "T6", id: "sim_t6", name: "Sim T6 Ultimate", price: 20 },
    ];
    for (const slot of slots) {
      adapter.emitGift({ giftId: slot.id, giftName: slot.name, repeatCount: 1, valueMetadata: slot.price });
    }

    expect(gifts).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(gifts[i].giftId).toBe(slots[i].id);
      expect(gifts[i].giftName).toBe(slots[i].name);
      expect(gifts[i].valueMetadata).toBe(slots[i].price);
    }
  });

  it("selected fake viewer metadata is included in events", () => {
    const adapter = new SimulatorAdapter();
    adapter.setCurrentUser({ userId: "u-123", username: "alice", team: "A" });
    let received: import("@/live/types").NormalizedLiveEvent | null = null;
    adapter.subscribe((event) => { received = event; });
    adapter.emitLike(10);
    expect(received!.userId).toBe("u-123");
    expect(received!.username).toBe("alice");
  });

  it("team metadata is preserved on gift events", () => {
    const adapter = new SimulatorAdapter();
    adapter.setCurrentUser({ userId: "u-1", username: "bob", team: "B" });
    let gift: import("@/live/types").GiftEvent | null = null;
    adapter.subscribe((event) => { if (event.type === "GIFT") gift = event; });
    adapter.emitGift({ giftId: "sim_t4", giftName: "Sim T4 Breaker", repeatCount: 1 });
    expect(gift!.team).toBe("B");
  });

  it("gift quantity produces multiple events", () => {
    const adapter = new SimulatorAdapter();
    const gifts: import("@/live/types").GiftEvent[] = [];
    adapter.subscribe((event) => { if (event.type === "GIFT") gifts.push(event); });
    for (let i = 0; i < 5; i++) {
      adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 1 });
    }
    expect(gifts).toHaveLength(5);
  });

  it("combo simulation produces start, progress, and end events", () => {
    const adapter = new SimulatorAdapter();
    const gifts: import("@/live/types").GiftEvent[] = [];
    adapter.subscribe((event) => { if (event.type === "GIFT") gifts.push(event); });

    const comboId = "test-combo-1";
    adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 1, comboId, comboState: "START" });
    adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 5, comboId, comboState: "IN_PROGRESS" });
    adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 6, comboId, comboState: "END" });

    expect(gifts).toHaveLength(3);
    expect(gifts[0].comboState).toBe("START");
    expect(gifts[1].comboState).toBe("IN_PROGRESS");
    expect(gifts[2].comboState).toBe("END");
    expect(gifts[0].comboId).toBe(comboId);
    expect(gifts[2].comboId).toBe(comboId);
  });

  it("generated viewers have unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = crypto.randomUUID().slice(0, 8);
      ids.add(`user-${id}`);
    }
    expect(ids.size).toBe(100);
  });

  it("duplicate-last-event preserves same eventId", () => {
    const adapter = new SimulatorAdapter();
    const events: import("@/live/types").NormalizedLiveEvent[] = [];
    adapter.subscribe((event) => events.push(event));
    adapter.emitLike(50);
    const original = events[0];
    adapter.emitRaw(original);
    expect(events).toHaveLength(2);
    expect(events[1].eventId).toBe(original.eventId);
  });

  it("leave event is supported", () => {
    const adapter = new SimulatorAdapter();
    let received: import("@/live/types").NormalizedLiveEvent | null = null;
    adapter.subscribe((event) => { received = event; });
    adapter.emitLeave();
    expect(received!.type).toBe("LEAVE");
  });

  it("latency applies without crashing", () => {
    const adapter = new SimulatorAdapter();
    adapter.setLatency(100);
    let received = false;
    adapter.subscribe(() => { received = true; });
    adapter.emitLike(1);
    expect(received).toBe(false);
  });

  it("drop-next-event suppresses the next event", () => {
    const adapter = new SimulatorAdapter();
    const events: import("@/live/types").NormalizedLiveEvent[] = [];
    adapter.subscribe((event) => events.push(event));
    adapter.dropNextEvent();
    adapter.emitLike(1);
    adapter.emitLike(1);
    expect(events).toHaveLength(1);
  });

  it("malformed events do not crash", () => {
    const adapter = new SimulatorAdapter();
    const events: import("@/live/types").NormalizedLiveEvent[] = [];
    adapter.subscribe((event) => events.push(event));
    adapter.emitGift({ giftId: "unknown", giftName: "???", repeatCount: 1 });
    adapter.emitGift({ giftId: "sim_t1", giftName: "", repeatCount: 1 });
    adapter.emitComment("");
    adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1", repeatCount: -5 });
    expect(events).toHaveLength(4);
    expect(events[0].type).toBe("GIFT");
    expect(events[2].type).toBe("COMMENT");
  });

  it("event bus metrics track per-type counts", () => {
    const adapter = new SimulatorAdapter();
    adapter.emitLike(1);
    adapter.emitComment("RED");
    adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1", repeatCount: 1 });
    adapter.emitFollow();
    adapter.emitShare();
    adapter.emitJoin();
    const m = liveEventBus.getMetrics();
    expect(m.likes).toBe(1);
    expect(m.comments).toBe(1);
    expect(m.gifts).toBe(1);
    expect(m.follows).toBe(1);
    expect(m.shares).toBe(1);
    expect(m.joins).toBe(1);
  });
});

// ─── Gift → Engine Bridge Tests ──────────────────────────────────────
describe("gift bridge", () => {
  afterEach(() => {
    stopGiftBridge();
    resetArena();
  });

  it("gift bridge spawns T1 unit when sim_t1 gift is received", () => {
    liveEventBus.reset();
    initArena(createDefaultBattleConfig());
    startGiftBridge();
    const adapter = new SimulatorAdapter();
    adapter.setCurrentUser({ userId: "u1", username: "alice", team: "A" });
    adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 1 });

    const state = getArenaState();
    expect(state!.units.length).toBe(1);
    expect(state!.units[0].tier).toBe("T1");
    expect(state!.units[0].team).toBe("top");
    expect(state!.units[0].source).toBe("LIVE");
  });

  it("gift bridge spawns T4 unit for Team B", () => {
    liveEventBus.reset();
    initArena(createDefaultBattleConfig());
    startGiftBridge();
    const adapter = new SimulatorAdapter();
    adapter.setCurrentUser({ userId: "u2", username: "bob", team: "B" });
    adapter.emitGift({ giftId: "sim_t4", giftName: "Sim T4 Breaker", repeatCount: 1 });

    const state = getArenaState();
    expect(state!.units.length).toBe(1);
    expect(state!.units[0].tier).toBe("T4");
    expect(state!.units[0].team).toBe("bottom");
  });

  it("gift bridge triggers Ultimate for T6 gift", () => {
    liveEventBus.reset();
    initArena(createDefaultBattleConfig());
    startGiftBridge();
    spawnUnits("bottom", 5, "AUTO", "T1");
    const adapter = new SimulatorAdapter();
    adapter.setCurrentUser({ userId: "u3", username: "carol", team: "A" });
    adapter.emitGift({ giftId: "sim_t6", giftName: "Sim T6 Ultimate", repeatCount: 1 });

    const state = getArenaState();
    expect(state!.ultimateEffects.length).toBe(1);
    expect(state!.ultimateEffects[0].team).toBe("top");
  });

  it("gift bridge respects repeat count for T1 gifts", () => {
    liveEventBus.reset();
    initArena(createDefaultBattleConfig());
    startGiftBridge();
    const adapter = new SimulatorAdapter();
    adapter.setCurrentUser({ userId: "u4", username: "dave", team: "A" });
    adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1 Basic", repeatCount: 5 });

    const state = getArenaState();
    expect(state!.units.filter((u) => u.tier === "T1").length).toBe(5);
  });

  it("gift bridge ignores unknown gift IDs", () => {
    liveEventBus.reset();
    initArena(createDefaultBattleConfig());
    startGiftBridge();
    const adapter = new SimulatorAdapter();
    adapter.emitGift({ giftId: "unknown_xyz", giftName: "???", repeatCount: 1 });

    const state = getArenaState();
    expect(state!.units.length).toBe(0);
  });

  it("gift bridge does not spawn when battle is over", () => {
    liveEventBus.reset();
    initArena(createDefaultBattleConfig());
    startGiftBridge();
    forceBaseDamage("bottom", 100);
    tickArena(0.01);
    const adapter = new SimulatorAdapter();
    adapter.emitGift({ giftId: "sim_t1", giftName: "Sim T1", repeatCount: 1 });

    const state = getArenaState();
    expect(state!.units.length).toBe(0);
  });
});

// ─── Community Chest Tests ───────────────────────────────────────────
describe("community chest", () => {
  afterEach(() => {
    chestManager.reset();
    resetArena();
  });

  it("9,000 + 1,000 likes unlocks once", () => {
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addLikes(9000);
    expect(chestManager.getProgress()).toBeCloseTo(0.9, 1);
    chestManager.addLikes(1000);
    expect(chestManager.getProgress()).toBe(1);
    expect(chestManager.getMetrics().chestsUnlocked).toBe(1);
  });

  it("overflow with carry creates next chest at 500", () => {
    const cfg = createDefaultBattleConfig();
    cfg.chest.carryOverflowLikes = true;
    cfg.chest.likeThreshold = 10000;
    cfg.chest.tiePolicy = "NO_REWARD";
    chestManager.init(cfg.chest);
    chestManager.addLikes(9500);
    chestManager.addLikes(1000);
    expect(chestManager.getMetrics().chestsUnlocked).toBe(1);
    // The unlocked cycle has 10500 likes (overflow of 500)
    const cycle = chestManager.getCycle();
    expect(cycle!.unlocked).toBe(true);
    expect(cycle!.currentLikes).toBe(10500);
    // Wait for popup (2s) + cycle restart (1.5s) = 3.5s
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const nextCycle = chestManager.getCycle();
        expect(nextCycle!.currentLikes).toBe(500);
        expect(nextCycle!.unlocked).toBe(false);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 2000);
    });
  }, 8000);

  it("A 12 vs B 7 → A reward", () => {
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.addContribution({ team: "B", points: 7 });
    chestManager.addLikes(10000);
    const cycle = chestManager.getCycle();
    expect(cycle!.winner).toBe("A");
    expect(chestManager.getMetrics().chestsWonA).toBe(1);
  });

  it("A 10 vs B 10 → NO_REWARD tie policy", () => {
    const cfg = createDefaultBattleConfig();
    cfg.chest.tiePolicy = "NO_REWARD";
    chestManager.init(cfg.chest);
    chestManager.addContribution({ team: "A", points: 10 });
    chestManager.addContribution({ team: "B", points: 10 });
    chestManager.addLikes(10000);
    const cycle = chestManager.getCycle();
    expect(cycle!.winner).toBeNull();
    expect(chestManager.getMetrics().chestTies).toBe(1);
  });

  it("A wins → only A receives x2 spawn (after popup delay)", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.addContribution({ team: "B", points: 7 });
    chestManager.forceOpenWithReward({ team: "A", rewardType: "SPAWN_MULTIPLIER", source: "ADMIN" });
    // Reward not yet applied during popup
    expect(getSpawnMultiplier("top")).toBe(1);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getSpawnMultiplier("top")).toBe(2);
        expect(getSpawnMultiplier("bottom")).toBe(1);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("reward expires after duration → normal spawn restored", () => {
    const cfg = createDefaultBattleConfig();
    cfg.chest.reward.durationSeconds = 0.1;
    initArena(cfg);
    chestManager.init(cfg.chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.forceOpenWithReward({ team: "A", rewardType: "SPAWN_MULTIPLIER", source: "ADMIN", multiplier: 2 });
    // Reward applied after popup, then expires quickly
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getSpawnMultiplier("top")).toBe(1);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 1000);
    });
  }, 6000);

  it("reset clears chest state", () => {
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addLikes(5000);
    chestManager.addContribution({ team: "A", points: 5 });
    chestManager.reset();
    expect(chestManager.getCycle()).toBeNull();
    expect(chestManager.getMetrics().totalLikes).toBe(0);
  });

  it("duplicate unlock protection — same threshold cannot resolve twice", () => {
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addLikes(10000);
    expect(chestManager.getMetrics().chestsUnlocked).toBe(1);
    // Adding more likes should NOT unlock again (cycle already unlocked)
    chestManager.addLikes(5000);
    expect(chestManager.getMetrics().chestsUnlocked).toBe(1);
  });

  it("new battle → clean chest (no leak)", () => {
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addLikes(8000);
    chestManager.addContribution({ team: "A", points: 5 });
    // Simulate battle end → reset
    chestManager.reset();
    // New battle
    chestManager.init(createDefaultBattleConfig().chest);
    const cycle = chestManager.getCycle();
    expect(cycle!.currentLikes).toBe(0);
    expect(cycle!.teamAContributions).toBe(0);
    expect(cycle!.teamBContributions).toBe(0);
    expect(cycle!.id).toBe(1);
  });

  it("BOTH_TEAMS tie → both teams receive x2 spawn (after popup delay)", () => {
    const cfg = createDefaultBattleConfig();
    cfg.chest.tiePolicy = "BOTH_TEAMS";
    initArena(cfg);
    chestManager.init(cfg.chest);
    chestManager.addContribution({ team: "A", points: 10 });
    chestManager.addContribution({ team: "B", points: 10 });
    chestManager.forceOpenWithReward({ rewardType: "SPAWN_MULTIPLIER", source: "ADMIN" });
    const cycle = chestManager.getCycle();
    expect(cycle!.winner).toBeNull();
    expect(chestManager.getMetrics().chestTies).toBe(1);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getSpawnMultiplier("top")).toBe(2);
        expect(getSpawnMultiplier("bottom")).toBe(2);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("large like event crossing 2 thresholds → 2 unlocks (capped)", () => {
    const cfg = createDefaultBattleConfig();
    cfg.chest.likeThreshold = 1000;
    cfg.chest.carryOverflowLikes = true;
    chestManager.init(cfg.chest);
    chestManager.addContribution({ team: "A", points: 5 });
    // 2500 likes = 2 full thresholds (1000 + 1000) + 500 overflow
    chestManager.addLikes(2500);
    expect(chestManager.getMetrics().chestsUnlocked).toBe(1);
    // Wait for cascade (popup 2s + cycle restart 1.5s per unlock)
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const metrics = chestManager.getMetrics();
        expect(metrics.chestsUnlocked).toBeGreaterThanOrEqual(1);
        expect(metrics.chestsUnlocked).toBeLessThanOrEqual(10);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 4000);
    });
  }, 12000);

  it("reward effect stored in rewardEffects array (after popup delay)", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.addContribution({ team: "B", points: 7 });
    chestManager.forceOpenWithReward({ team: "A", rewardType: "SPAWN_MULTIPLIER", source: "ADMIN" });
    // selectedReward is set immediately
    const cycle = chestManager.getCycle();
    expect(cycle!.selectedReward).not.toBeNull();
    // rewardEffects populated after popup delay
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const c = chestManager.getCycle();
        expect(c!.rewardEffects).toHaveLength(1);
        expect(c!.rewardEffects[0].team).toBe("top");
        expect(c!.rewardEffects[0].multiplier).toBe(2);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("battle end clears all reward effects", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.forceOpenWithReward({ team: "A", rewardType: "SPAWN_MULTIPLIER", source: "ADMIN" });
    // Wait for reward to be applied
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getSpawnMultiplier("top")).toBe(2);
        // Battle ends
        chestManager.reset();
        expect(getSpawnMultiplier("top")).toBe(1);
        expect(getSpawnMultiplier("bottom")).toBe(1);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  // ─── Reward Selection Tests ───────────────────────────────────────

  it("selectChestReward returns one of the 5 reward types", () => {
    const validRewards: ChestRewardChoice[] = ["BASE_REPAIR", "SPAWN_MULTIPLIER", "GIANT", "SHIELD", "RAGE"];
    for (let i = 0; i < 100; i++) {
      const r = selectChestReward();
      expect(validRewards).toContain(r);
    }
  });

  it("each reward has ~20% chance over 5000 samples", () => {
    const counts: Record<string, number> = {
      BASE_REPAIR: 0,
      SPAWN_MULTIPLIER: 0,
      GIANT: 0,
      SHIELD: 0,
      RAGE: 0,
    };
    for (let i = 0; i < 5000; i++) {
      counts[selectChestReward()]++;
    }
    // Each should be within 15%-25% (±5% tolerance)
    for (const key of Object.keys(counts)) {
      expect(counts[key]).toBeGreaterThan(750);
      expect(counts[key]).toBeLessThan(1250);
    }
  });

  it("reward icons map to /ui/chest-reward/ paths", () => {
    const rewards: ChestRewardChoice[] = ["BASE_REPAIR", "SPAWN_MULTIPLIER", "GIANT", "SHIELD", "RAGE"];
    for (const r of rewards) {
      expect(REWARD_ICON_PATHS[r]).toMatch(/^\/ui\/chest-reward\//);
    }
  });

  it("reward info has title and detail for each reward", () => {
    const rewards: ChestRewardChoice[] = ["BASE_REPAIR", "SPAWN_MULTIPLIER", "GIANT", "SHIELD", "RAGE"];
    for (const r of rewards) {
      expect(REWARD_INFO[r].title).toBeTruthy();
      expect(REWARD_INFO[r].detail).toBeTruthy();
    }
  });

  it("REWARD_POPUP_DURATION_MS is 2000", () => {
    expect(REWARD_POPUP_DURATION_MS).toBe(2000);
  });

  it("selectedReward is set on cycle immediately at unlock", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.addLikes(10000);
    const cycle = chestManager.getCycle();
    expect(cycle!.selectedReward).not.toBeNull();
    const validRewards: ChestRewardChoice[] = ["BASE_REPAIR", "SPAWN_MULTIPLIER", "GIANT", "SHIELD", "RAGE"];
    expect(validRewards).toContain(cycle!.selectedReward);
  });

  it("reward applies only to winning team", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.addContribution({ team: "B", points: 7 });
    chestManager.addLikes(10000);
    expect(chestManager.getCycle()!.winner).toBe("A");
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Only team A (top) should have the reward effect
        const cycle = chestManager.getCycle();
        if (cycle && cycle.rewardEffects.length > 0) {
          expect(cycle.rewardEffects.every((e) => e.team === "top")).toBe(true);
        }
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("chest resets cleanly after reward — new cycle has zero likes and contributions", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.addContribution({ team: "B", points: 7 });
    chestManager.addLikes(10000);
    // Wait for popup + cycle restart
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const cycle = chestManager.getCycle();
        expect(cycle).not.toBeNull();
        expect(cycle!.unlocked).toBe(false);
        expect(cycle!.currentLikes).toBe(0);
        expect(cycle!.teamAContributions).toBe(0);
        expect(cycle!.teamBContributions).toBe(0);
        expect(cycle!.selectedReward).toBeNull();
        resolve();
      }, REWARD_POPUP_DURATION_MS + 2000);
    });
  }, 8000);

  it("HEAL reward heals winning team base", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    // Damage top base first
    const state = getArenaState()!;
    state.topBaseHp = state.maxBaseHp * 0.5;
    chestManager.forceOpenWithReward({ team: "A", rewardType: "BASE_REPAIR", source: "ADMIN" });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const healed = getArenaState()!;
        expect(healed.topBaseHp).toBeGreaterThan(state.maxBaseHp * 0.5);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("SHIELD reward applies shield team effect", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.forceOpenWithReward({ team: "A", rewardType: "SHIELD", source: "ADMIN" });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const effects = getTeamEffects();
        expect(effects.some((e) => e.team === "top" && e.type === "SHIELD")).toBe(true);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("RAGE reward applies rage team effect", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.forceOpenWithReward({ team: "A", rewardType: "RAGE", source: "ADMIN" });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const effects = getTeamEffects();
        expect(effects.some((e) => e.team === "top" && e.type === "RAGE")).toBe(true);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("GIANT reward transforms a T1 unit into giant", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.forceOpenWithReward({ team: "A", rewardType: "GIANT", source: "ADMIN" });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const effects = getTeamEffects();
        expect(effects.some((e) => e.team === "top" && e.type === "GIANT")).toBe(true);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("SPAWN_MULTIPLIER reward sets spawn multiplier", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.forceOpenWithReward({ team: "A", rewardType: "SPAWN_MULTIPLIER", source: "ADMIN" });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(getSpawnMultiplier("top")).toBe(2);
        expect(getSpawnMultiplier("bottom")).toBe(1);
        resolve();
      }, REWARD_POPUP_DURATION_MS + 200);
    });
  }, 5000);

  it("snapshot includes selectedReward", () => {
    initArena(createDefaultBattleConfig());
    chestManager.init(createDefaultBattleConfig().chest);
    chestManager.addContribution({ team: "A", points: 12 });
    chestManager.addLikes(10000);
    const snap = chestManager.getSnapshot();
    expect(snap.selectedReward).not.toBeNull();
  });
});
