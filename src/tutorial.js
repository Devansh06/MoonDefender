import { state, els } from "./state.js";
import { missionControl } from "./mission-control.js";
import { selectWeapon, unlockWeapon } from "./hud.js";
import { pauseNormalSpawning, setTutorialMode, spawnScriptedRock, resetGame } from "./main.js";
import { spawnBoss } from "./rocks.js";

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
  els.pauseBtn.classList.remove("is-paused");
  setTutorialMode(true);
  pauseNormalSpawning();
}

// ─── COMBAT TUTORIAL ─────────────────────────────────────────────────────────

export function startCombat() {
  initTutorialState();
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
      missionControl.speak("This is Mission Control. We've picked up a hostile approach vector. Earth is not ready. You are.");
    },
    waitFor() { return tutorialClock >= 4; },
  },
  // 1: deflect rock 1
  {
    enter() {
      prevHitsCleared = state.hitsCleared;
      spawnScriptedRock("normal", Math.PI * 0.75, true);
      missionControl.speak("Rock inbound. Tap toward it — the Deflector fires a push-pulse. Redirect it.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared; },
  },
  // 2: deflect rock 2
  {
    enter() {
      prevHitsCleared = state.hitsCleared;
      spawnScriptedRock("normal", Math.PI * 0.25, true);
      missionControl.speak("Another one. Different angle. Stay sharp.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared; },
  },
  // 3: unlock blaster, spawn magnetic
  {
    enter() {
      unlockWeapon("blaster");
      spawnScriptedRock("magnetic", Math.PI * 1.5, true);
      missionControl.speak("Magnetic contact. Deflecting it won't kill the pull — it'll keep dragging others toward it. Switch to Blaster, key 2. Destroy it.");
    },
    waitFor() { return state.selectedWeapon === "blaster" || tutorialClock > 30; },
  },
  // 4: fire blaster — 3rd hit → starnet unlocks
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
  // 4b: pause — Starnet available
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
      [Math.PI * 0.1, Math.PI * 0.6, Math.PI * 1.1, Math.PI * 1.7].forEach(a => spawnScriptedRock("normal", a, true));
      missionControl.speak("Four contacts — too many to pick off. Starnet deploys a full ring shield. Space bar. Use it.");
    },
    waitFor() { return state.starnetActivationId > prevStarnetId; },
  },
  // 6: post-starnet info
  {
    enter() {
      missionControl.speak("You start with only two charges. Refill them with 3 blasts or deflections. Use them wisely.");
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

export function startRockTypes(entryType) {
  initTutorialState();
  selectWeapon("deflector");
  unlockWeapon("deflector");
  unlockWeapon("blaster");
  unlockWeapon("starnet");
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

const ROCK_TYPE_STEPS = {
  normal: [{
    enter() {
      prevHitsCleared = state.hitsCleared;
      spawnScriptedRock("normal", Math.PI * 0.75, true);
      missionControl.speak("Standard debris. Small ones go down in one hit. Level 3 to 5 splits on impact — one hit becomes two rocks.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 30; },
  }],
  comet: [{
    enter() {
      prevHitsCleared = state.hitsCleared;
      spawnScriptedRock("comet", Math.PI * 0.5, true);
      missionControl.speak("Three times normal speed. Fragile — one hit drops it. Worth 150 bonus points.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 30; },
  }],
  armored: [{
    enter() {
      prevHitsCleared = state.hitsCleared;
      spawnScriptedRock("armored", Math.PI * 1.25, true);
      missionControl.speak("There's a sequence. Learn it or waste shots. Two deflector hits redirect uncracked armor. Or blast to crack it, then one more deflect. Two blasts destroy it entirely.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 40; },
  }],
  magnetic: [{
    enter() {
      prevHitsCleared = state.hitsCleared;
      spawnScriptedRock("magnetic", Math.PI * 1.0, true);
      missionControl.speak("That dotted ring is a gravity well. Pulling other rocks toward it. You cannot deflect it — blast it or use Starnet. Kill the source — pull stops instantly.");
    },
    waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 35; },
  }],
  healing: [{
    enter() {
      spawnScriptedRock("healing", Math.PI * 0.9, true);
      missionControl.speak("This one's different. Don't shoot it. Figure out how to bring it in safely.");
    },
    waitFor() {
      return !state.rocks.some(r => !r.cleared && r.rockType === "healing") || tutorialClock > 20;
    },
  }],
  catastrophe: [{
    enter() {
      prevHitsCleared = state.hitsCleared;
      state.bossActive = true;
      spawnBoss();
      missionControl.speak("Boss-class. Three orbiting companions. Crack the shell first — two hits. One more ends it. Starnet on uncracked armor bounces back. You've been warned.");
    },
    waitFor() {
      return !state.rocks.some(r => !r.cleared && r.rockType === "boss") || tutorialClock > 60;
    },
  }],
};

function showRockTypesComplete() {
  missionControl.silence();
  setTutorialMode(false);
  pauseNormalSpawning();
  state.rocks = [];
  state.bossActive = false;
  els.rockEntryScreen?.classList.add("show");
}
