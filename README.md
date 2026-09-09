# LIVE WAR ENGINE — Foundation + T1 Combat + Spatial System

A data-driven, real-time battle engine framework designed for vertical LIVE streaming. Two teams, led by configurable commanders, battle continuously with armies themed by the active Battle Theme.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to Control Room |
| `/control` | Internal operator dashboard — configure and launch battles |
| `/battle` | Vertical 9:16 LIVE output — intended for OBS / streaming capture |
| `/battle?debug=1` | Battle view with debug overlay (body boundaries, target lines, frontline, metrics) |

## How to Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173/control` in one tab, click **Open Battle View** to open `/battle` in a second tab.

## Prompt 01 Capabilities (Foundation)

- Duel selection, Battle Theme selection (Medieval, Arcane, Modern, Sci-Fi, Pirates)
- Editable combat settings (Base HP, duration, spawn interval)
- Battle lifecycle (IDLE -> RUNNING -> ENDED)
- Timestamp-based countdown timer
- Infinite Loop mode with configurable intermission
- Configuration snapshot (frozen when battle starts)
- Cross-tab sync via BroadcastChannel
- Event log, config persistence, validation, error boundary

## Infinite Loop

The engine supports two launch modes:

- **Start Single Battle** runs one round and leaves the final result visible.
- **Start Infinite Loop** creates one loop session and automatically runs `Battle → Result → Development Intermission → Reset → Next Battle` until stopped.

Each round receives a unique Battle ID and sequential round number. Every round snapshots the current draft configuration, so edits made during a live round are labeled **Next Round Config** and only apply when the following round starts. Loop sessions retain bounded summaries and metrics for completed rounds.

**Stop After Round** lets the active battle finish before returning the loop to idle. **Abort Current Battle** stops immediately and prevents delayed transitions. **Reset Engine** cancels all pending transitions and clears the runtime.

The loop controller lives in the application state layer; the battle engine owns only the active battle simulation. The Battle View is a renderer and does not create timers or restart battles, which prevents duplicate simulation loops when switching or refreshing views. Cross-tab state continues to use BroadcastChannel, with the Control Room acting as the simulation authority.

The development intermission defaults to 3 seconds. Persistent history, server-side simulation authority, and production lifecycle phases are intentionally deferred.

## Prompt 02 Capabilities (T1 Combat)

- **Autonomous T1 combat** — both teams auto-spawn T1 units at configurable intervals
- **1D battlefield** — logical coordinate system (0-100), renderer-independent
- **Movement** — units advance toward enemy base at configurable speed
- **Melee combat** — DPS-based damage applied simultaneously (no update-order bias)
- **Death and cleanup** — dead units stop blocking/fighting, removed after fade
- **Base attacks** — units at enemy base deal structure DPS
- **Win conditions** — base destruction, timer expiry (higher HP wins), draw support

## Prompt 03 Capabilities (Spatial System Hardening)

- **Physical body model** — units have explicit radius; collision uses body edges, not center points
- **Radius-aware allied spacing** — formation gap calculated as `radiusA + radiusB + formationGap`
- **Hard body enemy collision** — opposing units cannot pass through each other; overlap correction applied symmetrically
- **Anti-tunneling** — movement clamped before application, preventing high-speed units from crossing enemies
- **Contact slot model** — `meleeFrontageSlots` (default 3) limits simultaneous melee fighters; excess units enter BLOCKED state
- **BLOCKED state** — queued units wait behind frontline, do not deal damage, advance when space opens
- **Emergent frontline** — battle line position determined by physical armies, not a hardcoded wall; can shift toward either base
- **Blocking enemy targeting** — T1 targets the closest BLOCKING enemy ahead; cannot target through other enemies
- **Target stability** — valid targets retained across ticks; reacquisition tracked in metrics
- **Base attack slots** — `baseAttackSlots` (default 4) limits simultaneous base attackers
- **Defender interception** — base attackers switch to fight arriving defenders
- **Pending spawn queue** — burst spawns beyond physical capacity are queued and released as space becomes available
- **Contested spawn handling** — if spawn zone is occupied, units spawn at nearest safe position
- **Frontline estimation** — `frontlineX` derived from frontmost opposing units; exposed in metrics and debug
- **Territory pressure** — normalized -1 to +1 metric indicating which team dominates position
- **Debug overlay** — `/battle?debug=1` shows body boundaries, attack ranges, target lines, state coloring, frontline marker, spawn/base boundaries
- **Pause/Step** — simulation can be paused; single-tick stepping for collision debugging
- **Speed control** — 0.25x to 4x simulation speed
- **Extended dev controls** — +50/+100 spawn buttons, detailed spatial metrics panel
- **70 automated tests** — spatial math helpers, spacing, crossing prevention, blocker targeting, contact slots, mirror symmetry, burst spawns, 500-unit stress test

## Spatial Combat Model

### 1D Logical Battlefield

All gameplay operates on a single horizontal axis (0-100). Visual Y-offset is presentation only and does not create lanes. Team A moves left-to-right, Team B right-to-left.

### Body Radius

Each unit has a `radius` defining its physical extent. A unit at `x=50` with `radius=0.4` occupies `49.6 → 50.4`. All distance calculations use body edges:

```
edgeDistance = |xA - xB| - radiusA - radiusB
```

Attack range is separate from body radius — a unit can attack when `edgeDistance <= attackRange`.

### Allied Queueing

Same-team units maintain minimum spacing: `radiusA + radiusB + formationGap`. Units are processed front-to-back; rear units are clamped behind the unit ahead. This creates physical queues/formations.

### Limited Frontline Engagement

Only `meleeFrontageSlots` units per team can be FIGHTING simultaneously at the contact point. Additional units enter the BLOCKED state and wait behind the frontline. When a frontline fighter dies, the next unit fills the slot.

### Limited Base Frontage

Only `baseAttackSlots` units can attack an enemy base simultaneously. Others queue behind.

### Emergent Frontline

There is no invisible wall. The frontline emerges from physical contact between armies. It can exist at any X position and shifts dynamically based on army pressure.

### Targeting Policy (T1: BASIC_FRONTLINE)

1. Retain current valid target if it remains the blocking enemy
2. Find closest blocking enemy ahead (no targeting through other enemies)
3. If no enemy blocks, advance toward enemy base
4. Attack base when in range and no defenders present

### Renderer Independence

All spatial logic operates in logical coordinates (0-100). The simulation has zero dependency on DOM, CSS, or visual dimensions.

### Future Tier Compatibility

The spatial system is designed to support (without rewriting collision):
- **T2 Specialist** — small body, long attack range, stays behind frontline
- **T4 Breaker** — large body, charge ingress, AoE impact, knockback
- **T5 Boss** — very large body, Heavy Slam, sustained battlefield dominance
- **T3 Healer** — economic-value-aware support targeting and finite healing pool
- **T4 Breaker** — larger radius, occupies multiple frontage slots
- **T5 Boss** — very large body, significant frontage consumption
- **T6 Ultimate** — global battlefield event, not a unit; army-wide damage, base damage, and knockback

All persistent unit roles (T1–T5) and the T6 Ultimate event are now implemented.

## Prompt 06 Capabilities (T2 Specialist)

- **Universal T2 Specialist** — 350 HP, 65 DPS, 0.9 speed, 25 structure DPS, 35 logical-unit range, and `0.10` target value
- **Theme presentation mappings** — Longbow Elite, Battle Mage, Sniper, Plasma Ranger, and Musketeer share the same gameplay definition
- **Backline fire support** — allied bodies still block movement, but do not block ranged attacks
- **Forward screening** — Specialists retain valid targets and choose the nearest forward enemy rather than freely targeting deep backline units
- **Ranged base attacks** — Specialists use structure DPS when the enemy base is in range and no defender has priority
- **Continuous combat damage** — unit and structure damage is frame-rate independent and resolves through the shared damage pipeline
- **Visual-only projectiles** — lightweight themed firing trails are separate from authoritative simulation damage and capped for performance
- **Debug range and target tools** — `/battle?debug=1` shows Specialist range overlays, target lines, per-tier counts, and projectile counts
- **Tier metrics and controls** — Control Room provides T1/T2 spawn controls, active counts, and per-tier damage metrics

## Prompt 07 Capabilities (T4 Breaker)

- **Universal T4 Breaker** — 8000 HP, 220 DPS, 0.8 speed, 400 structure DPS, 2 EUR target value, and a large 14-unit collision radius
- **Theme presentation mappings** — Battering Ram, Arcane Golem, Armored Vehicle, Combat Mech, and Cannon Cart share the same gameplay definition
- **Initial charge** — T4 deploys in a CHARGING state at 1.8x speed, rapidly advancing toward the enemy frontline
- **Friendly yielding** — charging T4 has elevated collision priority, pushing allied smaller units aside to reach the frontline without damaging them or teleporting
- **One-time charge impact** — first hostile contact triggers exactly one AoE event dealing 1500 damage to enemy units within a 50-unit radius
- **Knockback** — surviving enemies are pushed 25 units toward their own base, with T4 having 50% knockback resistance; displacement cascades through allied formations
- **Post-charge combat** — after impact, T4 transitions to normal melee combat at 220 DPS with no repeated AoE
- **Ranged structure siege** — T4 attacks bases at 400 structure DPS, consuming 3 frontage slots
- **Impact effects** — visual shockwave rendered at impact location, fading over 0.6 seconds
- **Per-tier charge metrics** — impacts, charge damage, enemies hit, enemies killed, and displacement applied tracked per tier
- **Debug overlays** — `/battle?debug=1` shows T4 impact radius, charge state, and target lines

## Prompt 08 Capabilities (T5 Boss)

- **Universal T5 Boss** — 18,000 HP, 450 DPS, 0.7 speed, 300 structure DPS, 5 EUR target value, and a very large 20-unit collision radius
- **Theme presentation mappings** — Royal Champion, Archmage, Juggernaut, Titan Mech, and Legendary Captain share the same gameplay definition
- **Deployment ingress** — Boss spawns with a 1.3x speed boost and collision priority 8, advancing through friendly formation without teleporting or damaging allies
- **Heavy Slam** — periodic AoE ability dealing 900 damage to enemy units within a 60-unit radius, with a 4-second cooldown and 2-second initial delay
- **Slam windup** — 0.5-second visual windup before impact, giving viewers time to anticipate the event
- **Slam knockback** — surviving enemies pushed 18 units toward their own base, with T5 having 80% knockback resistance
- **No wasted slams** — Slam only triggers when at least one enemy is within range; cooldown does not reset on empty slam
- **Normal attack is single-target** — 450 DPS, no repeated AoE on normal attacks
- **Capped structure damage** — 300 structure DPS (deliberately lower than T4's 400) to prevent Boss from being an automatic base-killer
- **Independent ability timers** — each Boss maintains its own `slamTimer` and `slamState`; no shared cooldown
- **Slam death cancellation** — if Boss dies during windup, slam is cancelled with no ghost impact
- **Boss HP bar** — always-visible compact HP bar with low-HP flashing state below 25%
- **Slam visual feedback** — expanding shockwave ring at impact location, windup ring on Boss, cooldown arc indicator
- **Per-tier slam metrics** — slam count, slam damage, enemies hit, enemies killed, displacement applied, average boss lifetime
- **Debug overlays** — `/battle?debug=1` shows T5 slam radius, windup state, and target lines

## Prompt 09 Capabilities (T3 Healer)

- **Universal T3 Healer** — 650 HP, 250 nominal healing/sec, 5,000 nominal healing pool, 0.85 speed, 0.50 EUR target value
- **Theme presentation mappings** — Battle Cleric, Lifeweaver, Combat Medic, Nano Medic, and Ship Surgeon share one gameplay definition
- **Economic target selection** — healing score is `economic value × missing HP proportion`; a critical Boss can outrank lightly wounded T1 units, while a critical Breaker can outrank a barely damaged Boss
- **Target hysteresis** — current targets are retained unless a new candidate scores at least 20% higher, preventing rapid target thrashing
- **Support range** — 70-unit healing range and 140-unit acquisition range; support movement positions the Healer behind its target
- **One target at a time** — no aura, no AoE healing, no offensive attack, no self-healing, no base healing, no commander healing, and no revive
- **Tier efficiencies** — T1/T2/T3 heal at 100%, T4 at 50%, and T5 at 25%; efficiencies affect restored HP, not target priority
- **Finite nominal pool** — each Healer consumes nominal pool before efficiency reduction; 5,000 pool lasts approximately 20 seconds at full output and never becomes negative
- **Overheal protection** — only useful healing is applied and consumed from the pool, including partial Boss healing at reduced efficiency
- **Multiple Healers** — independent pools and targets; healing can stack on one ally without shared state
- **Exhaustion** — an empty Healer remains physical and killable but stops providing support
- **Healing beam** — visible target link, healer pulse, compact pool bar, and debug healing-range overlay
- **Healer metrics** — nominal healing, actual healing, pool consumed, unused pool on death, time spent healing, targets healed, target-tier healing, and average lifetime

## Prompt 10 Capabilities (T6 Ultimate)

- **Universal T6 Ultimate** — a one-shot global battlefield event, not a unit; 20 EUR target value, triggered per team
- **Theme presentation mappings** — Dragon Strike, Meteor Storm, Airstrike, Orbital Strike, and Kraken Attack share identical gameplay logic
- **T1–T3 removal** — approximately 90% of enemy T1/T2/T3 units are deterministically eliminated (sorted by ID for reproducibility)
- **T4 current-HP damage** — 55% of current HP, so a healthy Breaker survives but a wounded one may die
- **T5 max-HP damage** — 45% of max HP, so a healthy Boss survives but a critically wounded one may die
- **Base damage** — 8% of max base HP (8,000 damage on a 100,000 HP base); no artificial 1 HP protection — a weak base can be finished
- **Global knockback** — all surviving enemy units are pushed toward their own base, with existing knockback resistance applied per tier
- **No friendly damage** — Ultimate never affects own units, base, or commander
- **Multiple Ultimates** — each trigger resolves independently; no global one-Ultimate-only assumption
- **Battle continues** — if the enemy base survives, the battle continues normally even if the army is devastated
- **Visual event** — full-screen flash, sweeping beam, expanding ring, and a themed event banner lasting approximately 2 seconds
- **Event metrics** — units before, T1/T2/T3 killed, T4/T5 damage, base damage, survivors displaced, and battle-ended flag
- **Control Room controls** — Team A and Team B T6 trigger buttons (DEV/SIMULATION only)
- **Configurable** — all ratios, knockback distance, and optional stun duration are data-driven
- **Infinite Loop cleanup** — all Ultimate visual effects and state are cleared on round reset

## Explicitly Not Implemented Yet

These are intentionally deferred — **not** bugs:

- Production TikTok account testing and operator gift-ID mapping UX
- Top Warriors and MVP displays
- Revive mechanics, Victory/History screens, Duel voting
- Analytics/database persistence, authentication
- Landing page, public website

## Scripts

```bash
npm run dev        # Development server
npm run live-bridge # Local TikTok LIVE WebSocket bridge
npm run dev:all    # Vite plus local TikTok bridge
npm run build      # Production build
npm run test       # Run tests (vitest)
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
```

## TikTok LIVE bridge

The TikTok connector runs only in Node through a local WebSocket bridge bound to `127.0.0.1:8765`. The React application receives normalized events and routes them through the same LIVE bus as the simulator; the battle engine never imports TikTok code.

1. Start the bridge with `npm run live-bridge`.
2. Start the application with `npm run dev` (or use `npm run dev:all`).
3. Open `/control`, select `TIKTOK`, enter the public TikTok LIVE username without `@`, and press `CONNECT`.
4. Confirm the real status, room ID, viewer count, and incoming event feed before configuring gift IDs.

The bridge is read-only: it does not send TikTok messages and does not require an account password. A disconnect leaves the battle running and retries with bounded backoff unless the operator selected `DISCONNECT`. Real gift IDs must be mapped in the existing gift mapping layer before they can trigger gameplay; unknown gifts are never interpreted by name.
