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
let tapEarthSaid = false;
let bigRockSeen = false;
let bigRockLastSeen = -Infinity;
let _tutBlasterSide = null; // 'right'|'left', set in blaster-message step so spawn step agrees
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
  state.blasterOffline = false;
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
  state.blasterOffline = true;
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
      missionControl.speak("This is Mission Control.\nWe've picked up an approaching hostile.\nEarth is not ready. **You are.**");
    },
    waitFor() { return true; },
  },
  // 1: deflect rock 1
  {
    enter() {
      setTutorialWeapons(["deflector"]);
      missionControl.speak("Rock inbound.\n**Tap** toward it — the Deflector fires a **push-pulse** from the moon.\nRedirect it.");
    },
    waitFor() { return true; },
  },
  {
    // Spawn from whichever side the moon is approaching so the deflector can reach it
    enter() {
      const moonInNorth = state.moon.y < state.earth.y;
      spawnScriptedRock("normal", moonInNorth ? 0 : Math.PI, false);
    },
    waitFor() {
      const r = state.rocks[0];
      if (!r) return true;
      if (r.deflected && (r.x < 0 || r.x > state.w || r.y < 0 || r.y > state.h)) return true;
      return tutorialClock > 25;
    },
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
    // Same approaching side but diagonal so it's visually "different angle"
    enter() {
      const moonInNorth = state.moon.y < state.earth.y;
      spawnScriptedRock("normal", moonInNorth ? -Math.PI * 0.25 : Math.PI * 1.25, false);
    },
    waitFor() {
      const r = state.rocks[0];
      if (!r) return true;
      if (r.deflected && (r.x < 0 || r.x > state.w || r.y < 0 || r.y > state.h)) return true;
      return tutorialClock > 25;
    },
    leave() { state.rocks = []; },
  },
  // 3: magnetic — watch deflector fail
  {
    enter() {
      setTutorialWeapons(["deflector"]);
      missionControl.speak("**{#c070ff:Magnetic rock}** inbound.\nTry your **Deflector** — watch what happens.");
    },
    waitFor() { return true; },
  },
  {
    // Spawn from approaching moon side so user can actually attempt the deflect
    enter() {
      const moonInNorth = state.moon.y < state.earth.y;
      spawnScriptedRock("magnetic", moonInNorth ? 0 : Math.PI, false);
    },
    waitFor() { return !state.rocks.some(r => !r.cleared && r.rockType === "magnetic") || tutorialClock > 25; },
    leave() { state.rocks = []; },
  },
  // 4: blaster lesson
  {
    enter() {
      missionControl.speak("Deflector **bounces** off it.");
    },
    waitFor() { return true; },
  },
  {
    enter() {
      state.blasterOffline = false;
      setTutorialWeapons(["deflector", "blaster"]); // deflector stays available
      missionControl.speak("**Blaster is now online.**");
    },
    waitFor() { return true; },
  },
  {
    // Determine sides now so MC message and spawn step agree
    enter() {
      const satInNorth = state.satellite.y < state.earth.y;
      _tutBlasterSide = satInNorth ? "right" : "left";
      const normSide   = satInNorth ? "left"  : "right";
      missionControl.speak(`**{#c070ff:Magnetic cluster}** from the ${_tutBlasterSide}! Two rocks on the ${normSide}.\nBlast the **{#c070ff:magnetics}** — Deflect the normals.`);
    },
    waitFor() { return true; },
  },
  {
    enter() {
      const satInNorth = _tutBlasterSide === "right";
      const magAngle  = satInNorth ? 0 : Math.PI;
      const normAngle = satInNorth ? Math.PI : 0;
      spawnScriptedRock("magnetic", magAngle, false);
      spawnScriptedRock("magnetic", magAngle + (satInNorth ? 0.35 : -0.35), false);
      spawnScriptedRock("normal",   normAngle, false);
      spawnScriptedRock("normal",   normAngle + (satInNorth ? -0.35 : 0.35), false);
      _tutBlasterSide = null;
    },
    waitFor() {
      return !state.rocks.some(r => !r.cleared) || tutorialClock > 35;
    },
    leave() { state.rocks = []; },
  },
  {
    enter() {
      missionControl.speak("Blaster has a **1.5s cooldown**.\nIt glows when active.");
    },
    waitFor() { return true; },
  },
  // 5: Starnet intro — all weapons remain available
  {
    enter() {
      setTutorialWeapons(["deflector", "blaster", "starnet"]);
      missionControl.speak("**{#72e6ff:Starnet}** is now available.");
    },
    waitFor() { return tutorialClock >= 2.5; },
  },
  // 6: 4 rocks
  {
    enter() {
      setTutorialWeapons(["deflector", "blaster", "starnet"]);
      prevStarnetId = state.starnetActivationId;
      missionControl.speak("Four contacts — too many to pick off.\n**{#72e6ff:Starnet}** deploys a full ring shield.\n**Tap Earth when the rocks are close.**");
    },
    waitFor() { return true; },
  },
  {
    enter() {
      [Math.PI * 0.75, Math.PI * 1.25, Math.PI * 0.25, Math.PI * 1.75].forEach(a => spawnScriptedRock("normal", a, false, null, true));
    },
    waitFor() {
      if (tutorialClock >= 3 && !tapEarthSaid) {
        tapEarthSaid = true;
        missionControl.speak("Tap on Earth, now.");
      }
      return (state.starnetActivationId > prevStarnetId && state.starnetRingLife <= 0 && !state.rocks.some(r => !r.cleared))
        || tutorialClock > 25;
    },
    leave() { tapEarthSaid = false; state.rocks = []; },
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
  state.blasterOffline = false;
  pauseNormalSpawning();
  els.tutEndScreen?.classList.add("show");
}

export function tutEndStartMission() {
  els.tutEndScreen?.classList.remove("show");
  setTutorialMode(false);
  resetGame();
}

export function tutEndGoToRocks() {
  els.tutEndScreen?.classList.remove("show");
  setTutorialMode(false);
  state.running = false;
  state.rocks = [];
  state.projectiles = [];
  state.particles = [];
  els.rockEntryScreen.classList.add("show");
}

export function tutEndGoToHowToPlay() {
  els.tutEndScreen?.classList.remove("show");
  setTutorialMode(false);
  state.running = false;
  state.rocks = [];
  state.projectiles = [];
  state.particles = [];
  els.tutorialOverlay.classList.add("show");
}

export function tutEndBackToTutorials() {
  els.tutEndScreen?.classList.remove("show");
  setTutorialMode(false);
  state.running = false;
  state.rocks = [];
  state.projectiles = [];
  state.particles = [];
  els.overlay.classList.add("show");
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
        missionControl.speak("**{#9eb3c6:Normal rock}** inbound.\nSmall ones go down in **one hit**.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("normal", Math.PI * 0.75, false, null, true); },
      waitFor() { return noActiveRock("normal") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
    {
      enter() {
        missionControl.speak("Bigger ones **split into fragments** when hit by Blaster.");
      },
      waitFor() { return true; },
    },
    {
      enter() {
        bigRockSeen = false;
        bigRockLastSeen = -Infinity;
        const fromRight = state.satellite.x > state.earth.x;
        spawnScriptedRock("normal", fromRight ? Math.PI * 0.2 : Math.PI * 0.8, false, 3, true);
      },
      waitFor() {
        const n = state.rocks.filter(r => r.rockType === "normal").length;
        if (n > 0) { bigRockSeen = true; bigRockLastSeen = tutorialClock; }
        return (bigRockSeen && n === 0 && tutorialClock - bigRockLastSeen > 0.15) || tutorialClock > ROCK_TYPE_TIMEOUT;
      },
      leave() { bigRockSeen = false; bigRockLastSeen = -Infinity; state.rocks = []; },
    },
  ],
  comet: [
    {
      enter() {
        missionControl.speak("**{#88eeff:Comet}** inbound. **Three times** normal speed.\nFragile: **one hit** drops it.\nWorth **+150 bonus pts**.");
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
        missionControl.speak("**{#c8c8b4:Armored rock}** inbound.\n**Deflector or Blaster** cracks the armor on the first hit.\nThen **Deflect** to redirect, or **Blast again** to destroy it.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("armored", Math.PI * 1.25, false, null, true); },
      waitFor() { return noActiveRock("armored") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  magnetic: [
    {
      enter() {
        missionControl.speak("**{#c070ff:Magnetic rock}** inbound.\nThat dotted ring is a gravity well.\n**Blast it** or use **{#72e6ff:Starnet}** — Deflectors will not stop the pull.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("magnetic", Math.PI * 1.0, false, null, true); },
      waitFor() { return noActiveRock("magnetic") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  healing: [
    {
      enter() {
        missionControl.speak("**{#44ff88:Healing rock}** inbound. This one's different.\n**Don't shoot it.**\nUse **{#72e6ff:Starnet}** while it's inside the ring to capture it.");
      },
      waitFor() { return true; },
    },
    {
      enter() { spawnScriptedRock("healing", Math.PI * 0.9, false, null, true); },
      waitFor() { return noActiveRock("healing") || tutorialClock > ROCK_TYPE_TIMEOUT; },
      leave() { state.rocks = []; },
    },
  ],
  catastrophe: [
    {
      enter() {
        missionControl.speak("**{#cc44ff:Catastrophe rock}** inbound. Three orbiting companions.\n**Two Blasts or {#72e6ff:Starnet} hits** crack the shell. **One more** ends it.\n**{#72e6ff:Starnet} on uncracked armor bounces back** — you've been warned.");
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
