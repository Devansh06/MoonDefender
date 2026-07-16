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
      missionControl.speak("This is Mission Control.\nWe've picked up a hostile approach vector.\nEarth is not ready. **You are.**");
    },
    waitFor() { return true; },
  },
  // 1: deflect rock 1
  {
    enter() {
      setTutorialWeapons(["deflector"]);
      missionControl.speak("Rock inbound.\n**Tap** toward it — the Deflector fires a push-pulse.\nRedirect it.");
    },
    waitFor() { return true; },
  },
  {
    enter() { spawnScriptedRock("normal", Math.PI, false); },
    waitFor() { return !state.rocks.some(r => !r.cleared) || tutorialClock > 25; },
    leave() { state.rocks = []; },
  },
  // 2: deflect rock 2
  {
    enter() {
      missionControl.speak("Another one. Different angle. Stay sharp.");
    },
    waitFor() { return true; },
  },
  {
    enter() { spawnScriptedRock("normal", 0, false); },
    waitFor() { return !state.rocks.some(r => !r.cleared) || tutorialClock > 25; },
    leave() { state.rocks = []; },
  },
  // 3: magnetic — watch deflector fail
  {
    enter() {
      setTutorialWeapons(["deflector"]);
      missionControl.speak("Magnetic rock inbound.\nTry your **Deflector** — watch what happens.");
    },
    waitFor() { return true; },
  },
  {
    enter() { spawnScriptedRock("magnetic", Math.PI, false); },
    waitFor() { return !state.rocks.some(r => !r.cleared && r.rockType === "magnetic") || tutorialClock > 25; },
    leave() { state.rocks = []; },
  },
  // 4: blaster lesson
  {
    enter() {
      setTutorialWeapons(["blaster"]);
      missionControl.speak("**Deflector bounces off it.**\nSwitch to **Blaster** and destroy it.");
    },
    waitFor() { return true; },
  },
  {
    enter() { spawnScriptedRock("magnetic", Math.PI * 0.9, false); },
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
  // 6: 4 rocks
  {
    enter() {
      setTutorialWeapons(["starnet"]);
      prevStarnetId = state.starnetActivationId;
      missionControl.speak("Four contacts — too many to pick off.\n**Starnet** deploys a full ring shield.\n**Tap Earth** to activate.");
    },
    waitFor() { return true; },
  },
  {
    enter() {
      [Math.PI, 0, Math.PI * 1.08, Math.PI * 0.08].forEach(a => spawnScriptedRock("normal", a, true));
    },
    waitFor() {
      return (state.starnetActivationId > prevStarnetId && state.starnetRingLife <= 0 && !state.rocks.some(r => !r.cleared))
        || tutorialClock > 25;
    },
    leave() { state.rocks = []; },
  },
  // post-starnet info
  {
    enter() {
      missionControl.speak("You start with only **two charges**.\nRefill: every **4 blasts or deflections**.\nUse them wisely.");
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
      enter() {
        missionControl.speak("Normal rock inbound.\nSmall ones go down in **one hit**.\nBigger ones **split into fragments** when hit.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("normal", Math.PI * 0.75, false); },
      waitFor() { return noActiveRock("normal") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
    {
      enter() { spawnScriptedRock("normal", Math.PI * 0.2, false, 3); },
      waitFor() { return noActiveRock("normal") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  comet: [
    {
      enter() {
        missionControl.speak("Comet inbound. **Three times** normal speed.\nFragile: **one hit** drops it.\nWorth **+150 bonus pts**.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("comet", Math.PI * 0.5, false, null, true); },
      waitFor() { return noActiveRock("comet") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  armored: [
    {
      enter() {
        missionControl.speak("Armored rock inbound.\n**Deflector or Blaster** cracks the armor on the first hit.\nThen **Deflect** to redirect, or **Blast again** to destroy it.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("armored", Math.PI * 1.25, false); },
      waitFor() { return noActiveRock("armored") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  magnetic: [
    {
      enter() {
        missionControl.speak("Magnetic rock inbound.\nThat dotted ring is a gravity well.\n**Blast it** or use **Starnet** — Deflectors will not stop the pull.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("magnetic", Math.PI * 1.0, false); },
      waitFor() { return noActiveRock("magnetic") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  healing: [
    {
      enter() {
        missionControl.speak("Healing rock inbound. This one's different.\n**Don't shoot it.**\nUse **Starnet** while it's inside the ring to capture it.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("healing", Math.PI * 0.9, false); },
      waitFor() { return noActiveRock("healing") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  catastrophe: [
    {
      enter() {
        missionControl.speak("Catastrophe rock inbound. Three orbiting companions.\n**Two Blasts or Starnet hits** crack the shell. **One more** ends it.\n**Starnet on uncracked armor bounces back** — you've been warned.");
      },
      waitFor() { return true; },
    },
    {
      enter() { state.bossActive = true; spawnBoss(); },
      waitFor() { return noActiveRock("catastrophe") || tutorialClock > 90; },
      leave() { state.rocks = []; state.bossActive = false; },
    },
  ],
};

function showRockTypesComplete() {
  missionControl.silence();
  setTutorialMode(false);
  pauseNormalSpawning();
  state.rocks = [];
  state.bossActive = false;
  els.rockEntryScreen?.classList.add("show");
}
