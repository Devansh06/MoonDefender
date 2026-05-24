# Modularize Moon Defender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 2100-line `game.js` into focused ES-module source files under `src/`, with no behaviour change.

**Architecture:** A single shared `state` object (exported from `src/state.js`) holds all mutable variables; every other module imports it by reference. Functions are grouped by concern into 10 modules. `src/main.js` is the entry point wired into `index.html` as `type="module"`.

**Tech Stack:** Vanilla ES Modules (native browser, no bundler), HTML5 Canvas 2D, Node.js for `check-tutorial.js`.

---

## Dependency graph (no cycles)

```
constants  utils
    │         │
    └──► state◄──────────────────────┐
              │                      │
         world  physics  hazards    hud
              │     │               │
              └──►render◄──────┐    │
                    │          │    │
                 rocks ────────┘    │
                    │               │
                weapons             │
                    │               │
                 main ◄─────────────┘
```

---

## File map

| File | Lines (est.) | Responsibility |
|---|---|---|
| `src/constants.js` | ~50 | All named constants |
| `src/utils.js` | ~10 | `clamp`, `rand`, `dist`, `norm`, `positiveMod` |
| `src/state.js` | ~60 | Mutable state object + `els` DOM refs |
| `src/world.js` | ~140 | `resize`, `updateMoon`, earth texture, geography |
| `src/physics.js` | ~100 | `gravityAt`, `integrateRock`, `resolveRockCollisions`, geometry helpers |
| `src/render.js` | ~470 | All `draw*` functions, particle helpers |
| `src/rocks.js` | ~320 | Spawn, split, clear, bounce, magnetic, starnet, `hitRock` |
| `src/hazards.js` | ~35 | `activateHazardEvent`, `deactivateHazardEvent` |
| `src/weapons.js` | ~200 | `shoot`, `fireLaser`, `useStarnet`, `fireMoonLaser`, `autoAttack` |
| `src/hud.js` | ~40 | `updateHud`, `selectWeapon` |
| `src/main.js` | ~160 | `update`, `frame`, `resetGame`, `nextLevel`, `endGame`, event listeners |

---

## Task 1: Create `src/constants.js`

**Files:**
- Create: `src/constants.js`

- [ ] Create the file with every constant from `game.js` lines 31–48 plus the auto-attack tables:

```js
export const TAU = Math.PI * 2;
export const G = 2600000;
export const EARTH_MASS = 1;
export const MOON_MASS = 1 / 6;
export const LEVEL_TIME = 60;
export const TOTAL_LEVELS = 10;
export const BOSS_LEVELS = new Set([5, 10]);
export const BLASTER_REFILL = 1.5;
export const PHYSICS_SUBSTEPS = 3;
export const ROCK_DAMAGE = [0, 3, 7, 15, 25, 35];
export const HAZARD_SCHEDULE = [null, "meteor", "solar", "moon", null, "gravity", "meteor", "moon", "solar", null];
export const BOSS_HP_BASE = 5;
export const MAGNETIC_PULL_RADIUS = 220;
export const MAGNETIC_PULL_STRENGTH = 38;
export const AUTO_ATTACK_MODES = ["auto", "special", "closest", "damage", "fastest"];
export const AUTO_ATTACK_LABELS = { auto: "Auto", special: "Special", closest: "Closest", damage: "Danger", fastest: "Fastest" };
export const EARTH_TEXTURE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png";
```

- [ ] Commit: `git add src/constants.js && git commit -m "refactor: extract constants module"`

---

## Task 2: Create `src/utils.js`

**Files:**
- Create: `src/utils.js`

- [ ] Create the file:

```js
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const rand = (min, max) => min + Math.random() * (max - min);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const positiveMod = (value, size) => ((value % size) + size) % size;
export const norm = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};
```

- [ ] Commit: `git add src/utils.js && git commit -m "refactor: extract utils module"`

---

## Task 3: Create `src/state.js`

**Files:**
- Create: `src/state.js`

All modules share one `state` object by reference. Reassigning a property (`state.rocks = ...`) is visible everywhere.

- [ ] Create the file:

```js
import { LEVEL_TIME, AUTO_ATTACK_MODES } from "./constants.js";

export const els = {
  level:           document.getElementById("level"),
  timer:           document.getElementById("timer"),
  score:           document.getElementById("score"),
  lostCountry:     document.getElementById("lostCountry"),
  damageBar:       document.getElementById("damageBar"),
  deflectorBtn:    document.getElementById("deflectorBtn"),
  blasterBtn:      document.getElementById("blasterBtn"),
  starnetBtn:      document.getElementById("starnetBtn"),
  friendlyFireBtn: document.getElementById("friendlyFireBtn"),
  friendlyFireState: document.getElementById("friendlyFireState"),
  blasterCooldown: document.getElementById("blasterCooldown"),
  starnetCount:    document.getElementById("starnetCount"),
  overlay:         document.getElementById("overlay"),
  startBtn:        document.getElementById("startBtn"),
  tutorialBtn:     document.getElementById("tutorialBtn"),
  tutorialOverlay: document.getElementById("tutorialOverlay"),
  tutCloseBtn:     document.getElementById("tutCloseBtn"),
  tutBackBtn:      document.getElementById("tutBackBtn"),
  tutPlayBtn:      document.getElementById("tutPlayBtn"),
  fullscreenBtn:   document.getElementById("fullscreenBtn"),
  fullscreenHudBtn:document.getElementById("fullscreenHudBtn"),
  autoModeBtn:     document.getElementById("autoModeBtn"),
  autoModeLabel:   document.getElementById("autoModeLabel"),
};

export const canvas = document.getElementById("game");
export const ctx    = canvas.getContext("2d");
export const shell  = document.querySelector(".game-shell");

export const state = {
  // viewport
  w: 0, h: 0, dpr: 1,
  // bodies
  earth: {}, moon: {}, satellite: {},
  stars: [], moonCraters: [],
  // timing
  lastTime: 0, running: false,
  // game progress
  level: 1, levelClock: LEVEL_TIME,
  spawnClock: 0, damage: 0, score: 0,
  deflectionsCleared: 0, starnet: 2,
  blasterCooldown: 0, earthSpin: 0, shake: 0,
  // collections
  projectiles: [], rocks: [], particles: [],
  lasers: [], starnetEffects: [],
  // earth
  earthTextureReady: false, earthTextureData: null,
  earthFrameCanvas: document.createElement("canvas"),
  // starnet
  starnetRingLife: 0, starnetActivationId: 0,
  moonLaserClock: 0,
  // damage tracking
  nextDamageStarnet: 10,
  lostCountry: "None", burnSites: [],
  lostCountries: new Set(),
  impactMemory: [],
  // weapons
  selectedWeapon: "deflector", friendlyFire: false,
  // phase effects
  moonPulse: 0, moonShieldLife: 0,
  // hazards
  hazardEvent: null, hazardBanner: null,
  gravityMultiplier: 1, moonSpeedMultiplier: 1,
  spawnRateMultiplier: 1, blasterDisabled: false,
  // boss
  bossActive: false,
  // auto-attack
  autoAttackMode: AUTO_ATTACK_MODES[0],
};
```

- [ ] Commit: `git add src/state.js && git commit -m "refactor: extract shared state module"`

---

## Task 4: Create `src/world.js`

**Files:**
- Create: `src/world.js`

Move: `resize`, `updateMoon`, `cacheEarthTexture`, earth-texture loading, `geoToScreen`, `screenToGeo`, `normalizeLon`, `countryAt`, `addEarthDamage`, `registerImpact`, `repeatedHitFactor`, `isOceanHit`.

- [ ] Create the file (replace body of each function with its content from `game.js`):

```js
import { TAU, G, EARTH_MASS, MOON_MASS, EARTH_TEXTURE_URL } from "./constants.js";
import { clamp, rand, positiveMod } from "./utils.js";
import { canvas, ctx, state } from "./state.js";

export function resize() { /* copy body from game.js */ }
export function updateMoon(dt) { /* copy body */ }
export function starnetRange() { return state.earth.r + (state.moon.orbit - state.earth.r) * 0.5; }

function cacheEarthTexture() { /* copy body */ }

export const earthTexture = new Image();
earthTexture.crossOrigin = "anonymous";
earthTexture.onload = () => { state.earthTextureReady = true; cacheEarthTexture(); };
earthTexture.onerror = () => { state.earthTextureReady = false; };
earthTexture.src = EARTH_TEXTURE_URL;

export function normalizeLon(lon) { return Math.atan2(Math.sin(lon), Math.cos(lon)); }
export function geoToScreen(lat, lon) { /* copy body */ }
export function screenToGeo(x, y) { /* copy body */ }
export function countryAt(latRad, lonRad) { /* copy body */ }
export function isOceanHit(rock) { /* copy body */ }
export function repeatedHitFactor(rock) { /* copy body */ }
export function registerImpact(rock, actualDamage) { /* copy body */ }
export function addEarthDamage(amount, rock) { /* copy body */ }
```

Note: every `earth`, `moon`, `satellite` reference becomes `state.earth`, `state.moon`, `state.satellite`. Every bare state variable (`w`, `h`, `earthSpin`, etc.) becomes `state.w`, `state.h`, `state.earthSpin`, etc.

- [ ] Commit: `git add src/world.js && git commit -m "refactor: extract world module"`

---

## Task 5: Create `src/physics.js`

**Files:**
- Create: `src/physics.js`

Move: `gravityAt`, `integrateRock`, `resolveRockCollisions`, `deflectionRange`, `closestPointOnSegment`, `lineIntersectsEarth`, `moonBlockedForTarget`, `laserScreenEdge`.

- [ ] Create the file:

```js
import { G, EARTH_MASS, MOON_MASS, PHYSICS_SUBSTEPS } from "./constants.js";
import { clamp, norm } from "./utils.js";
import { state } from "./state.js";
import { starnetRange } from "./world.js";

export function deflectionRange() { return state.moon.orbit * 2; }

export function gravityAt(pos) {
  const bodies = [
    { x: state.earth.x, y: state.earth.y, mass: EARTH_MASS },
    { x: state.moon.x,  y: state.moon.y,  mass: MOON_MASS  },
  ];
  let ax = 0, ay = 0;
  for (const body of bodies) {
    const dx = body.x - pos.x, dy = body.y - pos.y;
    const r2 = Math.max(900, dx * dx + dy * dy);
    const invR = 1 / Math.sqrt(r2);
    const force = (G * state.gravityMultiplier * body.mass) / r2;
    ax += dx * invR * force;
    ay += dy * invR * force;
  }
  return { x: ax, y: ay };
}

export function integrateRock(rock, dt) { /* copy body, replace gravityAt with imported */ }
export function resolveRockCollisions() { /* copy body */ }

export function closestPointOnSegment(a, b, p) { /* copy body */ }
export function lineIntersectsEarth(origin, targetX, targetY, radius) { /* copy body */ }
export function moonBlockedForTarget(targetX, targetY) { /* copy body */ }
export function laserScreenEdge(start, dirX, dirY) { /* copy body */ }
```

- [ ] Commit: `git add src/physics.js && git commit -m "refactor: extract physics module"`

---

## Task 6: Create `src/render.js`

**Files:**
- Create: `src/render.js`

Move all `draw*` functions plus particle helpers: `addBurst`, `addCometTrail`, `addStarnetShock`, `drawLightning`.

- [ ] Create the file:

```js
import { TAU, MAGNETIC_PULL_RADIUS, ROCK_DAMAGE, TOTAL_LEVELS } from "./constants.js";
import { clamp, rand } from "./utils.js";
import { canvas, ctx, state } from "./state.js";
import { geoToScreen, normalizeLon } from "./world.js";

export function addBurst(x, y, color, count) { /* copy body */ }
export function addCometTrail(rock) { /* copy body */ }
export function addStarnetShock(rock) { /* copy body */ }

export function draw() { /* copy body — calls all draw* below */ }

function drawSpace() { /* copy body */ }
function drawOrbits() { /* copy body */ }
function drawStarnetRangeRing() { /* copy body */ }
function drawPaths() { /* copy body */ }
function drawEarth() { /* copy body */ }
function drawTexturedEarth() { /* copy body */ }
function drawContinent(x, y, scale, color) { /* copy body */ }
function drawClouds() { /* copy body */ }
function drawMoon() { /* copy body */ }
function drawSatellite() { /* copy body */ }
function drawBurnSites() { /* copy body */ }
function drawRocks() { /* copy body */ }
function drawProjectiles() { /* copy body */ }
function drawLasers() { /* copy body */ }
function drawStarnetEffects() { /* copy body */ }
function drawLightning(x1, y1, x2, y2, segments, seed) { /* copy body */ }
function drawParticles() { /* copy body */ }
function drawReticle() { /* copy body */ }
function drawHazardBanner() { /* copy body */ }
function drawHazardIndicator() { /* copy body */ }
```

All bare state variables become `state.*`. `w`, `h` → `state.w`, `state.h`. `rocks` → `state.rocks`, etc.

- [ ] Commit: `git add src/render.js && git commit -m "refactor: extract render module"`

---

## Task 7: Create `src/rocks.js`

**Files:**
- Create: `src/rocks.js`

Move: `chooseRockType`, `spawnRock`, `spawnMagneticCompanions`, `spawnBoss`, `predictPath`, `clearRock`, `markArenaState`, `isOutsideArena`, `bounceFromMoon`, `resolveRockCollisions`→already in physics, `applyMagneticPull`, `hitRock`, `splitRock`, `applyStarnetField`, `destroyWithStarnet`, `captureHealingRock`, `deflectWithStarnet`.

- [ ] Create the file:

```js
import { TAU, ROCK_DAMAGE, BOSS_HP_BASE, BOSS_LEVELS, MAGNETIC_PULL_RADIUS, MAGNETIC_PULL_STRENGTH } from "./constants.js";
import { clamp, rand, norm } from "./utils.js";
import { state } from "./state.js";
import { gravityAt, integrateRock, deflectionRange, lineIntersectsEarth } from "./physics.js";
import { starnetRange, addEarthDamage } from "./world.js";
import { addBurst, addCometTrail, addStarnetShock } from "./render.js";

export function chooseRockType(rockLevel) { /* copy body */ }
export function spawnRock(forcedLevel, forcedType) { /* copy body — push to state.rocks */ }
export function spawnMagneticCompanions(magRock) { /* copy body */ }
export function spawnBoss() { /* copy body */ }
export function predictPath(rock) { /* copy body — uses gravityAt */ }
export function clearRock(rock, destroyed) { /* copy body */ }
export function markArenaState(rock) { /* copy body */ }
export function isOutsideArena(rock) { /* copy body */ }
export function bounceFromMoon(rock) { /* copy body */ }
export function applyMagneticPull(dt) { /* copy body */ }
export function hitRock(rock, projectile) { /* copy body */ }
export function splitRock(rock, pieces, newLevel, projectile, impulse) { /* copy body */ }
export function applyStarnetField(rock) { /* copy body */ }
export function destroyWithStarnet(rock) { /* copy body */ }
export function captureHealingRock(rock) { /* copy body */ }
export function deflectWithStarnet(rock, distanceFromEarth) { /* copy body */ }
```

Note on `hitRock` ↔ `spawnRock` self-reference: both are in the same file, so no import needed.

- [ ] Commit: `git add src/rocks.js && git commit -m "refactor: extract rocks module"`

---

## Task 8: Create `src/hazards.js`

**Files:**
- Create: `src/hazards.js`

Move: `activateHazardEvent`, `deactivateHazardEvent`.

- [ ] Create the file:

```js
import { state } from "./state.js";

export function activateHazardEvent(type) { /* copy body */ }
export function deactivateHazardEvent() { /* copy body */ }
```

- [ ] Commit: `git add src/hazards.js && git commit -m "refactor: extract hazards module"`

---

## Task 9: Create `src/weapons.js`

**Files:**
- Create: `src/weapons.js`

Move: `shoot`, `chooseShot`, `fireLaser`, `findLaserHit`, `applyBlasterHoming`, `useStarnet`, `fireMoonLaser`, `rockThreatScore`, `autoAttack`.

- [ ] Create the file:

```js
import { TAU, BLASTER_REFILL, ROCK_DAMAGE, AUTO_ATTACK_MODES } from "./constants.js";
import { clamp, rand, norm } from "./utils.js";
import { state } from "./state.js";
import { lineIntersectsEarth, moonBlockedForTarget, closestPointOnSegment, laserScreenEdge } from "./physics.js";
import { starnetRange, addEarthDamage } from "./world.js";
import { hitRock, clearRock, destroyWithStarnet, applyStarnetField } from "./rocks.js";
import { addBurst } from "./render.js";

export function rockThreatScore(rock) { /* copy body */ }
export function shoot(targetX, targetY) { /* copy body */ }
export function chooseShot(targetX, targetY) { /* copy body */ }
export function fireLaser(targetX, targetY) { /* copy body */ }
export function findLaserHit(start, target) { /* copy body */ }
export function applyBlasterHoming(projectile, dt) { /* copy body */ }
export function useStarnet() { /* copy body */ }
export function fireMoonLaser() { /* copy body */ }
export function autoAttack(weaponType) { /* copy body */ }
```

- [ ] Commit: `git add src/weapons.js && git commit -m "refactor: extract weapons module"`

---

## Task 10: Create `src/hud.js`

**Files:**
- Create: `src/hud.js`

Move: `updateHud`, `selectWeapon`.

- [ ] Create the file:

```js
import { TOTAL_LEVELS, AUTO_ATTACK_LABELS } from "./constants.js";
import { clamp } from "./utils.js";
import { els, state } from "./state.js";

export function updateHud() { /* copy body */ }
export function selectWeapon(type) { /* copy body */ }
```

- [ ] Commit: `git add src/hud.js && git commit -m "refactor: extract hud module"`

---

## Task 11: Create `src/main.js`

**Files:**
- Create: `src/main.js`

Move: `resetGame`, `nextLevel`, `endGame`, `update`, `frame`, all event listeners, `resize()` init call.

- [ ] Create the file:

```js
import { LEVEL_TIME, TOTAL_LEVELS, BOSS_LEVELS, HAZARD_SCHEDULE, AUTO_ATTACK_MODES, AUTO_ATTACK_LABELS } from "./constants.js";
import { rand } from "./utils.js";
import { els, canvas, shell, state } from "./state.js";
import { resize, updateMoon, addEarthDamage } from "./world.js";
import { resolveRockCollisions, integrateRock } from "./physics.js";
import { spawnRock, spawnBoss, markArenaState, isOutsideArena, bounceFromMoon, clearRock, applyMagneticPull, applyStarnetField, hitRock } from "./rocks.js";
import { activateHazardEvent, deactivateHazardEvent } from "./hazards.js";
import { shoot, fireLaser, useStarnet, applyBlasterHoming, fireMoonLaser, autoAttack } from "./weapons.js";
import { draw, addCometTrail } from "./render.js";
import { updateHud, selectWeapon } from "./hud.js";

export function resetGame() { /* copy body */ }
export function nextLevel() { /* copy body */ }
export function endGame(message) { /* copy body */ }

function update(dt) { /* copy body */ }

function frame(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

// ── Event wiring ──────────────────────────────
window.addEventListener("resize", resize);
shell.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button") || els.overlay.classList.contains("show")) return;
  shoot(event.clientX, event.clientY);
});
els.deflectorBtn.addEventListener("click", () => selectWeapon("deflector"));
els.blasterBtn.addEventListener("click",   () => selectWeapon("blaster"));
els.starnetBtn.addEventListener("click",   useStarnet);
els.friendlyFireBtn.addEventListener("click", () => {
  state.friendlyFire = !state.friendlyFire;
  updateHud();
});
els.startBtn.addEventListener("click", resetGame);
els.tutorialBtn.addEventListener("click",  () => { els.overlay.classList.remove("show"); els.tutorialOverlay.classList.add("show"); });
els.tutCloseBtn.addEventListener("click",  () => { els.tutorialOverlay.classList.remove("show"); els.overlay.classList.add("show"); });
els.tutBackBtn.addEventListener("click",   () => { els.tutorialOverlay.classList.remove("show"); els.overlay.classList.add("show"); });
els.tutPlayBtn.addEventListener("click",   () => { els.tutorialOverlay.classList.remove("show"); resetGame(); });
els.fullscreenBtn.addEventListener("click",    toggleFullscreen);
els.fullscreenHudBtn.addEventListener("click", toggleFullscreen);
els.autoModeBtn.addEventListener("click", () => {
  const idx = AUTO_ATTACK_MODES.indexOf(state.autoAttackMode);
  state.autoAttackMode = AUTO_ATTACK_MODES[(idx + 1) % AUTO_ATTACK_MODES.length];
  els.autoModeLabel.textContent = AUTO_ATTACK_LABELS[state.autoAttackMode];
});
window.addEventListener("keydown", (event) => {
  if (event.key === "1") { selectWeapon("deflector"); autoAttack("deflector"); }
  if (event.key === "2") { selectWeapon("blaster");   autoAttack("blaster"); }
  if (event.key === "3" || event.key.toLowerCase() === "s") useStarnet();
  if (event.code === "Space") { event.preventDefault(); if (state.running) useStarnet(); else resetGame(); }
});
document.addEventListener("fullscreenchange", updateFullscreenIcons);

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
}
function updateFullscreenIcons() {
  const icon = document.fullscreenElement ? "✕" : "⛶";
  if (els.fullscreenBtn)    els.fullscreenBtn.textContent = icon;
  if (els.fullscreenHudBtn) els.fullscreenHudBtn.textContent = icon;
}

// ── Boot ──────────────────────────────────────
els.autoModeLabel.textContent = AUTO_ATTACK_LABELS[state.autoAttackMode];
els.friendlyFireState.textContent = state.friendlyFire ? "On" : "Off";
els.friendlyFireBtn.classList.toggle("on",  state.friendlyFire);
els.friendlyFireBtn.classList.toggle("off", !state.friendlyFire);
resize();
updateMoon(0);
requestAnimationFrame(frame);
```

- [ ] Commit: `git add src/main.js && git commit -m "refactor: extract main module"`

---

## Task 12: Wire `index.html`, smoke-test, retire `game.js`

**Files:**
- Modify: `index.html` (last `<script>` tag)

- [ ] Replace the script tag in `index.html`:

```html
<!-- old -->
<script src="game.js"></script>

<!-- new -->
<script type="module" src="src/main.js"></script>
```

- [ ] Open `index.html` in a browser (Chrome/Edge — Firefox works too). Verify:
  - Start screen shows
  - Game launches, rocks spawn, weapons fire
  - Tutorial opens and closes
  - Fullscreen toggle works
  - Blaster cooldown ring appears when ready
  - Catastrophe level triggers at level 5

- [ ] Run tutorial check:

```
node check-tutorial.js
```

Expected: `PASS  Tutorial covers all features.`

- [ ] Delete the old monolith:

```
git rm game.js
git add index.html
git commit -m "refactor: retire game.js — game now runs as ES modules under src/"
```

---

## Self-review notes

- **Spec coverage:** All 11 source modules mapped. All functions from `game.js` accounted for.
- **Placeholders:** Function bodies say "copy body" — these are explicit instructions to copy verbatim, not vague TODOs.
- **Type consistency:** `state.*` used uniformly; no bare globals after refactor.
- **Circular deps:** dependency graph above confirms none.
- **Duplicate constant bug:** `game.js` currently has `AUTO_ATTACK_MODES`/`AUTO_ATTACK_LABELS` declared twice (lines 45-46 and 50-51). Remove the duplicate during Task 11 cleanup.
