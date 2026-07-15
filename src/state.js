import { LEVEL_TIME, AUTO_ATTACK_MODES } from "./constants.js";

export const els = {
  level:             document.getElementById("level"),
  timer:             document.getElementById("timer"),
  score:             document.getElementById("score"),
  exitBtn:           document.getElementById("exitBtn"),
  pauseBtn:          document.getElementById("pauseBtn"),
  deflectorBtn:      document.getElementById("deflectorBtn"),
  blasterBtn:        document.getElementById("blasterBtn"),
  starnetBtn:        document.getElementById("starnetBtn"),
  friendlyFireBtn:   document.getElementById("friendlyFireBtn"),
  friendlyFireState: document.getElementById("friendlyFireState"),
  overlay:           document.getElementById("overlay"),
  startBtn:          document.getElementById("startBtn"),
  tutorialBtn:       document.getElementById("tutorialBtn"),
  tutorialOverlay:   document.getElementById("tutorialOverlay"),
  tutCloseBtn:       document.getElementById("tutCloseBtn"),
  tutBackBtn:        document.getElementById("tutBackBtn"),
  tutPlayBtn:        document.getElementById("tutPlayBtn"),
  tutorialSelectOverlay: document.getElementById("tutorialSelectOverlay"),
  tutSelCloseBtn:        document.getElementById("tutSelCloseBtn"),
  tutCombatBtn:          document.getElementById("tutCombatBtn"),
  tutRocksBtn:           document.getElementById("tutRocksBtn"),
  tutHowToPlayBtn:       document.getElementById("tutHowToPlayBtn"),
  tutSelBackBtn:         document.getElementById("tutSelBackBtn"),
  tutEndScreen:        document.getElementById("tutEndScreen"),
  tutEndStartBtn:      document.getElementById("tutEndStartBtn"),
  tutEndBackBtn:       document.getElementById("tutEndBackBtn"),
  rockEntryScreen:     document.getElementById("rockEntryScreen"),
  rockEntryCloseBtn:   document.getElementById("rockEntryCloseBtn"),
  rockEntryBackBtn:    document.getElementById("rockEntryBackBtn"),
  fullscreenBtn:     document.getElementById("fullscreenBtn"),
  fullscreenHudBtn:  document.getElementById("fullscreenHudBtn"),
  autoModeBtn:       document.getElementById("autoModeBtn"),
  autoModeLabel:     document.getElementById("autoModeLabel"),
  targetBtn:         document.getElementById("targetBtn"),
  targetLabel:       document.getElementById("targetLabel"),
  panelCloseBtn:     document.getElementById("panelCloseBtn"),
  prefsBtn:          document.getElementById("prefsBtn"),
  prefsOverlay:      document.getElementById("prefsOverlay"),
  prefsCloseBtn:     document.getElementById("prefsCloseBtn"),
  prefsBackBtn:      document.getElementById("prefsBackBtn"),
  mcBubble:          document.getElementById("mcBubble"),
  mcText:            document.getElementById("mcText"),
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
  hitsCleared: 0, starnet: 2,
  blasterCooldown: 0, earthSpin: 0, shake: 0,
  // collections
  projectiles: [], rocks: [], particles: [],
  lasers: [], starnetEffects: [], floatingTexts: [],
  // earth
  earthTextureReady: false, earthTextureData: null,
  // starnet
  starnetRingLife: 0, starnetActivationId: 0,
  moonLaserClock: 0,
  // damage tracking
  nextDamageStarnet: 10,
  burnSites: [],
  impactLog: [],
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
  // tutorial
  tutorialMode: false,
  // player identity
  playerName: "",
  playerIP: "",
  // auto-attack
  autoAttackMode: AUTO_ATTACK_MODES[0],
  // accuracy tracking
  totalShots: 0, missedShots: 0,
  rockStats: {
    normal:   { destroyed: 0, deflected: 0 },
    comet:    { destroyed: 0, deflected: 0 },
    armored:  { destroyed: 0, deflected: 0 },
    magnetic: { destroyed: 0, deflected: 0 },
    healing:  { captured: 0 },
    boss:     { destroyed: 0 },
  },
  // arena bounds (set by resize)
  arenaLeft: 0, arenaRight: 0,
  // hazard schedule (set by buildHazardSchedule at game start)
  hazardSchedule: [],
  // preferences (persist across resets)
  satelliteOffset: Math.PI,
  paused: false,
};
