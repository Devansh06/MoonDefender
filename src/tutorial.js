import { state, els } from "./state.js";
import { missionControl } from "./mission-control.js";
import { lockWeapon, selectWeapon, unlockWeapon } from "./hud.js";
import { pauseNormalSpawning, setTutorialMode, spawnScriptedRock, resetGame } from "./main.js";
import { spawnBoss } from "./rocks.js";

let activeSequence = null;
let currentStep = -1;
let tutorialClock = 0;
let prevHitsCleared = 0;
let prevStarnetId = 0;
const TUTORIAL_TIMEOUT = 10;

function setTutorialWeapons(enabled) {
  ["deflector", "blaster", "starnet"].forEach(name => {
    if (enabled.includes(name)) unlockWeapon(name);
    else lockWeapon(name);
  });
  if (!enabled.includes(state.selectedWeapon)) {
    selectWeapon(enabled.includes("deflector") ? "deflector" : enabled[0] || "deflector");
  }
}

export function isInActiveTutorial() {
  return activeSequence !== null && currentStep >= 0;
}

export function exitActiveTutorial() {
  if (!isInActiveTutorial()) return;
  missionControl.silence();
  activeSequence = null;
  currentStep = -1;
  setTutorialMode(false);
  state.running = false;
  state.bossActive = false;
  state.rocks = [];
  state.projectiles = [];
  state.particles = [];
  state.starnetEffects = [];
  els.tutorialSelectOverlay.classList.remove("show");
  els.tutEndScreen?.classList.remove("show");
  els.rockEntryScreen?.classList.remove("show");
  els.startBtn.textContent = "Start Mission";
  els.overlay.classList.add("show");
}

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
  if (missionControl.isSpeaking) return;
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
  els.startBtn.textContent = "Start Mission";
  els.pauseBtn.classList.remove("is-paused");
  setTutorialMode(true);
  pauseNormalSpawning();
}

// ─── COMBAT TUTORIAL ─────────────────────────────────────────────────────────

export function startCombat() {
  initTutorialState();
  setTutorialWeapons(["deflector"]);
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
      missionControl.speak("This is Mission Control. We've picked up a hostile approach vector. Earth is not ready. **You are.**");
    },
    waitFor() { return tutorialClock >= 4; },
  },
  // 1: deflect rock 1 — rock hits earth if missed
  {
    enter() {
      setTutorialWeapons(["deflector"]);
      spawnScriptedRock("normal", Math.PI, false);
      missionControl.speak("Rock inbound. **Tap** toward it — the Deflector fires a push-pulse. Redirect it.");
    },
    waitFor() { return !state.rocks.some(r => !r.cleared) || tutorialClock > 25; },
    leave() { state.rocks = []; },
  },
  // 2: deflect rock 2 — rock hits earth if missed
  {
    enter() {
      setTutorialWeapons(["deflector"]);
      spawnScriptedRock("normal", 0, false);
      missionControl.speak("Another one. Different angle. Stay sharp.");
    },
    waitFor() { return !state.rocks.some(r => !r.cleared) || tutorialClock > 25; },
    leave() { state.rocks = []; },
  },
  // 3: magnetic — deflector only, watch it fail, rock hits earth
  {
    enter() {
      setTutorialWeapons(["deflector"]);
      spawnScriptedRock("magnetic", Math.PI, false);
      missionControl.speak("Magnetic rock. Try your **Deflector** — watch what happens.");
    },
    waitFor() { return !state.rocks.some(r => !r.cleared && r.rockType === "magnetic") || tutorialClock > 25; },
    leave() { state.rocks = []; },
  },
  // 4: blaster lesson — new magnetic rock, destroy it
  {
    enter() {
      setTutorialWeapons(["blaster"]);
      spawnScriptedRock("magnetic", Math.PI * 0.9, false);
      missionControl.speak("**Deflector bounces off it.** Switch to **Blaster** and destroy it.");
    },
    waitFor() {
      return !state.rocks.some(r => !r.cleared && r.rockType === "magnetic") || tutorialClock > 25;
    },
    leave() { state.rocks = state.rocks.filter(r => r.rockType !== "magnetic"); },
  },
  // 5: Starnet intro
  {
    enter() {
      setTutorialWeapons(["starnet"]);
      missionControl.speak("**Starnet** is now available.");
    },
    waitFor() { return tutorialClock >= 2.5; },
  },
  // 6: 4 rocks from spread angles
  {
    enter() {
      setTutorialWeapons(["starnet"]);
      prevStarnetId = state.starnetActivationId;
      [Math.PI, 0, Math.PI * 1.08, Math.PI * 0.08].forEach(a => spawnScriptedRock("normal", a, true));
      missionControl.speak("Four contacts — too many to pick off. **Starnet** deploys a full ring shield. Activate it.");
    },
    waitFor() {
      return (state.starnetActivationId > prevStarnetId && state.starnetRingLife <= 0 && !state.rocks.some(r => !r.cleared))
        || tutorialClock > 25;
    },
    leave() { state.rocks = []; },
  },
  // 6: post-starnet info
  {
    enter() {
      missionControl.speak("You start with only **two charges**. Refill: **5 blasts or deflections**. Use them wisely.");
    },
    waitFor() { return tutorialClock >= 4; },
  },
  // ✓ end
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
  els.tutEndScreen?.classList.add("show");
}

export function tutEndStartMission() {
  els.tutEndScreen?.classList.remove("show");
  setTutorialMode(false);
  resetGame();
}

export function tutEndBackToTutorials() {
  els.tutEndScreen?.classList.remove("show");
  setTutorialMode(false);
  state.running = false;
  state.rocks = [];
  state.projectiles = [];
  state.particles = [];
  els.tutorialSelectOverlay.classList.add("show");
}

// ─── ROCK TYPES TUTORIAL ─────────────────────────────────────────────────────

const ROCK_TYPE_ORDER = ["normal", "comet", "armored", "magnetic", "healing", "catastrophe"];
const ROCK_TYPE_TIMEOUT = 25;

export function startRockTypes(entryType) {
  initTutorialState();
  setTutorialWeapons(["deflector", "blaster", "starnet"]);
  selectWeapon("deflector");
  els.tutorialSelectOverlay.classList.remove("show");
  els.rockEntryScreen?.classList.remove("show");

  activeSequence = entryType === "all"
    ? buildRockTypeSequence(ROCK_TYPE_ORDER)
    : buildRockTypeSequence([entryType || "normal"]);
  currentStep   = -1;
  tutorialClock = 0;
  advanceStep();
}

function buildRockTypeSequence(types) {
  return types.flatMap(type => ROCK_TYPE_STEPS[type] || []);
}

function noActiveRock(type) {
  const rockType = type === "catastrophe" ? "boss" : type;
  return !state.rocks.some(r => !r.cleared && r.rockType === rockType);
}

const ROCK_TYPE_STEPS = {
  normal: [
    {
      enter() { missionControl.speak("Normal Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking || tutorialClock > 6; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("normal", Math.PI * 0.75, true);
        missionControl.speak("Standard debris. Small ones go down in one hit. Level 3 to 5 splits on impact — one hit becomes two rocks.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > TUTORIAL_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  comet: [
    {
      enter() { missionControl.speak("Comet inbound."); },
      waitFor() { return !missionControl.isSpeaking || tutorialClock > 6; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("comet", Math.PI * 0.5, true);
        missionControl.speak("Three times normal speed. Fragile — one hit drops it. Worth 150 bonus points.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > TUTORIAL_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  armored: [
    {
      enter() { missionControl.speak("Armored Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking || tutorialClock > 6; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("armored", Math.PI * 1.25, true);
        missionControl.speak("There's a sequence. Learn it or waste shots. Two deflector hits redirect uncracked armor. Or blast to crack it, then one more deflect. Two blasts destroy it entirely.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > TUTORIAL_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  magnetic: [
    {
      enter() { missionControl.speak("Magnetic Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking || tutorialClock > 6; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("magnetic", Math.PI * 1.0, true);
        missionControl.speak("That dotted ring is a gravity well. Pulling other rocks toward it. You cannot deflect it — blast it or use Starnet. Kill the source — pull stops instantly.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > TUTORIAL_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  healing: [
    {
      enter() { missionControl.speak("Healing Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking || tutorialClock > 6; },
    },
    {
      enter() {
        spawnScriptedRock("healing", Math.PI * 0.9, true);
        missionControl.speak("This one's different. Don't shoot it. Figure out how to bring it in safely.");
      },
      waitFor() {
        return !state.rocks.some(r => !r.cleared && r.rockType === "healing") || tutorialClock > TUTORIAL_TIMEOUT;
      },
      leave() { state.rocks = []; },
    },
  ],
  catastrophe: [
    {
      enter() { missionControl.speak("Catastrophe Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking || tutorialClock > 6; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        state.bossActive = true;
        spawnBoss();
        missionControl.speak("Boss-class. Three orbiting companions. Crack the shell first — two hits. One more ends it. Starnet on uncracked armor bounces back. You've been warned.");
      },
      waitFor() {
        return !state.rocks.some(r => !r.cleared && r.rockType === "boss") || tutorialClock > TUTORIAL_TIMEOUT;
      },
      leave() { state.rocks = []; state.bossActive = false; },
    },
  ],
};

Object.assign(ROCK_TYPE_STEPS, {
  normal: [
    {
      enter() {
        spawnScriptedRock("normal", Math.PI * 0.75, false);
        missionControl.speak("Normal rock inbound. Small ones go down in **one hit**. Bigger ones **split into fragments** when hit.");
      },
      waitFor() { return noActiveRock("normal") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  comet: [
    {
      enter() {
        spawnScriptedRock("comet", Math.PI * 0.5, false);
        missionControl.speak("Comet inbound. **Three times** normal speed. Fragile: **one hit** drops it. Worth **+150 bonus pts**.");
      },
      waitFor() { return noActiveRock("comet") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  armored: [
    {
      enter() {
        spawnScriptedRock("armored", Math.PI * 1.25, false);
        missionControl.speak("Armored rock inbound. **Two Deflector hits** redirect uncracked armor. Or **Blast to crack**, then **Deflect**. **Two Blasts** destroy it entirely.");
      },
      waitFor() { return noActiveRock("armored") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  magnetic: [
    {
      enter() {
        spawnScriptedRock("magnetic", Math.PI * 1.0, false);
        missionControl.speak("Magnetic rock inbound. That dotted ring is a gravity well. **Blast it** or use **Starnet** — Deflectors will not stop the pull.");
      },
      waitFor() { return noActiveRock("magnetic") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  healing: [
    {
      enter() {
        spawnScriptedRock("healing", Math.PI * 0.9, false);
        missionControl.speak("Healing rock inbound. This one's different. **Don't shoot it.** Use **Starnet** while it's inside the ring to capture it.");
      },
      waitFor() { return noActiveRock("healing") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  catastrophe: [
    {
      enter() {
        state.bossActive = true;
        spawnBoss();
        missionControl.speak("Catastrophe rock inbound. Three orbiting companions. **Two Blasts or Starnet hits** crack the shell. **One more** ends it. **Starnet on uncracked armor bounces back** — you've been warned.");
      },
      waitFor() { return noActiveRock("catastrophe") || tutorialClock > 90; },
      leave() { state.rocks = []; state.bossActive = false; },
    },
  ],
});

function showRockTypesComplete() {
  missionControl.silence();
  setTutorialMode(false);
  pauseNormalSpawning();
  state.rocks = [];
  state.bossActive = false;
  els.rockEntryScreen?.classList.add("show");
}
