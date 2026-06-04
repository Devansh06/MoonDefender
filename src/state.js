import { LEVEL_TIME, AUTO_ATTACK_MODES } from "./constants.js";

export const els = {
  level:             document.getElementById("level"),
  timer:             document.getElementById("timer"),
  score:             document.getElementById("score"),
  lostCountry:       document.getElementById("lostCountry"),
  exitBtn:           document.getElementById("exitBtn"),
  pauseBtn:          document.getElementById("pauseBtn"),
  deflectorBtn:      document.getElementById("deflectorBtn"),
  blasterBtn:        document.getElementById("blasterBtn"),
  starnetBtn:        document.getElementById("starnetBtn"),
  friendlyFireBtn:   document.getElementById("friendlyFireBtn"),
  friendlyFireState: document.getElementById("friendlyFireState"),
  blasterCooldown:   document.getElementById("blasterCooldown"),
  starnetCount:      document.getElementById("starnetCount"),
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
  elApiKeyInput:   document.getElementById("elApiKeyInput"),
  elApiKeySaveBtn: document.getElementById("elApiKeySaveBtn"),
  musicMuteBtn:    document.getElementById("musicMuteBtn"),
  musicMuteLabel:  document.getElementById("musicMuteLabel"),
  speedBtn:          document.getElementById("speedBtn"),
  fullscreenBtn:     document.getElementById("fullscreenBtn"),
  fullscreenHudBtn:  document.getElementById("fullscreenHudBtn"),
  autoModeBtn:       document.getElementById("autoModeBtn"),
  autoModeLabel:     document.getElementById("autoModeLabel"),
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
  deflectionsCleared: 0, hitsCleared: 0, starnet: 2,
  blasterCooldown: 0, earthSpin: 0, shake: 0,
  // collections
  projectiles: [], rocks: [], particles: [],
  lasers: [], starnetEffects: [],
  // earth
  earthTextureReady: false, earthTextureData: null,
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
  // tutorial
  tutorialMode: false,
  // auto-attack
  autoAttackMode: AUTO_ATTACK_MODES[0],
  // preferences (persist across resets)
  satelliteOffset: Math.PI,
  gameSpeed: 1,
  paused: false,
};
