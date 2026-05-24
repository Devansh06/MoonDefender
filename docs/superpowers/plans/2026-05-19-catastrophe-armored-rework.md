# Catastrophe Rock & Armored Starnet Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the boss rock's red HP system with a rotating magnetic-armored hybrid that needs 2 armor-breaking hits to crack (blaster/starnet, any combo), and make starnet boomerang uncracked armored rocks back toward Earth instead of deflecting them cleanly.

**Architecture:** All gameplay changes live in `src/rocks.js` (spawn data, hit logic, starnet handlers, companion updater). Visuals live in `src/render.js` (boss draw section). `src/main.js` gets one new function call per frame. No new files needed.

**Tech Stack:** Vanilla ES Modules, HTML5 Canvas 2D.

---

## File map

| File | Change |
|---|---|
| `src/rocks.js` | `spawnBoss`, `hitRock` boss branch, `deflectWithStarnet`, `destroyWithStarnet`, new `updateCatastropheCompanions` |
| `src/render.js` | Boss branch of `drawRocks` — remove red/HP visuals, add companion orbits + armored look |
| `src/main.js` | Import `updateCatastropheCompanions`, call it in `update()` |
| `index.html` | Tutorial text for Catastrophe Rock |

---

## Task 1: Rework `spawnBoss` — companion data, no HP

**Files:**
- Modify: `src/rocks.js` — `spawnBoss` function

- [ ] **Replace the entire `spawnBoss` function** with this (removes `bossHp/bossMaxHp`, adds `companions` array):

```js
export function spawnBoss() {
  const bossR = state.earth.r * 0.42;
  const side = Math.random() < 0.5 ? -1 : 1;
  const pos = {
    x: side < 0 ? -bossR * 1.5 : state.w + bossR * 1.5,
    y: state.earth.y + rand(-state.earth.r * 0.5, state.earth.r * 0.5),
  };
  const dir = norm(state.earth.x - pos.x, state.earth.y - pos.y);
  const speed = 8 + state.level * 1.5;
  state.rocks.push({
    x: pos.x,
    y: pos.y,
    vx: dir.x * speed,
    vy: dir.y * speed,
    level: 5,
    rockType: "boss",
    breakCount: 0,
    r: bossR,
    seed: Math.random() * 999,
    cleared: false,
    deflected: false,
    spiral: false,
    enteredArena: false,
    earthSeeking: true,
    path: [],
    pathClock: 0,
    armorHits: 0,
    deflectorHits: 0,
    cracked: false,
    companions: [
      { angle: 0,           angularSpeed:  1.1, distance: bossR * 1.85, r: 7 },
      { angle: TAU / 3,     angularSpeed: -0.8, distance: bossR * 2.2,  r: 9 },
      { angle: TAU * 2 / 3, angularSpeed:  1.4, distance: bossR * 1.6,  r: 6 },
    ],
  });
}
```

- [ ] **Remove the unused `BOSS_HP_BASE` import** from line 1 of `src/rocks.js`. Change:

```js
import { TAU, ROCK_DAMAGE, BOSS_HP_BASE, MAGNETIC_PULL_RADIUS, MAGNETIC_PULL_STRENGTH } from "./constants.js";
```

to:

```js
import { TAU, ROCK_DAMAGE, MAGNETIC_PULL_RADIUS, MAGNETIC_PULL_STRENGTH } from "./constants.js";
```

- [ ] **Verify**: open browser console, start game, wait for level 5. No JS errors. Boss spawns (even if it looks wrong yet — render changes come in Task 3).

---

## Task 2: Rework `hitRock` boss branch — armor not HP

**Files:**
- Modify: `src/rocks.js` — boss branch inside `hitRock`

The current boss branch uses `bossHp`. Replace it entirely. The new rule: deflector → bounce. Blaster on uncracked → `armorHits += 1`, crack at 2, spawn rock. Blaster on cracked → destroy with rewards.

- [ ] **Replace the boss branch** inside `hitRock` (find `if (rock.rockType === "boss") {` and replace through its closing `return;`):

```js
  if (rock.rockType === "boss") {
    if (projectile.type === "deflector") {
      addBurst(rock.x, rock.y, "#8ff0b2", 6);
      return;
    }
    if (rock.cracked) {
      state.score += 500;
      state.starnet += 3;
      state.bossActive = false;
      state.levelClock = 5;
      state.hazardBanner = { text: "CATASTROPHE AVERTED! +3 Starnet — Next level in 5s", timeLeft: 3.5 };
      clearRock(rock, true);
    } else {
      rock.armorHits += 1;
      if (rock.armorHits >= 2) rock.cracked = true;
      state.shake = 0.35;
      addBurst(rock.x, rock.y, "#b060ff", 18);
      spawnRock(Math.max(1, Math.floor(rock.level / 2)));
    }
    return;
  }
```

- [ ] **Verify**: level 5 boss spawns. Two blaster shots crack it (armor bar goes 2/2 → 1/2 → CRACKED). Third blaster shot destroys it and shows "CATASTROPHE AVERTED!" banner. Boss still spawns extra rocks on each hit.

---

## Task 3: Redraw boss — armored-magnetic look with orbiting companions

**Files:**
- Modify: `src/render.js` — boss branch of `drawRocks`

Find `} else if (rock.rockType === "boss") {` and replace through the final `}` before the `} else {` normal-rock fallback. The new look: dark purple-gray body, purple magnetic glow, crack lines when `rock.cracked`, companion rocks orbiting behind the main body, armor bar (not HP bar).

- [ ] **Replace the entire boss branch** in `drawRocks`:

```js
    } else if (rock.rockType === "boss") {
      ctx.rotate(rock.seed + performance.now() * 0.00012);

      // Orbiting companion rocks (drawn before main body so they appear behind)
      if (rock.companions) {
        for (const c of rock.companions) {
          const cx = Math.cos(c.angle) * c.distance;
          const cy = Math.sin(c.angle) * c.distance;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(c.angle * 2.1);
          ctx.fillStyle = "#6a5870";
          ctx.strokeStyle = "rgba(160,90,220,0.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i < 7; i += 1) {
            const a = (i / 7) * TAU;
            const r = c.r * (0.72 + 0.28 * Math.sin(i * 2.1 + rock.seed));
            if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // Main armored-magnetic body
      ctx.shadowColor = "#b060ff";
      ctx.shadowBlur = rock.cracked ? 8 : 20;
      ctx.fillStyle = "#4a3860";
      ctx.strokeStyle = rock.cracked ? "rgba(255,200,60,0.85)" : "rgba(180,100,255,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 13; i += 1) {
        const a = (i / 13) * TAU;
        const r = rock.r * (0.82 + 0.2 * Math.sin(i * 2.4 + rock.seed));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crack lines when armor is broken
      if (rock.cracked) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,210,60,0.85)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-rock.r * 0.6, -rock.r * 0.15);
        ctx.lineTo(rock.r * 0.42, rock.r * 0.58);
        ctx.moveTo(-rock.r * 0.22, -rock.r * 0.68);
        ctx.lineTo(rock.r * 0.38, rock.r * 0.22);
        ctx.moveTo(rock.r * 0.12, -rock.r * 0.72);
        ctx.lineTo(-rock.r * 0.28, rock.r * 0.45);
        ctx.stroke();
      }

      // Armor status bar
      ctx.shadowBlur = 0;
      const barW = rock.r * 2.4;
      const barH = 8;
      const bx = -barW / 2;
      const by = -rock.r - 26;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(bx - 4, by - 18, barW + 8, barH + 24);
      ctx.fillStyle = rock.cracked ? "#ffcf70" : "#b060ff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(rock.cracked ? "CRACKED — 1 HIT TO DESTROY" : `ARMOR ${2 - rock.armorHits}/2`, 0, by - 2);
      const armorFrac = Math.max(0, (2 - rock.armorHits) / 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = rock.cracked ? "#ffcf70" : "#b060ff";
      ctx.fillRect(bx, by, barW * armorFrac, barH);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
```

- [ ] **Verify**: boss looks gray-purple, no red. Three small rocks orbit it. Armor bar shows "ARMOR 2/2". After one blaster hit: "ARMOR 1/2". After second: "CRACKED — 1 HIT TO DESTROY" with gold crack lines.

---

## Task 4: Animate companion orbits — `updateCatastropheCompanions`

**Files:**
- Modify: `src/rocks.js` — add new export at bottom of file
- Modify: `src/main.js` — import + call in `update()`

Companions need their `angle` advanced each frame. This is a pure data update — no rendering.

- [ ] **Add the new export at the bottom of `src/rocks.js`** (after `deflectWithStarnet`):

```js
export function updateCatastropheCompanions(dt) {
  for (const rock of state.rocks) {
    if (rock.cleared || rock.rockType !== "boss" || !rock.companions) continue;
    for (const c of rock.companions) {
      c.angle += c.angularSpeed * dt;
    }
  }
}
```

- [ ] **Add the import** in `src/main.js`. Find the rocks.js import line and add `updateCatastropheCompanions`:

```js
import { spawnRock, spawnBoss, markArenaState, isOutsideArena, bounceFromMoon, clearRock, applyMagneticPull, applyStarnetField, hitRock, predictPath, updateCatastropheCompanions } from "./rocks.js";
```

- [ ] **Call it in `update()`** in `src/main.js`. Add one line immediately after `applyMagneticPull(dt);`:

```js
  applyMagneticPull(dt);
  updateCatastropheCompanions(dt);
```

- [ ] **Verify**: the three companion rocks visibly orbit the catastrophe rock during level 5. They rotate at different speeds and directions.

---

## Task 5: Starnet boomerang for uncracked armored rocks — `deflectWithStarnet`

**Files:**
- Modify: `src/rocks.js` — `deflectWithStarnet` function

Current behavior: starnet always fully deflects any rock it pushes. New behavior: if the rock is armored (or boss) and **not** cracked, count one armor hit, push it away weakly, set `earthSeeking = true` so it arcs back, do NOT mark `deflected`. Only apply these physics on the **first contact** of the activation (`starnetHit` guard). On subsequent frames while inside the ring, do nothing (avoid repeated acceleration). Cracked armor or other rock types: deflect normally as before.

- [ ] **Replace the entire `deflectWithStarnet` function**:

```js
export function deflectWithStarnet(rock, distanceFromEarth) {
  const uncracked = (rock.rockType === "armored" || rock.rockType === "boss") && !rock.cracked;
  if (uncracked) {
    if (!rock.starnetHit) {
      // One armor hit per starnet activation
      rock.armorHits = (rock.armorHits || 0) + 1;
      // Boss needs 2 hits to crack; normal armored needs 1
      if (rock.armorHits >= (rock.rockType === "boss" ? 2 : 1)) rock.cracked = true;
      // Partial push outward — not enough to escape, so earthSeeking arcs it back
      const away = norm(rock.x - state.earth.x, rock.y - state.earth.y);
      rock.vx = rock.vx * 0.25 + away.x * 130;
      rock.vy = rock.vy * 0.25 + away.y * 130;
      rock.earthSeeking = true;
      rock.pathClock = 0;
      rock.starnetHit = true;
      addBurst(rock.x, rock.y, "#72e6ff", 8);
      addStarnetShock(rock);
    }
    // No physics on subsequent frames this activation (starnetHit blocks re-entry)
    return;
  }

  // Normal full deflect — cracked armor or non-armored rocks
  const away = norm(rock.x - state.earth.x, rock.y - state.earth.y);
  const orbitGap = Math.max(0, state.moon.orbit - distanceFromEarth);
  const push = 260 + orbitGap * 0.12 + rock.level * 28;
  rock.vx = rock.vx * 0.12 + away.x * push;
  rock.vy = rock.vy * 0.12 + away.y * push;
  rock.deflected = true;
  rock.pathClock = 0;
  if (!rock.starnetHit) {
    rock.starnetHit = true;
    addBurst(rock.x, rock.y, "#72e6ff", 12);
    addStarnetShock(rock);
  }
}
```

- [ ] **Verify** (normal armored rock, level 3+):
  - Starnet while uncracked armored is outside ring and crosses in: rock bounces away then curves back toward Earth. Armor bar text appears: "ARMOR 0/1" → shows "CRACKED" and the yellow lines appear.
  - Starnet while cracked armored: rock is deflected cleanly away (doesn't return).

---

## Task 6: Starnet destroy path for armored rocks — `destroyWithStarnet`

**Files:**
- Modify: `src/rocks.js` — `destroyWithStarnet` function

Current behavior: anything inside the starnet ring when activated gets destroyed (except healing). New behavior: if uncracked armored/boss is **inside** the ring when starnet fires, redirect to `deflectWithStarnet` (counts armor hit + boomerang). If the boss is cracked and inside, destroy with rewards. All other cases unchanged.

- [ ] **Replace the entire `destroyWithStarnet` function**:

```js
export function destroyWithStarnet(rock) {
  if (rock.rockType === "healing") {
    captureHealingRock(rock);
    return;
  }
  if ((rock.rockType === "armored" || rock.rockType === "boss") && !rock.cracked) {
    // Armor intact — count hit and boomerang instead of destroying
    const d = Math.hypot(rock.x - state.earth.x, rock.y - state.earth.y);
    deflectWithStarnet(rock, d);
    return;
  }
  if (rock.rockType === "boss") {
    // Boss armor already cracked — destroy with full rewards
    state.score += 500;
    state.starnet += 3;
    state.bossActive = false;
    state.levelClock = 5;
    state.hazardBanner = { text: "CATASTROPHE AVERTED! +3 Starnet — Next level in 5s", timeLeft: 3.5 };
    addStarnetShock(rock);
    clearRock(rock, true);
    return;
  }
  // Normal rocks and cracked armored
  addStarnetShock(rock);
  clearRock(rock, true);
}
```

- [ ] **Verify — boss + starnet full sequence**:
  1. Activate starnet when boss is inside the ring (uncracked): boss gets pushed away and arcs back. Armor shows "ARMOR 1/2".
  2. Activate starnet again when boss re-enters (still uncracked at 1/2): armor goes to 2/2 → "CRACKED".
  3. Activate starnet a third time with cracked boss inside ring: "CATASTROPHE AVERTED!" — level advances.

- [ ] **Verify — blaster + starnet combo**:
  1. One blaster hit on boss → "ARMOR 1/2".
  2. Starnet while boss is inside ring → "CRACKED" (1 blaster + 1 starnet = 2 hits).
  3. Next blaster or starnet destroys it.

---

## Task 7: Update tutorial text for Catastrophe Rock

**Files:**
- Modify: `index.html` — Catastrophe Rock card inside `#tutorialOverlay`

Find the `<div class="rock-card">` whose `<strong>` says "Catastrophe Rock" and update the `<span>` description to reflect the new armor system.

- [ ] **Replace the description span** (find the old text and replace):

Old:
```html
<span>Levels 5 &amp; 10. Timer pauses. <em>5 blaster hits</em> (8 at Lv 10). Each hit spawns extra rocks. Hitting Earth = 50 damage!</span>
```

New:
```html
<span>Levels 5 &amp; 10. Timer pauses. Magnetic-armored. <em>2 hits</em> (any combo of blaster/starnet) crack the armor — then 1 more destroys. Starnet boomerangs uncracked armor. Each blaster hit spawns extra rocks. Hitting Earth = 50 damage!</span>
```

- [ ] **Run the tutorial check**:

```
node check-tutorial.js
```

Expected output:
```
PASS  Tutorial covers all features.
```

---

## Self-review

**Spec coverage:**
1. ✅ Catastrophe rock: rotating magnetic-armored hybrid — Task 1 (spawn with companions), Task 3 (visual), Task 4 (orbit animation)
2. ✅ No fire trail, no red glow — Task 3 removes red fill/shadowColor
3. ✅ Doubly strong armor (2 hits of any type) — Task 2 (`armorHits >= 2` in `hitRock`), Task 5 (`crackAt = 2` for boss in `deflectWithStarnet`), Task 6 (starnet inside ring counts toward armor)
4. ✅ Once cracked, 1 more hit destroys — Task 2 (`rock.cracked` branch) and Task 6 (cracked boss + starnet)
5. ✅ Starnet boomerangs uncracked armored rocks — Task 5 (`deflectWithStarnet` uncracked branch)
6. ✅ Starnet deflects cracked armor normally — Task 5 (falls through to normal deflect)
7. ✅ Tutorial updated — Task 7

**Placeholder scan:** No TBDs, no vague instructions. Every step has complete code.

**Type consistency:**
- `rock.armorHits` used in Tasks 1, 2, 5, 6 — consistent field name throughout
- `rock.cracked` used in Tasks 1, 2, 3, 5, 6 — consistent
- `rock.companions[i].angle`, `.angularSpeed`, `.distance`, `.r` — consistent between Task 1 (spawn) and Task 3 (render) and Task 4 (update)
- `deflectWithStarnet(rock, d)` signature unchanged — Task 6 calls it correctly
