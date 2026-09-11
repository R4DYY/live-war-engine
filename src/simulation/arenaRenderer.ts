import type { SimulationSnapshot, ArenaUnit, VisualProjectile, ImpactEffect, UltimateEvent } from "@/simulation/types";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  BASE_X,
  BASE_Y_TOP,
  BASE_Y_BOTTOM,
  BASE_RADIUS,
} from "@/simulation/constants";
import type { BattleThemeId } from "@/domain/types";
import type { AssetState } from "@/engine/characterAssetResolver";

const TEAM_TOP_COLOR = "#dc2626";
const TEAM_TOP_GLOW = "rgba(220, 38, 38, 0.3)";
const TEAM_BOTTOM_COLOR = "#2563eb";
const TEAM_BOTTOM_GLOW = "rgba(37, 99, 235, 0.3)";
const BASE_TOP_COLOR = "#dc2626";
const BASE_BOTTOM_COLOR = "#2563eb";
const HP_BG = "rgba(0, 0, 0, 0.6)";
const HP_GREEN = "#22c55e";
const HP_YELLOW = "#f59e0b";
const HP_RED = "#ef4444";
const DEAD_COLOR = "rgba(255, 255, 255, 0.15)";

export function renderArena(
  ctx: CanvasRenderingContext2D,
  snap: SimulationSnapshot,
  canvasWidth: number,
  canvasHeight: number,
  debug: boolean = false,
  hasBackgroundImage: boolean = false,
  theme: BattleThemeId | null = null
): void {
  const scaleX = canvasWidth / ARENA_WIDTH;
  const scaleY = canvasHeight / ARENA_HEIGHT;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!hasBackgroundImage) {
    drawBackground(ctx, canvasWidth, canvasHeight);
  }
  if (debug) {
    drawGridLines(ctx, canvasWidth, canvasHeight, scaleX, scaleY);
  }

  drawBase(ctx, BASE_X * scaleX, BASE_Y_TOP * scaleY, BASE_RADIUS * Math.min(scaleX, scaleY), snap.topBaseHp, snap.maxBaseHp, BASE_TOP_COLOR);
  drawBase(ctx, BASE_X * scaleX, BASE_Y_BOTTOM * scaleY, BASE_RADIUS * Math.min(scaleX, scaleY), snap.bottomBaseHp, snap.maxBaseHp, BASE_BOTTOM_COLOR);

  // Debug: range overlays for T2, T3, T4, and T5 units
  if (debug) {
    for (const u of snap.units) {
      if (u.state === "DEAD" || u.state === "SPAWNING") continue;
      if (u.tier === "T2") {
        drawRangeOverlay(ctx, u, scaleX, scaleY);
      }
      if (u.tier === "T3") {
        drawHealingRange(ctx, u, scaleX, scaleY);
      }
      if (u.tier === "T4" && u.chargeState === "CHARGING") {
        drawChargeImpactRadius(ctx, u, scaleX, scaleY);
      }
      if (u.tier === "T5") {
        drawSlamRadius(ctx, u, scaleX, scaleY);
      }
    }
  }

  // Impact effects (behind units)
  for (const e of snap.impactEffects) {
    drawImpactEffect(ctx, e, scaleX, scaleY, snap.elapsedSeconds);
  }

  // Ultimate effects (behind units, full-screen)
  for (const ult of snap.ultimateEffects) {
    drawUltimateEffect(ctx, ult, scaleX, scaleY, snap.elapsedSeconds, canvasWidth, canvasHeight);
  }

  // Units — draw T1/T2 first, T3 support, T4, then T5 on top
  const sortedUnits = [...snap.units].sort((a, b) => {
    const order: Record<string, number> = { T1: 0, T2: 0, T3: 1, T4: 2, T5: 3 };
    return (order[a.tier] ?? 0) - (order[b.tier] ?? 0);
  });

  for (const u of sortedUnits) {
    drawUnit(ctx, u, scaleX, scaleY, theme);
  }

  // Healing beams (visual only)
  for (const healer of snap.units) {
    if (healer.tier !== "T3" || healer.state === "DEAD" || healer.healerState !== "HEALING" || healer.healTargetId === null) continue;
    const target = snap.units.find((u) => u.id === healer.healTargetId);
    if (target && target.state !== "DEAD") {
      drawHealingBeam(ctx, healer, target, scaleX, scaleY);
    }
  }

  // Projectiles (visual only)
  for (const p of snap.projectiles) {
    drawProjectile(ctx, p, scaleX, scaleY, snap.elapsedSeconds);
  }

  // Debug: target lines
  if (debug) {
    for (const u of snap.units) {
      if (u.state === "DEAD" || u.state === "SPAWNING") continue;
      if (u.combatState === "ATTACKING_UNIT" && u.targetId !== null) {
        const target = snap.units.find((tu) => tu.id === u.targetId);
        if (target) {
          drawTargetLine(ctx, u, target, scaleX, scaleY);
        }
      }
    }
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1a0808");
  grad.addColorStop(0.15, "#0c0e14");
  grad.addColorStop(0.5, "#14171f");
  grad.addColorStop(0.85, "#0c0e14");
  grad.addColorStop(1, "#081018");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// Grid lines only appear in debug mode

function drawGridLines(ctx: CanvasRenderingContext2D, w: number, h: number, scaleX: number, scaleY: number): void {
  // Only called when debug is true
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA_WIDTH; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x * scaleX, 0);
    ctx.lineTo(x * scaleX, h);
    ctx.stroke();
  }
  for (let y = 0; y <= ARENA_HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y * scaleY);
    ctx.lineTo(w, y * scaleY);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBase(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, hp: number, maxHp: number, color: string): void {
  const hpPct = Math.max(0, hp / maxHp);
  if (hpPct > 0) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 + (hpPct < 0.3 ? Math.sin(Date.now() / 150) * 15 : 0);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (hpPct > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPct);
    ctx.strokeStyle = hpPct > 0.5 ? HP_GREEN : hpPct > 0.25 ? HP_YELLOW : HP_RED;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.fillStyle = "#e8eaf0";
  ctx.font = `bold ${Math.max(10, r * 0.45)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.ceil(hpPct * 100)}%`, cx, cy);
  if (hpPct <= 0) {
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.font = `bold ${Math.max(9, r * 0.35)}px Inter, sans-serif`;
    ctx.fillText("DESTROYED", cx, cy);
  }
}

function drawRangeOverlay(ctx: CanvasRenderingContext2D, u: ArenaUnit, scaleX: number, scaleY: number): void {
  const px = u.x * scaleX;
  const py = u.y * scaleY;
  const r = u.range * Math.min(scaleX, scaleY);
  const color = u.team === "top" ? TEAM_TOP_COLOR : TEAM_BOTTOM_COLOR;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawHealingRange(ctx: CanvasRenderingContext2D, u: ArenaUnit, scaleX: number, scaleY: number): void {
  const px = u.x * scaleX;
  const py = u.y * scaleY;
  const r = u.healingRange * Math.min(scaleX, scaleY);
  const color = u.team === "top" ? "#34d399" : "#67e8f9";
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawHealingBeam(ctx: CanvasRenderingContext2D, healer: ArenaUnit, target: ArenaUnit, scaleX: number, scaleY: number): void {
  const x1 = healer.x * scaleX;
  const y1 = healer.y * scaleY;
  const x2 = target.x * scaleX;
  const y2 = target.y * scaleY;
  const color = healer.team === "top" ? "#34d399" : "#67e8f9";
  const pulse = 0.55 + Math.sin(Date.now() / 120) * 0.2;

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = pulse * 0.35;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();
}

function drawChargeImpactRadius(ctx: CanvasRenderingContext2D, u: ArenaUnit, scaleX: number, scaleY: number): void {
  const px = u.x * scaleX;
  const py = u.y * scaleY;
  const r = u.impactRadius * Math.min(scaleX, scaleY);
  const color = u.team === "top" ? TEAM_TOP_COLOR : TEAM_BOTTOM_COLOR;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTargetLine(ctx: CanvasRenderingContext2D, u: ArenaUnit, target: ArenaUnit, scaleX: number, scaleY: number): void {
  const color = u.team === "top" ? TEAM_TOP_COLOR : TEAM_BOTTOM_COLOR;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(u.x * scaleX, u.y * scaleY);
  ctx.lineTo(target.x * scaleX, target.y * scaleY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawImpactEffect(ctx: CanvasRenderingContext2D, e: ImpactEffect, scaleX: number, scaleY: number, elapsed: number): void {
  const age = elapsed - e.bornAt;
  const t = Math.min(1, age / e.ttl);
  const alpha = 1 - t;
  const px = e.x * scaleX;
  const py = e.y * scaleY;
  const r = e.radius * Math.min(scaleX, scaleY) * (0.3 + t * 0.7);
  const color = e.team === "top" ? TEAM_TOP_COLOR : TEAM_BOTTOM_COLOR;

  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function getUnitVisualState(u: ArenaUnit): AssetState {
  if (u.state === "DEAD" || u.state === "SPAWNING") return "idle";
  if (u.combatState === "ATTACKING_UNIT" || u.combatState === "ATTACKING_BASE") return "attack";
  if (u.tier === "T3" && u.healerState === "HEALING") return "idle";
  if (u.movementState === "MOVING" || u.movementState === "CHARGING") return "walk";
  return "idle";
}

function drawUnit(ctx: CanvasRenderingContext2D, u: ArenaUnit, scaleX: number, scaleY: number, theme: BattleThemeId | null = null): void {
  const px = u.x * scaleX;
  const py = u.y * scaleY;
  const r = u.radius * Math.min(scaleX, scaleY) * 1.3;

  if (u.state === "DEAD") {
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = DEAD_COLOR;
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  const isTop = u.team === "top";
  const baseColor = isTop ? TEAM_TOP_COLOR : TEAM_BOTTOM_COLOR;
  const glowColor = isTop ? TEAM_TOP_GLOW : TEAM_BOTTOM_GLOW;

  // Determine if a DOM sprite will be rendered for this unit
  // (DEAD already returned above; SPAWNING units don't get sprites yet)
  const hasDomSprite = theme && u.tier !== "T6" && u.state !== "SPAWNING";

  if (!hasDomSprite) {
    // Glow for fighting, charging, or slamming units
    if (u.combatState === "ATTACKING_UNIT" || u.combatState === "ATTACKING_BASE" || u.chargeState === "CHARGING" || u.slamState === "WINDUP" || u.slamState === "COOLDOWN") {
      ctx.save();
      ctx.shadowColor = baseColor;
      const glowSize = u.slamState === "WINDUP" ? 20 : u.chargeState === "CHARGING" ? 16 : u.tier === "T5" ? 14 : 8;
      ctx.shadowBlur = glowSize;
      ctx.beginPath();
      ctx.arc(px, py, r + (u.slamState === "WINDUP" ? 6 : u.chargeState === "CHARGING" ? 4 : 2), 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();
      ctx.restore();
    }

    if (u.tier === "T5") {
      drawT5Unit(ctx, px, py, r, baseColor, u);
    } else if (u.tier === "T4") {
      drawT4Unit(ctx, px, py, r, baseColor, u);
    } else if (u.tier === "T3") {
      drawT3Unit(ctx, px, py, r, baseColor, u);
    } else if (u.tier === "T2") {
      drawT2Unit(ctx, px, py, r, baseColor);
    } else {
      drawT1Unit(ctx, px, py, r, baseColor);
    }
  }

  // HP bar — always show for T5 Boss, others only if damaged
  if (u.hp < u.maxHp || u.tier === "T5") {
    const barW = u.tier === "T5" ? r * 3.5 : r * 3;
    const barH = Math.max(2, u.tier === "T5" ? r * 0.5 : r * 0.4);
    const barX = px - barW / 2;
    const barY = py - r - barH - 2;
    const hpPct = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = HP_BG;
    ctx.fillRect(barX, barY, barW, barH);
    const hpColor = hpPct > 0.5 ? HP_GREEN : hpPct > 0.25 ? HP_YELLOW : HP_RED;
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpPct, barH);
    // T5: border on bar + low-HP flash
    if (u.tier === "T5") {
      ctx.strokeStyle = hpPct < 0.25 ? `rgba(239, 68, 68, ${0.5 + Math.sin(Date.now() / 100) * 0.5})` : "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }
  }

  // T3 support pool bar
  if (u.tier === "T3") {
    const poolPct = u.healPoolMax > 0 ? u.healPoolRemaining / u.healPoolMax : 0;
    const poolW = r * 2.8;
    const poolH = Math.max(2, r * 0.28);
    const poolX = px - poolW / 2;
    const poolY = py + r + 4;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(poolX, poolY, poolW, poolH);
    ctx.fillStyle = poolPct > 0.25 ? "#34d399" : "#f59e0b";
    ctx.fillRect(poolX, poolY, poolW * poolPct, poolH);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(poolX, poolY, poolW, poolH);
  }

  // Spawning pulse
  if (u.state === "SPAWNING") {
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
    ctx.beginPath();
    ctx.arc(px, py, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawT1Unit(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px - r * 0.2, py - r * 0.2, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fill();
}

function drawT3Unit(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, color: string, u: ArenaUnit): void {
  ctx.save();
  ctx.translate(px, py);

  // Support diamond with a bright medical core
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.78, -r * 0.78, r * 1.56, r * 1.56);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-r * 0.78, -r * 0.78, r * 1.56, r * 1.56);
  ctx.rotate(-Math.PI / 4);

  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(-r * 0.13, -r * 0.5, r * 0.26, r);
  ctx.fillRect(-r * 0.5, -r * 0.13, r, r * 0.26);

  if (u.healerState === "HEALING") {
    ctx.beginPath();
    ctx.arc(0, 0, r + 4 + Math.sin(Date.now() / 100) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(52, 211, 153, 0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (u.healerState === "EXHAUSTED") {
    ctx.globalAlpha = 0.45;
  }
  ctx.restore();
}

function drawT2Unit(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, color: string): void {
  const t2R = r * 1.3;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-t2R * 0.7, -t2R * 0.7, t2R * 1.4, t2R * 1.4);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-t2R * 0.7, -t2R * 0.7, t2R * 1.4, t2R * 1.4);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(px, py, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.fill();
}

function drawT4Unit(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, color: string, u: ArenaUnit): void {
  // Large hexagonal body
  ctx.save();
  ctx.translate(px, py);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner core
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fill();

  // Charge indicator: pulsing ring
  if (u.chargeState === "CHARGING") {
    const pulse = 0.5 + Math.sin(Date.now() / 80) * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3 + pulse * 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSlamRadius(ctx: CanvasRenderingContext2D, u: ArenaUnit, scaleX: number, scaleY: number): void {
  const px = u.x * scaleX;
  const py = u.y * scaleY;
  const r = u.slamRadius * Math.min(scaleX, scaleY);
  const color = u.team === "top" ? TEAM_TOP_COLOR : TEAM_BOTTOM_COLOR;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = u.slamState === "READY" ? 0.2 : 0.4;
  ctx.lineWidth = u.slamState === "WINDUP" ? 3 : 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawT5Unit(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, color: string, u: ArenaUnit): void {
  ctx.save();
  ctx.translate(px, py);

  // Large octagonal body
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner star core
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const innerR = i % 2 === 0 ? r * 0.5 : r * 0.25;
    const x = Math.cos(angle) * innerR;
    const y = Math.sin(angle) * innerR;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fill();

  // Slam windup: pulsing expanding ring
  if (u.slamState === "WINDUP") {
    const windupProgress = 1 - (u.slamWindupTimer / u.slamWindup);
    const pulse = 0.5 + Math.sin(Date.now() / 50) * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4 + windupProgress * 8 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Slam cooldown: small rotating indicator
  if (u.slamState === "COOLDOWN") {
    const cdProgress = u.slamTimer / u.slamCooldown;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdProgress);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: VisualProjectile, scaleX: number, scaleY: number, elapsed: number): void {
  const age = elapsed - p.bornAt;
  const t = Math.min(1, age / p.ttl);
  const alpha = 1 - t;
  const fromX = p.fromX * scaleX;
  const fromY = p.fromY * scaleY;
  const toX = p.toX * scaleX;
  const toY = p.toY * scaleY;
  const curX = fromX + (toX - fromX) * t;
  const curY = fromY + (toY - fromY) * t;
  const color = p.team === "top" ? TEAM_TOP_COLOR : TEAM_BOTTOM_COLOR;

  ctx.save();
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(curX, curY);
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(curX, curY, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const ULTIMATE_THEME_COLORS: Record<string, { primary: string; secondary: string; label: string }> = {
  medieval: { primary: "#f97316", secondary: "#fbbf24", label: "DRAGON STRIKE" },
  arcane: { primary: "#a855f7", secondary: "#c084fc", label: "METEOR STORM" },
  modern: { primary: "#ef4444", secondary: "#f87171", label: "AIRSTRIKE" },
  scifi: { primary: "#06b6d4", secondary: "#22d3ee", label: "ORBITAL STRIKE" },
  pirates: { primary: "#14b8a6", secondary: "#5eead4", label: "KRAKEN ATTACK" },
};

function drawUltimateEffect(
  ctx: CanvasRenderingContext2D,
  ult: UltimateEvent,
  scaleX: number,
  scaleY: number,
  elapsed: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const age = elapsed - ult.bornAt;
  const t = Math.min(1, age / ult.ttl);
  const alpha = 1 - t;
  const teamColor = ult.team === "top" ? TEAM_TOP_COLOR : TEAM_BOTTOM_COLOR;
  const themeColors = ULTIMATE_THEME_COLORS[ult.theme] ?? ULTIMATE_THEME_COLORS.modieval;

  ctx.save();

  // Phase 1: expanding flash (0-30%)
  if (t < 0.3) {
    const flashT = t / 0.3;
    ctx.globalAlpha = (1 - flashT) * 0.4;
    ctx.fillStyle = teamColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Phase 2: sweeping beam from triggering team's side
  if (t < 0.6) {
    const beamT = t / 0.6;
    const beamY = ult.team === "top"
      ? beamT * canvasHeight
      : canvasHeight - beamT * canvasHeight;
    const beamH = canvasHeight * 0.15;

    ctx.globalAlpha = alpha * 0.3;
    const grad = ctx.createLinearGradient(0, beamY - beamH, 0, beamY + beamH);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, themeColors.primary);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, beamY - beamH, canvasWidth, beamH * 2);
  }

  // Full-arena expanding ring
  const ringR = t * Math.max(canvasWidth, canvasHeight) * 0.7;
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = themeColors.primary;
  ctx.lineWidth = 4;
  ctx.shadowColor = themeColors.primary;
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(canvasWidth / 2, canvasHeight / 2, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Event banner
  if (t < 0.85) {
    const bannerAlpha = t < 0.15 ? t / 0.15 : alpha;
    ctx.globalAlpha = bannerAlpha;
    const bannerY = canvasHeight * 0.35;
    const bannerH = 48;
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, bannerY - bannerH / 2, canvasWidth, bannerH);
    ctx.strokeStyle = themeColors.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, bannerY - bannerH / 2, canvasWidth, bannerH);

    ctx.fillStyle = themeColors.secondary;
    ctx.font = `bold 22px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${ult.team === "top" ? "TEAM A" : "TEAM B"} — ${themeColors.label}`,
      canvasWidth / 2,
      bannerY
    );
  }

  ctx.restore();
}
