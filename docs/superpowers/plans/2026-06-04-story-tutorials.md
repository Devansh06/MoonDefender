# Story Tutorials + Mission Control Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two interactive in-engine tutorials (Combat + Rock Types) guided by a standalone Mission Control agent with TTS voice, plus a tutorial select screen and numpad controls.

**Architecture:** Tutorial engine (`src/tutorial.js`) drives scripted rock sequences via game API hooks exposed in `main.js`. Mission Control (`src/mission-control.js`) is a standalone HTML-overlay agent callable from anywhere. Tutorials run inside the real game loop — real physics, normal rock speed, spawn suppressed during tutorial.

**Tech Stack:** Vanilla ES modules, Web Speech API, HTML/CSS overlay elements, existing game state in `src/state.js`.

**Spec:** `docs/superpowers/specs/2026-06-04-story-tutorials-design.md`

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `src/main.js` | Numpad keys; game API exports; tutorialTick hook; suppress spawning/level in tutorial mode |
| Modify | `src/state.js` | Add `tutorialMode`, `hitsCleared`; add `mcBubble`, `mcText`, `tutorialSelectOverlay`, `tutEndScreen`, `rockEntryScreen` to `els` |
| Modify | `src/rocks.js` | Increment `hitsCleared` on blast-destroy; keep `deflectionsCleared` for stats |
| Modify | `src/hud.js` | Add `lockWeapon(name)`, `unlockWeapon(name)`, `lockAllWeapons()` |
| Modify | `index.html` | MC bubble element; tutorial select overlay; tutorial-1 end screen; rock type entry screen |
| Modify | `styles.css` | Styles for all new HTML elements |
| Create | `src/mission-control.js` | Standalone MC agent: speak, silence, setIcon |
| Create | `src/tutorial.js` | Step runner, game API calls, combat steps, rock-type sequences |

---

## Task 1: Numpad 1 / 2 / 3 controls

**Files:**
- Modify: `src/main.js` (keydown listener, around line 298)

- [ ] **Step 1: Add Numpad keys to the keydown handler**

In `src/main.js`, find the `keydown` listener (line 298). Add three lines directly after the existing `key === "1"` / `key === "2"` / `key === "3"` checks:

```js
window.addEventListener("keydown", (event) => {
  if (event.key === "1" || event.code === "Numpad1") { selectWeapon("deflector"); autoAttack("deflector"); }
  if (event.key === "2" || event.code === "Numpad2") { selectWeapon("blaster");   autoAttack("blaster"); }
  if (event.key === "3" || event.key.toLowerCase() === "s" || event.code === "Numpad3") useStarnet();
  if (event.key === "=" || event.key === "+") cycleSpeed();
  if (event.key.toLowerCase() === "p" || event.key === "Escape") { event.preventDefault(); togglePause(); }
  if (event.code === "Space") { event.preventDefault(); if (state.running) useStarnet(); else resetGame(); }
});
```

- [ ] **Step 2: Verify in browser**

Open the game. Press Numpad1 — weapon panel should highlight Deflect. Press Numpad2 — Blast. Press Numpad3 — Starnet fires if charges available.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: add Numpad 1/2/3 weapon controls"
```

---

## Task 2: `hitsCleared` counter — blasts now also refill Starnet

**Files:**
- Modify: `src/state.js` (state object)
- Modify: `src/rocks.js` (`clearRock` function, line 238)
- Modify: `src/main.js` (`resetGame`, line 12)

- [ ] **Step 1: Add `hitsCleared` to state**

In `src/state.js`, add `hitsCleared: 0` next to `deflectionsCleared`:

```js
  deflectionsCleared: 0, hitsCleared: 0, starnet: 2,
```

Also add `tutorialMode: false` to the state object (used in later tasks):

```js
  // tutorial
  tutorialMode: false,
```

- [ ] **Step 2: Increment `hitsCleared` in `clearRock`**

In `src/rocks.js` at line 244, the existing block already increments `deflectionsCleared` for deflections and destroys. Add `hitsCleared` alongside it:

```js
export function clearRock(rock, destroyed) {
  if (rock.cleared) return;
  rock.cleared = true;
  const successfulDeflection = !destroyed && rock.deflected;
  if (rock.rockType !== "healing" && rock.rockType !== "boss") {
    state.score += destroyed ? rock.level * 75 : successfulDeflection ? rock.level * 40 : 0;
    if (destroyed || successfulDeflection) {
      state.deflectionsCleared += 1;
      state.hitsCleared += 1;
      if (state.hitsCleared % 3 === 0) state.starnet += 1;
    }
  }
  addBurst(rock.x, rock.y, destroyed ? "#ffcf70" : "#8ff0b2", 16 + rock.level * 4);
}
```

Note: `deflectionsCleared` still increments (kept for stats). `hitsCleared` now drives the Starnet refill (both blasts and deflections count).

- [ ] **Step 3: Reset `hitsCleared` in `resetGame`**

In `src/main.js` inside `resetGame()`, add after the `deflectionsCleared` reset:

```js
  state.deflectionsCleared = 0;
  state.hitsCleared = 0;
```

- [ ] **Step 4: Verify in browser**

Start a game. Deflect or blast 3 rocks — Starnet count should tick from 2 to 3. Open console and run `state.hitsCleared` to confirm it increments.

- [ ] **Step 5: Commit**

```bash
git add src/state.js src/rocks.js src/main.js
git commit -m "feat: hitsCleared counter — blasts and deflections both refill Starnet every 3 hits"
```

---

## Task 3: `lockWeapon` / `unlockWeapon` in hud.js

**Files:**
- Modify: `src/hud.js`

- [ ] **Step 1: Add lock/unlock helpers**

Append to `src/hud.js`:

```js
export function lockWeapon(name) {
  const btn = name === "deflector" ? els.deflectorBtn
            : name === "blaster"   ? els.blasterBtn
            : name === "starnet"   ? els.starnetBtn : null;
  if (btn) { btn.disabled = true; btn.dataset.tutLocked = "1"; }
}

export function unlockWeapon(name) {
  const btn = name === "deflector" ? els.deflectorBtn
            : name === "blaster"   ? els.blasterBtn
            : name === "starnet"   ? els.starnetBtn : null;
  if (btn) { btn.disabled = false; delete btn.dataset.tutLocked; }
}

export function lockAllWeapons() {
  ["deflector", "blaster", "starnet"].forEach(lockWeapon);
}
```

- [ ] **Step 2: Verify in browser console**

```js
import { lockWeapon, unlockWeapon } from "./src/hud.js";
lockWeapon("blaster"); // Blast button greys out
unlockWeapon("blaster"); // re-enables
```

(Open DevTools → Console — the game uses ES modules so you can't import directly, but you can test by temporarily calling from main.js and observing the UI.)

- [ ] **Step 3: Commit**

```bash
git add src/hud.js
git commit -m "feat: lockWeapon/unlockWeapon/lockAllWeapons helpers for tutorial"
```

---

## Task 4: Mission Control HTML element + CSS

**Files:**
- Modify: `index.html` (inside `.game-shell`, before `</main>`)
- Modify: `styles.css`

- [ ] **Step 1: Add MC bubble element to index.html**

Inside `<main class="game-shell">`, before the closing `</main>`, add:

```html
<!-- Mission Control bubble -->
<div id="mcBubble" class="mc-bubble mc-hidden" aria-live="polite">
  <svg class="mc-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
    <path d="M7 9a5 5 0 0 1 10 0v3a5 5 0 0 1-10 0V9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M5 11h2M17 11h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 17v2M10 19h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
  <span id="mcText" class="mc-text"></span>
</div>
```

- [ ] **Step 2: Add CSS to styles.css**

Append to `styles.css`:

```css
/* ── Mission Control bubble ── */
.mc-bubble {
  position: absolute;
  top: clamp(52px, 10vh, 72px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  background: rgba(5, 12, 35, 0.92);
  border: 1px solid rgba(74, 122, 255, 0.45);
  border-radius: 14px;
  padding: 10px 18px 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(480px, 88vw);
  pointer-events: none;
  transition: opacity 0.35s, transform 0.35s;
  box-shadow: 0 0 24px rgba(74, 122, 255, 0.15);
}
.mc-bubble.mc-hidden {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
  pointer-events: none;
}
.mc-icon {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  color: #4a7aff;
}
.mc-text {
  font-family: ui-monospace, "Cascadia Code", "Fira Mono", monospace;
  font-size: clamp(0.75rem, 1.8vw, 0.88rem);
  color: #a0c8ff;
  line-height: 1.45;
}
```

- [ ] **Step 3: Verify in browser**

Load the game. Open DevTools console and run:
```js
document.getElementById("mcBubble").classList.remove("mc-hidden")
document.getElementById("mcText").textContent = "This is Mission Control."
```
Bubble should appear centred below the top HUD.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat: Mission Control bubble HTML element and CSS"
```

---

## Task 5: Mission Control agent (`src/mission-control.js`)

**Files:**
- Create: `src/mission-control.js`
- Modify: `src/state.js` (add `mcBubble`, `mcText` to `els`)

- [ ] **Step 1: Add MC elements to `els` in state.js**

In `src/state.js`, add two lines to the `els` object:

```js
  mcBubble:          document.getElementById("mcBubble"),
  mcText:            document.getElementById("mcText"),
```

- [ ] **Step 2: Create `src/mission-control.js`**

```js
import { els } from "./state.js";

const TYPEWRITER_SPEED = 30; // characters per second

let typewriterTimer = null;
let voicesLoaded = false;

function getFemaleVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v =>
    /female|woman|samantha|karen|zira|victoria|moira|fiona|tessa/i.test(v.name)
  ) || voices.find(v => v.lang.startsWith("en")) || null;
}

// Voices load async on first call in some browsers
if ("speechSynthesis" in window) {
  speechSynthesis.addEventListener("voiceschanged", () => { voicesLoaded = true; });
}

export const missionControl = {
  speak(text) {
    const bubble = els.mcBubble;
    const textEl  = els.mcText;
    if (!bubble || !textEl) return;

    this.silence();

    bubble.classList.remove("mc-hidden");
    textEl.textContent = "";

    let i = 0;
    typewriterTimer = setInterval(() => {
      textEl.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(typewriterTimer);
    }, 1000 / TYPEWRITER_SPEED);

    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.pitch = 0.78;
      utter.rate  = 0.88;
      const voice = getFemaleVoice();
      if (voice) utter.voice = voice;
      utter.onend = () => {
        setTimeout(() => bubble.classList.add("mc-hidden"), 1400);
      };
      speechSynthesis.speak(utter);
    } else {
      // no TTS — keep bubble visible for reading time (approx 40 wpm)
      const readMs = Math.max(2000, (text.split(" ").length / 40) * 60000);
      setTimeout(() => bubble.classList.add("mc-hidden"), readMs);
    }
  },

  silence() {
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    els.mcBubble?.classList.add("mc-hidden");
  },

  setIcon(svgString) {
    const icon = els.mcBubble?.querySelector(".mc-icon");
    if (icon) icon.outerHTML = svgString;
  },
};
```

- [ ] **Step 3: Smoke-test in browser console**

Add a temporary `window.mc = missionControl` export at the bottom of `mission-control.js`, open browser, run:
```js
mc.speak("This is Mission Control. Earth is not ready. You are.")
```
Bubble should appear, typewriter animates the text, and TTS voice plays (if supported by browser). Remove the `window.mc` line after testing.

- [ ] **Step 4: Commit**

```bash
git add src/mission-control.js src/state.js
git commit -m "feat: Mission Control standalone agent with TTS and typewriter bubble"
```

---

## Task 6: Game API hooks in `main.js`

**Files:**
- Modify: `src/main.js`

These functions are called by `tutorial.js`. Export them from `main.js`.

- [ ] **Step 1: Add imports in main.js**

At the top of `src/main.js`, the `hud.js` import line already exists. Update it to include the new helpers:

```js
import { updateHud, selectWeapon, lockWeapon, unlockWeapon, lockAllWeapons } from "./hud.js";
```

- [ ] **Step 2: Add exported API functions**

Add these exports after `resetGame` in `src/main.js`:

```js
export function pauseNormalSpawning() {
  state.spawnClock = 999999;
}

export function resumeNormalSpawning() {
  state.spawnClock = 0;
}

export function setTutorialMode(on) {
  state.tutorialMode = on;
  if (!on) {
    unlockWeapon("deflector");
    unlockWeapon("blaster");
    unlockWeapon("starnet");
  }
}

export function spawnScriptedRock(type, angleOverride) {
  const far = Math.max(state.w, state.h) * 0.68 + state.earth.r;
  const angle = angleOverride !== undefined ? angleOverride : Math.random() * Math.PI * 2;
  const pos = {
    x: state.earth.x + Math.cos(angle) * far,
    y: state.earth.y + Math.sin(angle) * far,
  };
  const targetAngle = Math.atan2(state.earth.y - pos.y, state.earth.x - pos.x);
  const speed = type === "comet" ? 96 : 64;
  const r = type === "comet" ? 8 : type === "healing" ? 14 : type === "magnetic" ? 19 : 15;

  const rock = {
    x: pos.x, y: pos.y,
    vx: Math.cos(targetAngle) * speed,
    vy: Math.sin(targetAngle) * speed,
    level: type === "boss" ? 5 : 2,
    rockType: type,
    breakCount: 0, r,
    seed: Math.random() * 999,
    cleared: false, deflected: false,
    spiral: false, enteredArena: false,
    earthSeeking: false, path: [], pathClock: 0,
    armorHits: 0, deflectorHits: 0, cracked: false,
    starnetActivationId: 0, starnetOrigin: null,
    starnetHit: false, lastStarnetDistance: 0,
  };
  state.rocks.push(rock);
  if (type === "magnetic") {
    // import spawnMagneticCompanions already available via rocks.js
    import("./rocks.js").then(m => m.spawnMagneticCompanions(rock));
  }
}
```

- [ ] **Step 3: Hook tutorial tick into the game loop**

At the bottom of the `update(dt)` function in `src/main.js`, add before the closing brace:

```js
  if (state.tutorialMode) tutorialTick(dt);
```

Add the import at the top of the file:

```js
import { tutorialTick } from "./tutorial.js";
```

- [ ] **Step 4: Suppress level transitions in tutorial mode**

In `update(dt)`, find the line (around line 218):
```js
  if (state.levelClock <= 0 && !state.bossActive) nextLevel();
```
Replace with:
```js
  if (state.levelClock <= 0 && !state.bossActive && !state.tutorialMode) nextLevel();
```

- [ ] **Step 5: Commit** (tutorial.js doesn't exist yet — comment out the tutorialTick import/call temporarily)

Actually, create a stub `src/tutorial.js` first:

```js
export function tutorialTick(_dt) {}
```

Then commit:

```bash
git add src/main.js src/tutorial.js src/hud.js
git commit -m "feat: game API hooks for tutorial engine (pauseSpawning, spawnScriptedRock, setTutorialMode)"
```

---

## Task 7: Tutorial select overlay + How-to-Play wiring

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/state.js` (add new elements to `els`)
- Modify: `src/main.js` (rewire Tutorial button)

- [ ] **Step 1: Add tutorial select overlay to index.html**

After the existing `#tutorialOverlay` closing `</div>`, add:

```html
<!-- Tutorial select overlay -->
<div id="tutorialSelectOverlay" class="overlay">
  <div class="panel">
    <div class="panel-header">
      <button id="tutSelCloseBtn" class="panel-close" type="button" aria-label="Close">&#x2715;</button>
    </div>
    <div class="panel-body">
      <h2>Tutorials</h2>
      <p style="color:var(--muted);font-size:0.9em;margin-bottom:1.4rem">Choose a tutorial or reference guide</p>
      <nav class="panel-nav">
        <button id="tutCombatBtn"    class="nav-btn nav-primary" type="button">Combat Tutorial</button>
        <button id="tutRocksBtn"     class="nav-btn" type="button">Rock Types Guide</button>
        <button id="tutHowToPlayBtn" class="nav-btn" type="button">How-to-Play</button>
        <button id="tutSelBackBtn"   class="nav-btn" type="button">&#8592; Back</button>
      </nav>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add new elements to `els` in state.js**

```js
  tutorialSelectOverlay: document.getElementById("tutorialSelectOverlay"),
  tutSelCloseBtn:        document.getElementById("tutSelCloseBtn"),
  tutCombatBtn:          document.getElementById("tutCombatBtn"),
  tutRocksBtn:           document.getElementById("tutRocksBtn"),
  tutHowToPlayBtn:       document.getElementById("tutHowToPlayBtn"),
  tutSelBackBtn:         document.getElementById("tutSelBackBtn"),
```

- [ ] **Step 3: Rewire Tutorial button + add new listeners in main.js**

Find line 276:
```js
els.tutorialBtn.addEventListener("click", () => { els.overlay.classList.remove("show"); els.tutorialOverlay.classList.add("show"); });
```

Replace with:
```js
els.tutorialBtn.addEventListener("click", () => {
  els.overlay.classList.remove("show");
  els.tutorialSelectOverlay.classList.add("show");
});
els.tutSelCloseBtn.addEventListener("click", () => {
  els.tutorialSelectOverlay.classList.remove("show");
  els.overlay.classList.add("show");
});
els.tutSelBackBtn.addEventListener("click", () => {
  els.tutorialSelectOverlay.classList.remove("show");
  els.overlay.classList.add("show");
});
els.tutHowToPlayBtn.addEventListener("click", () => {
  els.tutorialSelectOverlay.classList.remove("show");
  els.tutorialOverlay.classList.add("show");
});
// Combat + Rock Types wired in Task 9 and Task 12
```

- [ ] **Step 4: Verify in browser**

Click Tutorial on main menu → Tutorial Select screen appears with three buttons. "How-to-Play" opens the old tutorial. Back and X both return to main menu.

- [ ] **Step 5: Commit**

```bash
git add index.html src/state.js src/main.js
git commit -m "feat: tutorial select overlay with Combat, Rock Types, How-to-Play options"
```

---

## Task 8: Tutorial engine step-runner (`src/tutorial.js` full)

**Files:**
- Modify: `src/tutorial.js` (replace stub)

- [ ] **Step 1: Write the step-runner core**

Replace `src/tutorial.js` with:

```js
import { state, els } from "./state.js";
import { missionControl } from "./mission-control.js";
import { selectWeapon, lockWeapon, unlockWeapon, lockAllWeapons } from "./hud.js";
import { pauseNormalSpawning, resumeNormalSpawning, setTutorialMode, spawnScriptedRock } from "./main.js";

let activeSequence = null;
let currentStep = -1;
let tutorialClock = 0;
let prevHitsCleared = 0;
let prevStarnetId = 0;

function advanceStep() {
  if (activeSequence === null) return;
  const prevStep = activeSequence[currentStep];
  if (prevStep?.leave) prevStep.leave();

  currentStep += 1;
  tutorialClock = 0;
  prevHitsCleared = state.hitsCleared;
  prevStarnetId   = state.starnetActivationId;

  if (currentStep >= activeSequence.length) {
    onSequenceComplete();
    return;
  }
  const step = activeSequence[currentStep];
  if (step.enter) step.enter();
}

function onSequenceComplete() {
  if (activeSequence === COMBAT_STEPS) {
    showTutorialEndScreen();
  } else {
    showRockTypesComplete();
  }
  activeSequence = null;
  currentStep   = -1;
}

export function tutorialTick(dt) {
  if (!activeSequence || currentStep < 0 || currentStep >= activeSequence.length) return;
  tutorialClock += dt;
  const step = activeSequence[currentStep];
  if (step.waitFor && step.waitFor()) advanceStep();
}

function initTutorialState() {
  state.running   = true;
  state.paused    = false;
  state.level     = 1;
  state.damage    = 0;
  state.score     = 0;
  state.hitsCleared = 0;
  state.deflectionsCleared = 0;
  state.starnet   = 2;
  state.blasterCooldown = 0;
  state.hazardEvent = null;
  state.bossActive  = false;
  state.rocks       = [];
  state.projectiles = [];
  state.particles   = [];
  state.starnetEffects = [];
  state.starnetRingLife = 0;
  state.starnetActivationId = 0;
  els.pauseBtn.classList.remove("is-paused");
  setTutorialMode(true);
  pauseNormalSpawning();
}

// ─── COMBAT TUTORIAL ─────────────────────────────────────────────────────────

export function startCombat() {
  initTutorialState();
  lockAllWeapons();
  unlockWeapon("deflector");
  selectWeapon("deflector");
  els.tutorialSelectOverlay.classList.remove("show");
  activeSequence = COMBAT_STEPS;
  currentStep   = -1;
  tutorialClock = 0;
  advanceStep();
}

const COMBAT_STEPS = [
  // ★ cinematic
  {
    enter() {
      lockAllWeapons();
      missionControl.speak("This is Mission Control. We've picked up a hostile approach vector. Earth is not ready. You are.");
    },
    waitFor() { return tutorialClock >= 4; },
  },
  // 1: deflect rock 1
  {
    enter() {
      prevHitsCleared = state.hitsCleared;
      spawnScriptedRock("normal", Math.PI * 0.75);
      missionControl.speak("Rock inbound. Tap toward it — the Deflector fires a push-pulse. Redirect it.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared; },
  },
  // 2: deflect rock 2
  {
    enter() {
      prevHitsCleared = state.hitsCleared;
      spawnScriptedRock("normal", Math.PI * 0.25);
      missionControl.speak("Another one. Different angle. Stay sharp.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared; },
  },
  // 3: unlock blaster, spawn magnetic
  {
    enter() {
      unlockWeapon("blaster");
      spawnScriptedRock("magnetic", Math.PI * 1.5);
      missionControl.speak("Magnetic contact. Deflecting it won't kill the pull — it'll keep dragging others toward it. Switch to Blaster, key 2. Destroy it.");
    },
    waitFor() { return state.selectedWeapon === "blaster"; },
  },
  // 4: fire blaster (3rd hit → unlock starnet)
  {
    enter() {
      prevHitsCleared = state.hitsCleared;
      missionControl.speak("Fire.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared; },
    leave() {
      unlockWeapon("starnet");
    },
  },
  // 4b: brief pause — "Starnet is now available"
  {
    enter() {
      missionControl.speak("Starnet is now available.");
    },
    waitFor() { return tutorialClock >= 2.5; },
  },
  // 5: 4 rocks from spread angles
  {
    enter() {
      prevStarnetId = state.starnetActivationId;
      const angles = [Math.PI * 0.1, Math.PI * 0.6, Math.PI * 1.1, Math.PI * 1.7];
      angles.forEach(a => spawnScriptedRock("normal", a));
      missionControl.speak("Four contacts — too many to pick off. Starnet deploys a full ring shield. Space bar. Use it.");
    },
    waitFor() { return state.starnetActivationId > prevStarnetId; },
  },
  // 6: post-starnet message
  {
    enter() {
      missionControl.speak("You start with only two charges. Refill them with 3 blasts or deflections. Use them wisely.");
    },
    waitFor() { return tutorialClock >= 4; },
  },
  // ✓: end — show choice screen (handled in onSequenceComplete)
  {
    enter() {
      missionControl.speak("Earth is still standing. Your call, soldier.");
    },
    waitFor() { return tutorialClock >= 3; },
  },
];

function showTutorialEndScreen() {
  missionControl.silence();
  setTutorialMode(false);
  pauseNormalSpawning();
  els.tutEndScreen.classList.add("show");
}

export function tutEndStartMission() {
  els.tutEndScreen.classList.remove("show");
  resumeNormalSpawning();
  // resetGame already spawns 3 rocks and starts the loop — reuse it
  import("./main.js").then(m => m.resetGame());
}

export function tutEndBackToTutorials() {
  els.tutEndScreen.classList.remove("show");
  state.running = false;
  state.rocks = [];
  state.projectiles = [];
  els.tutorialSelectOverlay.classList.add("show");
}

// ─── ROCK TYPES TUTORIAL ─────────────────────────────────────────────────────

const ROCK_TYPE_ORDER = ["normal", "comet", "armored", "magnetic", "healing", "catastrophe"];

export function startRockTypes(entryType) {
  initTutorialState();
  selectWeapon("deflector");
  els.tutorialSelectOverlay.classList.remove("show");
  els.rockEntryScreen.classList.remove("show");

  if (entryType === "all") {
    activeSequence = buildRockTypeSequence(ROCK_TYPE_ORDER);
  } else {
    activeSequence = buildRockTypeSequence([entryType || "normal"]);
  }
  currentStep   = -1;
  tutorialClock = 0;
  advanceStep();
}

function buildRockTypeSequence(types) {
  return types.flatMap(type => ROCK_TYPE_STEPS[type] || []);
}

const ROCK_TYPE_STEPS = {
  normal: [
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("normal", Math.PI * 0.75);
        missionControl.speak("Standard debris. Small ones go down in one hit. Level 3 to 5 splits on impact — one hit becomes two rocks.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 30; },
    },
  ],
  comet: [
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("comet", Math.PI * 0.5);
        missionControl.speak("Three times normal speed. Fragile — one hit drops it. Worth 150 bonus points.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 30; },
    },
  ],
  armored: [
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("armored", Math.PI * 1.25);
        missionControl.speak("There's a sequence. Learn it or waste shots. Two deflector hits redirect uncracked armor. Or blast to crack it, then one more deflect. Two blasts destroy it entirely.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 40; },
    },
  ],
  magnetic: [
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("magnetic", Math.PI * 1.0);
        missionControl.speak("That dotted ring is a gravity well. Pulling other rocks toward it. You cannot deflect it — blast it or use Starnet. Kill the source — pull stops instantly.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 35; },
    },
  ],
  healing: [
    {
      enter() {
        spawnScriptedRock("healing", Math.PI * 0.9);
        missionControl.speak("This one's different. Don't shoot it. Figure out how to bring it in safely.");
      },
      waitFor() {
        // advance when rock cleared (captured or out of bounds) or after 20s
        return !state.rocks.some(r => !r.cleared && r.rockType === "healing") || tutorialClock > 20;
      },
    },
  ],
  catastrophe: [
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        // spawnBoss handles catastrophe rock
        import("./rocks.js").then(m => {
          state.bossActive = true;
          m.spawnBoss();
        });
        missionControl.speak("Boss-class. Three orbiting companions. Crack the shell first — two hits. One more ends it. Starnet on uncracked armor bounces back. You've been warned.");
      },
      waitFor() {
        return !state.rocks.some(r => !r.cleared && r.rockType === "boss") || tutorialClock > 60;
      },
    },
  ],
};

function showRockTypesComplete() {
  missionControl.silence();
  setTutorialMode(false);
  pauseNormalSpawning();
  state.rocks = [];
  state.bossActive = false;
  els.rockEntryScreen.classList.add("show");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tutorial.js
git commit -m "feat: tutorial step-runner engine with combat and rock-type sequences"
```

---

## Task 9: Tutorial end screen + rock entry screen HTML

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/state.js` (add new elements)
- Modify: `src/main.js` (wire buttons)

- [ ] **Step 1: Add tutorial end screen to index.html**

After the `#tutorialSelectOverlay` closing tag, add:

```html
<!-- Tutorial 1 end screen -->
<div id="tutEndScreen" class="overlay">
  <div class="panel">
    <div class="panel-body" style="text-align:center;padding-top:2rem">
      <h2>Training Complete</h2>
      <p style="color:var(--muted);margin:1rem 0 1.8rem">Earth is still standing. Your call, soldier.</p>
      <nav class="panel-nav">
        <button id="tutEndStartBtn" class="nav-btn nav-primary" type="button">Start Mission</button>
        <button id="tutEndBackBtn"  class="nav-btn" type="button">&#8592; Back to Tutorials</button>
      </nav>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add rock entry screen to index.html**

After `#tutEndScreen`, add:

```html
<!-- Rock types entry / completion screen -->
<div id="rockEntryScreen" class="overlay">
  <div class="panel">
    <div class="panel-header">
      <button id="rockEntryCloseBtn" class="panel-close" type="button" aria-label="Close">&#x2715;</button>
    </div>
    <div class="panel-body">
      <h2>Rock Types Guide</h2>
      <p style="color:var(--muted);font-size:0.88em;margin-bottom:1.2rem">Select a rock to study, or start the full sequence</p>
      <nav class="panel-nav rock-entry-nav">
        <button class="nav-btn nav-primary rock-entry-btn" data-rock="all"          type="button">All Rocks (from Normal)</button>
        <button class="nav-btn rock-entry-btn" data-rock="normal"       type="button" style="color:#c0bfbc">Normal Rock</button>
        <button class="nav-btn rock-entry-btn" data-rock="comet"        type="button" style="color:#88eeff">Comet</button>
        <button class="nav-btn rock-entry-btn" data-rock="armored"      type="button" style="color:#c8c8b4">Armored Rock</button>
        <button class="nav-btn rock-entry-btn" data-rock="magnetic"     type="button" style="color:#c070ff">Magnetic Rock</button>
        <button class="nav-btn rock-entry-btn" data-rock="healing"      type="button" style="color:#44ff88">Healing Rock</button>
        <button class="nav-btn rock-entry-btn" data-rock="catastrophe"  type="button" style="color:#c070ff">Catastrophe Rock</button>
        <button id="rockEntryBackBtn" class="nav-btn" type="button">&#8592; Back to Tutorials</button>
      </nav>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add new elements to `els` in state.js**

```js
  tutEndScreen:        document.getElementById("tutEndScreen"),
  tutEndStartBtn:      document.getElementById("tutEndStartBtn"),
  tutEndBackBtn:       document.getElementById("tutEndBackBtn"),
  rockEntryScreen:     document.getElementById("rockEntryScreen"),
  rockEntryCloseBtn:   document.getElementById("rockEntryCloseBtn"),
  rockEntryBackBtn:    document.getElementById("rockEntryBackBtn"),
```

- [ ] **Step 4: Wire all new buttons in main.js**

Import the tutorial functions at the top of `main.js`:

```js
import { startCombat, startRockTypes, tutEndStartMission, tutEndBackToTutorials } from "./tutorial.js";
```

Add button listeners (after existing listener block):

```js
// Tutorial combat
els.tutCombatBtn.addEventListener("click", startCombat);

// Tutorial end screen
els.tutEndStartBtn.addEventListener("click", tutEndStartMission);
els.tutEndBackBtn.addEventListener("click",  tutEndBackToTutorials);

// Rock types entry screen
els.tutRocksBtn.addEventListener("click", () => {
  els.tutorialSelectOverlay.classList.remove("show");
  els.rockEntryScreen.classList.add("show");
});
els.rockEntryCloseBtn.addEventListener("click", () => {
  els.rockEntryScreen.classList.remove("show");
  els.overlay.classList.add("show");
});
els.rockEntryBackBtn.addEventListener("click", () => {
  els.rockEntryScreen.classList.remove("show");
  els.tutorialSelectOverlay.classList.add("show");
});
document.querySelectorAll(".rock-entry-btn").forEach(btn => {
  btn.addEventListener("click", () => startRockTypes(btn.dataset.rock));
});
```

- [ ] **Step 5: Verify full combat tutorial flow in browser**

1. Main menu → Tutorial → Combat Tutorial
2. MC opens cinematic line — wait 4 seconds
3. Rock spawns — deflect it
4. Second rock — deflect it
5. Magnetic rock spawns — Blast button unlocks — switch to Blast
6. Fire blaster — Starnet unlocks
7. 4 rocks from spread angles — press Space
8. MC speaks charge info
9. End screen appears — "Start Mission" starts Level 1, "Back" returns to select

- [ ] **Step 6: Commit**

```bash
git add index.html src/state.js src/main.js src/tutorial.js
git commit -m "feat: tutorial end screen, rock entry screen, full tutorial flow wired"
```

---

## Task 10: CSS for overlays

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add rock entry nav style**

Append to `styles.css`:

```css
/* ── Rock entry nav ── */
.rock-entry-nav {
  gap: 8px;
}
.rock-entry-nav .nav-btn {
  font-size: 0.88em;
}
```

The existing `.panel`, `.panel-nav`, `.nav-btn`, `.nav-primary`, `.overlay` classes from `styles.css` already cover the rest of the new overlays. No additional styles needed beyond what was added in Task 4.

- [ ] **Step 2: Verify rock types flow in browser**

1. Tutorial → Rock Types Guide → screen shows 7 buttons
2. Pick "Comet" — comet spawns at speed, MC speaks
3. Destroy it — rock entry screen returns
4. Pick "All Rocks" — cycles Normal → Comet → Armored → Magnetic → Healing → Catastrophe

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: rock entry nav CSS polish"
```

---

## Task 11: Verify `check-tutorial.js` still passes

**Files:**
- Run: `node check-tutorial.js`

The existing `#tutorialOverlay` (How-to-Play screen) is untouched, so `check-tutorial.js` should still pass.

- [ ] **Step 1: Run the check**

```bash
node check-tutorial.js
```

Expected output:
```
Rock Types
  [OK] Normal Rock
  [OK] Comet
  [OK] Armored Rock
  [OK] Magnetic Rock
  [OK] Healing Rock
  [OK] Catastrophe Rock

Hazard Events
  [OK] Solar Flare
  [OK] Meteor Shower
  [OK] Rogue Moon
  [OK] Gravity Surge

Weapons
  [OK] Deflect
  [OK] Blast
  [OK] Starnet

Controls
  [OK] Tap / Click
  [OK] moon lasers
  [OK] Fastest

────────────────────────────────────────────────
PASS  Tutorial covers all features.
```

- [ ] **Step 2: Update `index.html` How-to-Play controls section to mention numpad**

In `index.html` inside `#tutorialOverlay`, find:
```html
<div class="ctrl-item"><kbd>1</kbd><span>Deflector — auto-fires using target mode</span></div>
<div class="ctrl-item"><kbd>2</kbd><span>Blaster — auto-fires using target mode</span></div>
<div class="ctrl-item"><kbd>Space / 3</kbd><span>Starnet shield + moon lasers</span></div>
```

Replace with:
```html
<div class="ctrl-item"><kbd>1 / Numpad1</kbd><span>Deflector — auto-fires using target mode</span></div>
<div class="ctrl-item"><kbd>2 / Numpad2</kbd><span>Blaster — auto-fires using target mode</span></div>
<div class="ctrl-item"><kbd>Space / 3 / Numpad3</kbd><span>Starnet shield + moon lasers</span></div>
```

- [ ] **Step 3: Re-run check**

```bash
node check-tutorial.js
```

Expected: `PASS`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "docs: update How-to-Play controls to include Numpad 1/2/3"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Numpad 1/2/3 | Task 1 |
| hitsCleared — blasts + deflects refill Starnet | Task 2 |
| lockWeapon/unlockWeapon | Task 3 |
| MC bubble HTML + CSS | Task 4 |
| MC agent with TTS raspy female voice | Task 5 |
| Game API hooks (pause/resume spawn, spawnScriptedRock, setTutorialMode) | Task 6 |
| Tutorial select overlay (3 options) | Task 7 |
| Step runner engine | Task 8 |
| Combat tutorial sequence (all 8 steps incl. cinematic + end) | Task 8 |
| Tutorial 1 end screen with Start Mission / Back | Task 9 |
| Rock types entry screen (7 buttons) | Task 9 |
| All buttons wired in main.js | Task 9 |
| Rock type sequences (all 6 types, MC lines, wait conditions) | Task 8 |
| How-to-Play as 3rd option | Task 7 |
| check-tutorial.js passes | Task 11 |
| Numpad in How-to-Play reference | Task 11 |
| Magnetic rock deflect not possible (engine already correct per main.js line 182) | No code change needed |

**Type consistency:** `spawnScriptedRock(type, angleOverride)` used consistently in Task 6 and Task 8. `hitsCleared` added in Task 2, reset in Task 2, read in Task 8 — consistent. `tutorialMode` added in Task 2, set in Task 6 `setTutorialMode`, read in Task 6 `update()` — consistent. `els.tutEndScreen`, `els.rockEntryScreen` added in Task 9, referenced in Task 8 `tutorial.js` — consistent.

**Placeholder scan:** No TBDs found.
