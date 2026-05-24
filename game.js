const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const shell = document.querySelector(".game-shell");

const els = {
  level: document.getElementById("level"),
  timer: document.getElementById("timer"),
  score: document.getElementById("score"),
  lostCountry: document.getElementById("lostCountry"),
  damageBar: document.getElementById("damageBar"),
  deflectorBtn: document.getElementById("deflectorBtn"),
  blasterBtn: document.getElementById("blasterBtn"),
  starnetBtn: document.getElementById("starnetBtn"),
  friendlyFireBtn: document.getElementById("friendlyFireBtn"),
  friendlyFireState: document.getElementById("friendlyFireState"),
  blasterCooldown: document.getElementById("blasterCooldown"),
  starnetCount: document.getElementById("starnetCount"),
  overlay: document.getElementById("overlay"),
  startBtn: document.getElementById("startBtn"),
  tutorialBtn: document.getElementById("tutorialBtn"),
  tutorialOverlay: document.getElementById("tutorialOverlay"),
  tutCloseBtn: document.getElementById("tutCloseBtn"),
  tutBackBtn: document.getElementById("tutBackBtn"),
  tutPlayBtn: document.getElementById("tutPlayBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  fullscreenHudBtn: document.getElementById("fullscreenHudBtn"),
  autoModeBtn: document.getElementById("autoModeBtn"),
  autoModeLabel: document.getElementById("autoModeLabel"),
};

const TAU = Math.PI * 2;
const G = 2600000;
const EARTH_MASS = 1;
const MOON_MASS = 1 / 6;
const LEVEL_TIME = 60;
const TOTAL_LEVELS = 10;
const BOSS_LEVELS = new Set([5, 10]);
const BLASTER_REFILL = 1.5;
const PHYSICS_SUBSTEPS = 3;
const ROCK_DAMAGE = [0, 3, 7, 15, 25, 35];
const HAZARD_SCHEDULE = [null, "meteor", "solar", "moon", null, "gravity", "meteor", "moon", "solar", null];
const BOSS_HP_BASE = 5;
const MAGNETIC_PULL_RADIUS = 220;
const MAGNETIC_PULL_STRENGTH = 38;
const AUTO_ATTACK_MODES = ["auto", "special", "closest", "damage", "fastest"];
const AUTO_ATTACK_LABELS = { auto: "Auto", special: "Special", closest: "Closest", damage: "Danger", fastest: "Fastest" };
const EARTH_TEXTURE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const positiveMod = (value, size) => ((value % size) + size) % size;
const norm = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

let w = 0;
let h = 0;
let dpr = 1;
let earth = {};
let moon = {};
let satellite = {};
let stars = [];
let lastTime = 0;
let running = false;
let selectedWeapon = "deflector";
let level = 1;
let levelClock = LEVEL_TIME;
let spawnClock = 0;
let damage = 0;
let score = 0;
let deflectionsCleared = 0;
let starnet = 2;
let blasterCooldown = 0;
let earthSpin = 0;
let shake = 0;
let projectiles = [];
let rocks = [];
let particles = [];
let lasers = [];
let starnetEffects = [];
let moonCraters = [];
let earthTextureReady = false;
let starnetRingLife = 0;
let starnetActivationId = 0;
let nextDamageStarnet = 10;
let lostCountry = "None";
let burnSites = [];
let lostCountries = new Set();
let earthTextureData = null;
let friendlyFire = false;

let moonPulse = 0;
let moonShieldLife = 0;
let hazardEvent = null;
let gravityMultiplier = 1;
let moonSpeedMultiplier = 1;
let spawnRateMultiplier = 1;
let blasterDisabled = false;
let bossActive = false;
let hazardBanner = null;
let autoAttackMode = "auto";
let moonLaserClock = 0;
let autoAttackMode = "auto";
let moonLaserClock = 0;

const earthFrameCanvas = document.createElement("canvas");
const earthFrameCtx = earthFrameCanvas.getContext("2d", { willReadFrequently: true });

const impactMemory = [];
const earthTexture = new Image();
earthTexture.crossOrigin = "anonymous";
earthTexture.onload = () => {
  earthTextureReady = true;
  cacheEarthTexture();
};
earthTexture.onerror = () => {
  earthTextureReady = false;
};
earthTexture.src = EARTH_TEXTURE_URL;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const shortSide = Math.min(w, h);
  earth = {
    x: w * 0.5,
    y: h * 0.52,
    r: clamp(shortSide * 0.21, 96, 190),
  };
  moon = {
    orbit: earth.r * 1.82,
    r: Math.max(13, earth.r * 0.19),
    angle: -Math.PI / 2,
    speed: 0.42,
    x: 0,
    y: 0,
  };
  satellite = {
    orbit: starnetRange() + Math.max(18, earth.r * 0.12),
    r: Math.max(8, earth.r * 0.055),
    angle: moon.angle + Math.PI,
    x: 0,
    y: 0,
  };
  moonCraters = Array.from({ length: 5 }, (_, i) => ({
    x: Math.cos(i * 1.8) * moon.r * 0.38,
    y: Math.sin(i * 2.1) * moon.r * 0.36,
    r: moon.r * rand(0.08, 0.15),
  }));
  stars = Array.from({ length: Math.floor((w * h) / 9000) }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: rand(0.4, 1.6),
    a: rand(0.3, 0.95),
  }));
}

function resetGame() {
  level = 1;
  levelClock = LEVEL_TIME;
  spawnClock = 1.1;
  damage = 0;
  score = 0;
  deflectionsCleared = 0;
  starnet = 2;
  blasterCooldown = 0;
  selectedWeapon = "deflector";
  earthSpin = 0;
  shake = 0;
  projectiles = [];
  rocks = [];
  particles = [];
  lasers = [];
  starnetEffects = [];
  starnetRingLife = 0;
  starnetActivationId = 0;
  nextDamageStarnet = 10;
  lostCountry = "None";
  burnSites = [];
  lostCountries = new Set();
  friendlyFire = false;
  impactMemory.length = 0;
  moonPulse = 0;
  moonShieldLife = 0;
  hazardEvent = null;
  gravityMultiplier = 1;
  moonSpeedMultiplier = 1;
  spawnRateMultiplier = 1;
  blasterDisabled = false;
  bossActive = false;
  hazardBanner = null;
  moonLaserClock = 0;
  autoAttackMode = "auto";
  moonLaserClock = 0;
  running = true;
  selectWeapon("deflector");
  els.tutorialOverlay.classList.remove("show");
  els.overlay.classList.remove("show");
  for (let i = 0; i < 3; i += 1) spawnRock();
}

function updateMoon(dt) {
  moon.angle += moon.speed * moonSpeedMultiplier * dt;
  moon.x = earth.x + Math.cos(moon.angle) * moon.orbit;
  moon.y = earth.y + Math.sin(moon.angle) * moon.orbit;
  satellite.orbit = starnetRange() + Math.max(18, earth.r * 0.12);
  satellite.angle = moon.angle + Math.PI;
  satellite.x = earth.x + Math.cos(satellite.angle) * satellite.orbit;
  satellite.y = earth.y + Math.sin(satellite.angle) * satellite.orbit;
}

function cacheEarthTexture() {
  try {
    const tex = document.createElement("canvas");
    tex.width = 1024;
    tex.height = 512;
    const texCtx = tex.getContext("2d", { willReadFrequently: true });
    texCtx.drawImage(earthTexture, 0, 0, tex.width, tex.height);
    earthTextureData = {
      width: tex.width,
      height: tex.height,
      data: texCtx.getImageData(0, 0, tex.width, tex.height).data,
    };
  } catch (error) {
    earthTextureData = null;
  }
}

function gravityAt(pos) {
  const bodies = [
    { x: earth.x, y: earth.y, mass: EARTH_MASS },
    { x: moon.x, y: moon.y, mass: MOON_MASS },
  ];
  let ax = 0;
  let ay = 0;
  for (const body of bodies) {
    const dx = body.x - pos.x;
    const dy = body.y - pos.y;
    const r2 = Math.max(900, dx * dx + dy * dy);
    const invR = 1 / Math.sqrt(r2);
    const force = (G * gravityMultiplier * body.mass) / r2;
    ax += dx * invR * force;
    ay += dy * invR * force;
  }
  return { x: ax, y: ay };
}

function integrateRock(rock, dt) {
  const step = dt / PHYSICS_SUBSTEPS;
  for (let i = 0; i < PHYSICS_SUBSTEPS; i += 1) {
    const a = gravityAt(rock);
    rock.vx += a.x * step;
    rock.vy += a.y * step;
    if (rock.earthSeeking) {
      const toward = norm(earth.x - rock.x, earth.y - rock.y);
      const seekForce = rock.rockType === "boss" ? 10 : 42;
      rock.vx += toward.x * seekForce * step;
      rock.vy += toward.y * seekForce * step;
    }
    rock.x += rock.vx * step;
    rock.y += rock.vy * step;
    rock.vx *= 0.999;
    rock.vy *= 0.999;
  }
}

function starnetRange() {
  return earth.r + (moon.orbit - earth.r) * 0.5;
}

function deflectionRange() {
  return moon.orbit * 2;
}

function chooseRockType(rockLevel) {
  const r = Math.random();
  if (level >= 3 && r < 0.07) return "healing";
  if (level >= 2 && r < 0.17) return "comet";
  const activeArmored = rocks.filter(rock => !rock.cleared && rock.rockType === "armored").length;
  if (level >= 3 && activeArmored === 0 && r < 0.28) return "armored";
  if (level >= 4 && r < 0.38) return "magnetic";
  return "normal";
}

function spawnRock(forcedLevel, forcedType) {
  const maxRockLevel = Math.min(Math.ceil(level * 0.55), 5);
  const rockLevel = forcedLevel || clamp(Math.ceil(rand(0, maxRockLevel + 0.9)), 1, maxRockLevel);
  const rockType = forcedType || chooseRockType(rockLevel);

  const far = Math.max(w, h) * 0.68 + earth.r;
  let pos;
  let targetAngle;
  let target;
  const spiral = rockLevel < 5 && rockType === "normal" && Math.random() < 0.26;

  if (rockLevel === 5) {
    const side = Math.random() < 0.5 ? -1 : 1;
    pos = {
      x: side < 0 ? -earth.r : w + earth.r,
      y: rand(h * 0.18, h * 0.82),
    };
    const earthPath = Math.random() < 0.5;
    target = earthPath
      ? { x: earth.x + rand(-earth.r * 0.32, earth.r * 0.32), y: earth.y + rand(-earth.r * 0.32, earth.r * 0.32) }
      : { x: earth.x + rand(-moon.orbit * 0.62, moon.orbit * 0.62), y: earth.y + rand(-moon.orbit * 0.62, moon.orbit * 0.62) };
    targetAngle = Math.atan2(target.y - pos.y, target.x - pos.x) + rand(-0.14, 0.14);
  } else {
    const angle = rand(0, TAU);
    pos = {
      x: earth.x + Math.cos(angle) * far,
      y: earth.y + Math.sin(angle) * far,
    };
    const earthPath = Math.random() < 0.41;
    target = earthPath
      ? { x: earth.x + rand(-earth.r * 0.62, earth.r * 0.62), y: earth.y + rand(-earth.r * 0.62, earth.r * 0.62) }
      : { x: earth.x + rand(-moon.orbit * 0.38, moon.orbit * 0.38), y: earth.y + rand(-moon.orbit * 0.38, moon.orbit * 0.38) };
    targetAngle = Math.atan2(target.y - pos.y, target.x - pos.x) + rand(-0.18, 0.18);
  }

  const baseSpeed = 32 + level * 16 + rockLevel * 8;
  let velocity;

  if (spiral && rockType === "normal") {
    const inward = norm(earth.x - pos.x, earth.y - pos.y);
    const turn = Math.random() < 0.5 ? -1 : 1;
    const tangent = { x: -inward.y * turn, y: inward.x * turn };
    velocity = {
      x: tangent.x * (125 + level * 18) + inward.x * (28 + level * 8),
      y: tangent.y * (125 + level * 18) + inward.y * (28 + level * 8),
    };
  } else {
    const speedMult = rockType === "comet" ? 3 : rockType === "healing" ? 0.45 : 1;
    velocity = {
      x: Math.cos(targetAngle) * baseSpeed * speedMult,
      y: Math.sin(targetAngle) * baseSpeed * speedMult,
    };
  }

  const r = rockType === "comet" ? 8 : rockType === "healing" ? 10 + rockLevel * 2 : 7 + rockLevel * 4;

  const newRock = {
    x: pos.x,
    y: pos.y,
    vx: velocity.x,
    vy: velocity.y,
    level: rockType === "comet" ? 1 : rockLevel,
    rockType,
    breakCount: 0,
    r,
    seed: Math.random() * 999,
    cleared: false,
    deflected: false,
    spiral: spiral && rockType === "normal",
    enteredArena: false,
    earthSeeking: false,
    path: [],
    pathClock: 0,
    armorHits: 0,
    deflectorHits: 0,
    cracked: false,
  };
  rocks.push(newRock);
  if (rockType === "magnetic") spawnMagneticCompanions(newRock);
}

function spawnMagneticCompanions(magRock) {
  const count = 2 + Math.floor(Math.random() * 2);
  const companionLevel = Math.max(1, magRock.level - 1);
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, TAU);
    const offset = rand(magRock.r * 2.5, magRock.r * 5.5);
    const fr = 7 + companionLevel * 4;
    rocks.push({
      x: magRock.x + Math.cos(angle) * offset,
      y: magRock.y + Math.sin(angle) * offset,
      vx: magRock.vx * rand(0.75, 1.15) + rand(-18, 18),
      vy: magRock.vy * rand(0.75, 1.15) + rand(-18, 18),
      level: companionLevel,
      rockType: "normal",
      breakCount: 0,
      r: fr,
      seed: Math.random() * 999,
      cleared: false,
      deflected: false,
      spiral: false,
      enteredArena: magRock.enteredArena,
      earthSeeking: false,
      path: [],
      pathClock: 0,
      armorHits: 0,
      deflectorHits: 0,
      cracked: false,
    });
  }
}

function spawnBoss() {
  const bossHp = level >= 9 ? 8 : BOSS_HP_BASE;
  const side = Math.random() < 0.5 ? -1 : 1;
  const pos = {
    x: side < 0 ? -earth.r * 1.5 : w + earth.r * 1.5,
    y: earth.y + rand(-earth.r * 0.5, earth.r * 0.5),
  };
  const dir = norm(earth.x - pos.x, earth.y - pos.y);
  const speed = 8 + level * 1.5;
  rocks.push({
    x: pos.x,
    y: pos.y,
    vx: dir.x * speed,
    vy: dir.y * speed,
    level: 5,
    rockType: "boss",
    breakCount: 0,
    r: earth.r * 0.42,
    seed: Math.random() * 999,
    cleared: false,
    deflected: false,
    spiral: false,
    enteredArena: false,
    earthSeeking: true,
    path: [],
    pathClock: 0,
    armorHits: 0,
    cracked: false,
    bossHp,
    bossMaxHp: bossHp,
  });
}

function shoot(targetX, targetY) {
  if (!running) return;

  const shot = chooseShot(targetX, targetY);
  if (!shot) return;
  if (shot.type === "blaster") {
    fireLaser(targetX, targetY);
    return;
  }

  const { type, origin } = shot;
  const dir = norm(targetX - origin.x, targetY - origin.y);
  projectiles.push({
    x: origin.x + dir.x * (origin.r + 4),
    y: origin.y + dir.y * (origin.r + 4),
    vx: dir.x * 560,
    vy: dir.y * 560,
    r: 4,
    type,
    life: 1.9,
  });
  if (type === "deflector") moonPulse = 0.4;
}

function chooseShot(targetX, targetY) {
  const moonBlocked = moonBlockedForTarget(targetX, targetY) || lineIntersectsEarth(moon, targetX, targetY, earth.r * 0.92);

  // Use blaster when: ready, not disabled, and either selected or moon is blocked
  if (!blasterDisabled && blasterCooldown <= 0 && (selectedWeapon === "blaster" || moonBlocked)) {
    if (friendlyFire || !lineIntersectsEarth(satellite, targetX, targetY, earth.r * 0.96)) {
      return { type: "blaster", origin: satellite };
    }
  }

  // Deflector: blocked when line passes through Earth (moonBlocked includes that check)
  if (moonBlocked) return null;
  return { type: "deflector", origin: moon };
}

function laserScreenEdge(start, dirX, dirY) {
  let tMin = Infinity;
  if (dirX > 0) tMin = Math.min(tMin, (w - start.x) / dirX);
  else if (dirX < 0) tMin = Math.min(tMin, -start.x / dirX);
  if (dirY > 0) tMin = Math.min(tMin, (h - start.y) / dirY);
  else if (dirY < 0) tMin = Math.min(tMin, -start.y / dirY);
  if (!isFinite(tMin)) tMin = 1;
  return { x: start.x + dirX * tMin, y: start.y + dirY * tMin };
}

function fireLaser(targetX, targetY) {
  blasterCooldown = BLASTER_REFILL;
  const start = { x: satellite.x, y: satellite.y };
  const dir = norm(targetX - start.x, targetY - start.y);
  const edgeEnd = laserScreenEdge(start, dir.x, dir.y);
  const hit = findLaserHit(start, edgeEnd);
  const laserEnd = hit ? hit.point : edgeEnd;
  lasers.push({ x1: start.x, y1: start.y, x2: laserEnd.x, y2: laserEnd.y, life: 0.16, maxLife: 0.16 });
  if (hit) {
    hitRock(hit.rock, {
      x: hit.point.x - dir.x * 12,
      y: hit.point.y - dir.y * 12,
      vx: dir.x * 920,
      vy: dir.y * 920,
      type: "blaster",
    });
  } else if (friendlyFire) {
    const earthHit = lineIntersectsEarth(start, edgeEnd.x, edgeEnd.y, earth.r);
    if (earthHit) addEarthDamage(3, earthHit);
  }
}

function findLaserHit(start, target) {
  let best = null;
  for (const rock of rocks) {
    if (rock.cleared) continue;
    const hit = closestPointOnSegment(start, target, rock);
    if (hit.distance <= rock.r * 1.38 && (!best || hit.t < best.t)) {
      best = { rock, point: hit.point, t: hit.t };
    }
  }
  return best;
}

function closestPointOnSegment(a, b, p) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { point, t, distance: Math.hypot(p.x - point.x, p.y - point.y) };
}

function lineIntersectsEarth(origin, targetX, targetY, radius) {
  const closest = closestPointOnSegment(origin, { x: targetX, y: targetY }, earth);
  if (closest.distance > radius) return null;
  return closest.point;
}

function moonBlockedForTarget(targetX, targetY) {
  const target = norm(targetX - earth.x, targetY - earth.y);
  const moonSide = norm(moon.x - earth.x, moon.y - earth.y);
  return target.x * moonSide.x + target.y * moonSide.y < -0.18;
}

function useStarnet() {
  if (!running || starnet <= 0) return;
  starnet -= 1;
  starnetRingLife = 2;
  starnetActivationId += 1;
  const range = starnetRange();

  for (const rock of rocks) {
    if (rock.cleared) continue;
    const d = Math.hypot(rock.x - earth.x, rock.y - earth.y);
    rock.starnetActivationId = starnetActivationId;
    rock.starnetOrigin = d <= range ? "inside" : "outside";
    rock.starnetHit = false;
    rock.lastStarnetDistance = d;
    if (rock.starnetOrigin === "inside") destroyWithStarnet(rock);
  }
}

function predictPath(rock) {
  const ghost = { x: rock.x, y: rock.y, vx: rock.vx, vy: rock.vy };
  const pts = [];
  const step = 0.07;
  for (let i = 0; i < 130; i += 1) {
    const a = gravityAt(ghost);
    ghost.vx += a.x * step;
    ghost.vy += a.y * step;
    ghost.x += ghost.vx * step;
    ghost.y += ghost.vy * step;
    if (i % 2 === 0) pts.push({ x: ghost.x, y: ghost.y });
    if (Math.hypot(ghost.x - earth.x, ghost.y - earth.y) < earth.r) break;
    if (Math.hypot(ghost.x - moon.x, ghost.y - moon.y) < moon.r) break;
  }
  rock.path = pts;
}

function clearRock(rock, destroyed) {
  if (rock.cleared) return;
  rock.cleared = true;
  const successfulDeflection = !destroyed && rock.deflected;
  if (rock.rockType !== "healing" && rock.rockType !== "boss") {
    score += destroyed ? rock.level * 75 : successfulDeflection ? rock.level * 40 : 0;
    if (destroyed || successfulDeflection) {
      deflectionsCleared += 1;
      if (deflectionsCleared % 3 === 0) starnet += 1;
    }
  }
  addBurst(rock.x, rock.y, destroyed ? "#ffcf70" : "#8ff0b2", 16 + rock.level * 4);
}

function hitRock(rock, projectile) {
  if (rock.rockType === "comet") {
    score += 150;
    addBurst(rock.x, rock.y, "#aaeeff", 20);
    clearRock(rock, true);
    return;
  }

  if (rock.rockType === "healing") {
    if (projectile.type === "deflector") {
      const impulse = norm(rock.x - projectile.x, rock.y - projectile.y);
      rock.vx += impulse.x * 180;
      rock.vy += impulse.y * 180;
      rock.deflected = true;
      addBurst(rock.x, rock.y, "#44ff88", 8);
    } else {
      addBurst(rock.x, rock.y, "#ff8844", 12);
      clearRock(rock, true);
    }
    return;
  }

  if (rock.rockType === "armored") {
    if (projectile.type === "deflector") {
      const impulse = norm(rock.x - projectile.x, rock.y - projectile.y);
      if (rock.cracked) {
        rock.vx += impulse.x * (165 + rock.level * 22) + projectile.vx * 0.12;
        rock.vy += impulse.y * (165 + rock.level * 22) + projectile.vy * 0.12;
        rock.deflected = true;
        addBurst(rock.x, rock.y, "#8ff0b2", 14);
      } else {
        rock.deflectorHits += 1;
        if (rock.deflectorHits >= 2) {
          rock.vx += impulse.x * (165 + rock.level * 22) + projectile.vx * 0.12;
          rock.vy += impulse.y * (165 + rock.level * 22) + projectile.vy * 0.12;
          rock.deflected = true;
          rock.deflectorHits = 0;
          addBurst(rock.x, rock.y, "#8ff0b2", 14);
        } else {
          rock.vx += impulse.x * 55;
          rock.vy += impulse.y * 55;
          addBurst(rock.x, rock.y, "#aaa", 8);
        }
      }
      return;
    }
    rock.armorHits += 1;
    if (rock.armorHits >= 2) {
      clearRock(rock, true);
    } else {
      rock.cracked = true;
      shake = 0.2;
      addBurst(rock.x, rock.y, "#ffcf70", 10);
    }
    return;
  }

  if (rock.rockType === "boss") {
    if (projectile.type === "deflector") {
      addBurst(rock.x, rock.y, "#8ff0b2", 6);
      return;
    }
    rock.bossHp -= 1;
    shake = 0.35;
    addBurst(rock.x, rock.y, "#ff3148", 22);
    if (rock.bossHp <= 0) {
      score += 500;
      starnet += 3;
      bossActive = false;
      levelClock = 5;
      hazardBanner = { text: "CATASTROPHE AVERTED! +3 Starnet — Next level in 5s", timeLeft: 3.5 };
      clearRock(rock, true);
    } else {
      spawnRock(Math.max(1, Math.floor(rock.level / 2)));
    }
    return;
  }

  const impulse = norm(rock.x - projectile.x, rock.y - projectile.y);
  if (projectile.type === "deflector") {
    rock.vx += impulse.x * (165 + rock.level * 22) + projectile.vx * 0.12;
    rock.vy += impulse.y * (165 + rock.level * 22) + projectile.vy * 0.12;
    rock.deflected = true;
    addBurst(rock.x, rock.y, "#8ff0b2", 12);
    return;
  }

  if (rock.level <= 2) {
    clearRock(rock, true);
    return;
  }

  const pieces = rock.level === 3 ? 2 : rock.level === 4 ? 3 : 2;
  const newLevel = rock.level - 1;
  splitRock(rock, pieces, newLevel, projectile, impulse);
  rock.cleared = true;
}

function splitRock(rock, pieces, newLevel, projectile, impulse) {
  score += 30 * rock.level;
  addBurst(rock.x, rock.y, "#ffcf70", 22);
  const earthward = norm(earth.x - rock.x, earth.y - rock.y);
  const parentMass = rock.r * rock.r;
  const parentSpeed = Math.hypot(rock.vx, rock.vy);
  for (let i = 0; i < pieces; i += 1) {
    const sign = i % 2 === 0 ? 1 : -1;
    const spread = Math.atan2(impulse.y, impulse.x) + sign * (0.85 + i * 0.18);
    const fragmentR = 7 + newLevel * 4;
    const fragmentMass = fragmentR * fragmentR;
    const massRatio = parentMass / (fragmentMass * pieces);
    const fragmentSpeed = Math.max(120, parentSpeed * 0.6 * Math.sqrt(massRatio) + 60);
    const biasedToEarth = pieces === 2 && i === 0;
    const dir = biasedToEarth
      ? norm(earthward.x * 0.88 + Math.cos(spread) * 0.22, earthward.y * 0.88 + Math.sin(spread) * 0.22)
      : { x: Math.cos(spread), y: Math.sin(spread) };
    const impulseFactor = Math.sqrt(parentMass / fragmentMass) * 0.08;
    rocks.push({
      x: rock.x + Math.cos(spread) * 12,
      y: rock.y + Math.sin(spread) * 12,
      vx: rock.vx * 0.45 + dir.x * fragmentSpeed + projectile.vx * impulseFactor,
      vy: rock.vy * 0.45 + dir.y * fragmentSpeed + projectile.vy * impulseFactor,
      level: newLevel,
      rockType: "normal",
      breakCount: rock.breakCount,
      r: fragmentR,
      seed: Math.random() * 999,
      cleared: false,
      deflected: false,
      earthSeeking: biasedToEarth,
      enteredArena: true,
      path: [],
      pathClock: 0,
      armorHits: 0,
      cracked: false,
    });
  }
}

function markArenaState(rock) {
  const margin = rock.r * 2;
  if (rock.x > -margin && rock.x < w + margin && rock.y > -margin && rock.y < h + margin) {
    rock.enteredArena = true;
  }
}

function applyStarnetField(rock) {
  if (starnetRingLife <= 0 || rock.cleared) return;
  const range = starnetRange();
  const d = Math.hypot(rock.x - earth.x, rock.y - earth.y);

  if (rock.starnetActivationId !== starnetActivationId) {
    rock.starnetActivationId = starnetActivationId;
    rock.starnetOrigin = d <= range ? "inside" : "outside";
    rock.starnetHit = false;
  }

  if (d <= range) {
    if (rock.starnetOrigin === "inside") {
      destroyWithStarnet(rock);
    } else {
      deflectWithStarnet(rock, d);
    }
  }

  rock.lastStarnetDistance = d;
}

function destroyWithStarnet(rock) {
  if (rock.rockType === "healing") {
    captureHealingRock(rock);
    return;
  }
  addStarnetShock(rock);
  clearRock(rock, true);
}

function captureHealingRock(rock) {
  const healed = damage * 0.33;
  damage = Math.max(0, damage - healed);
  score += 200;
  rock.cleared = true;
  addBurst(rock.x, rock.y, "#44ff88", 32);
  hazardBanner = { text: `Healing Rock captured! Earth healed 33%`, timeLeft: 2.5 };
}

function deflectWithStarnet(rock, distanceFromEarth) {
  const away = norm(rock.x - earth.x, rock.y - earth.y);
  const orbitGap = Math.max(0, moon.orbit - distanceFromEarth);
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

function isOutsideArena(rock) {
  const margin = Math.max(90, rock.r * 5);
  const offScreen = rock.x < -margin || rock.x > w + margin || rock.y < -margin || rock.y > h + margin;
  return rock.enteredArena && offScreen && Math.hypot(rock.x - earth.x, rock.y - earth.y) > deflectionRange();
}

function bounceFromMoon(rock) {
  const away = norm(rock.x - moon.x, rock.y - moon.y);
  const speed = Math.max(140, Math.hypot(rock.vx, rock.vy));
  rock.x = moon.x + away.x * (moon.r + rock.r + 3);
  rock.y = moon.y + away.y * (moon.r + rock.r + 3);
  rock.vx = away.x * speed + moon.speed * moon.orbit * -Math.sin(moon.angle) * 0.2;
  rock.vy = away.y * speed + moon.speed * moon.orbit * Math.cos(moon.angle) * 0.2;
  rock.pathClock = 0;
  addBurst(rock.x, rock.y, "#cfd6d4", 8);
  moonShieldLife = 0.55;
}

function resolveRockCollisions() {
  for (let i = 0; i < rocks.length; i += 1) {
    const a = rocks[i];
    if (a.cleared || a.rockType === "boss") continue;
    for (let j = i + 1; j < rocks.length; j += 1) {
      const b = rocks[j];
      if (b.cleared || b.rockType === "boss") continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const minDist = a.r + b.r;
      if (d >= minDist) continue;

      const nx = dx / d;
      const ny = dy / d;
      const overlap = minDist - d;
      const ma = a.r * a.r;
      const mb = b.r * b.r;
      const total = ma + mb;
      a.x -= nx * overlap * (mb / total);
      a.y -= ny * overlap * (mb / total);
      b.x += nx * overlap * (ma / total);
      b.y += ny * overlap * (ma / total);

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const velAlongNormal = rvx * nx + rvy * ny;
      if (velAlongNormal > 0) continue;
      const restitution = 0.42;
      const impulse = (-(1 + restitution) * velAlongNormal) / (1 / ma + 1 / mb);
      const ix = impulse * nx;
      const iy = impulse * ny;
      a.vx -= ix / ma;
      a.vy -= iy / ma;
      b.vx += ix / mb;
      b.vy += iy / mb;
    }
  }
}

function addEarthDamage(amount, rock) {
  const oceanFactor = isOceanHit(rock) ? 0.25 : 1;
  const repeatedFactor = repeatedHitFactor(rock);
  const actualDamage = amount * oceanFactor * repeatedFactor;
  damage += actualDamage;
  registerImpact(rock, actualDamage);
  while (damage >= nextDamageStarnet && nextDamageStarnet <= 100) {
    starnet += 1;
    nextDamageStarnet += 10;
  }
  shake = 0.35;
}

function registerImpact(rock, actualDamage) {
  const geo = screenToGeo(rock.x, rock.y);
  const country = countryAt(geo.lat, geo.lon);
  lostCountry = country;
  lostCountries.add(country);
  burnSites.push({
    lat: geo.lat,
    lon: geo.lon,
    country,
    intensity: clamp(actualDamage / 15, 0.35, 2.2),
    born: performance.now(),
  });
  if (burnSites.length > 26) burnSites.shift();
}

function screenToGeo(x, y) {
  const nx = clamp((x - earth.x) / earth.r, -0.98, 0.98);
  const ny = clamp((y - earth.y) / earth.r, -0.98, 0.98);
  const z = Math.sqrt(Math.max(0.001, 1 - nx * nx - ny * ny));
  return {
    lat: Math.asin(-ny),
    lon: normalizeLon(Math.atan2(nx, z) - earthSpin),
  };
}

function geoToScreen(lat, lon) {
  const relLon = normalizeLon(lon + earthSpin);
  const cosLat = Math.cos(lat);
  const z = cosLat * Math.cos(relLon);
  if (z <= 0) return null;
  return {
    x: earth.x + earth.r * cosLat * Math.sin(relLon),
    y: earth.y - earth.r * Math.sin(lat),
    z,
  };
}

function normalizeLon(lon) {
  return Math.atan2(Math.sin(lon), Math.cos(lon));
}

function countryAt(latRad, lonRad) {
  const lat = (latRad * 180) / Math.PI;
  const lon = (lonRad * 180) / Math.PI;
  const boxes = [
    ["United States", 24, 50, -125, -66],
    ["Canada", 50, 72, -141, -52],
    ["Mexico", 14, 32, -118, -86],
    ["Brazil", -34, 6, -74, -34],
    ["Argentina", -55, -22, -73, -53],
    ["United Kingdom", 50, 59, -8, 2],
    ["France", 42, 51, -5, 8],
    ["Spain", 36, 44, -10, 4],
    ["Germany", 47, 55, 5, 16],
    ["Italy", 36, 47, 6, 19],
    ["Russia", 50, 76, 30, 180],
    ["Turkey", 36, 42, 26, 45],
    ["Egypt", 22, 32, 25, 36],
    ["Nigeria", 4, 14, 3, 15],
    ["South Africa", -35, -22, 16, 33],
    ["Saudi Arabia", 16, 32, 34, 56],
    ["India", 8, 35, 68, 90],
    ["China", 18, 54, 73, 135],
    ["Japan", 30, 46, 129, 146],
    ["Indonesia", -11, 6, 95, 141],
    ["Australia", -44, -10, 113, 154],
  ];
  for (const [name, minLat, maxLat, minLon, maxLon] of boxes) {
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) return name;
  }
  if (Math.abs(lat) > 62) return lat > 0 ? "Arctic sector" : "Antarctic sector";
  if (lon > -70 && lon < 20) return "Atlantic Ocean sector";
  if (lon > 20 && lon < 115) return "Indian Ocean sector";
  return "Pacific Ocean sector";
}

function repeatedHitFactor(rock) {
  const angle = Math.atan2(rock.y - earth.y, rock.x - earth.x) - earthSpin;
  let factor = 1;
  for (const hit of impactMemory) {
    const delta = Math.abs(Math.atan2(Math.sin(angle - hit.angle), Math.cos(angle - hit.angle)));
    if (delta < 0.28) factor *= 0.55;
  }
  impactMemory.push({ angle, ttl: 18 });
  return clamp(factor, 0.22, 1);
}

function isOceanHit(rock) {
  const lon = Math.atan2(rock.y - earth.y, rock.x - earth.x) - earthSpin;
  const latWave = Math.sin(lon * 2.3) + Math.cos(lon * 4.2 + 1.1) * 0.55;
  return latWave < 0.12;
}

function addBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, TAU);
    const s = rand(40, 190);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.8), color });
  }
}

function addCometTrail(rock) {
  const speed = Math.hypot(rock.vx, rock.vy) || 1;
  const bx = -rock.vx / speed;
  const by = -rock.vy / speed;
  for (let i = 0; i < 3; i += 1) {
    particles.push({
      x: rock.x + bx * rock.r * rand(0.5, 1.8),
      y: rock.y + by * rock.r * rand(0.5, 1.8),
      vx: bx * rand(60, 140) + rand(-15, 15),
      vy: by * rand(60, 140) + rand(-15, 15),
      life: rand(0.1, 0.3),
      color: Math.random() < 0.55 ? "#ffdd88" : "#ff9940",
    });
  }
}

function addStarnetShock(rock) {
  starnetEffects.push({
    x: rock.x,
    y: rock.y,
    r: rock.r,
    life: 0.42,
    maxLife: 0.42,
    seed: Math.random() * TAU,
  });
}

function applyBlasterHoming(projectile, dt) {
  if (projectile.type !== "blaster") return;
  let target = null;
  let best = Infinity;
  for (const rock of rocks) {
    if (rock.cleared) continue;
    const homingRadius = rock.r * 1.5 + projectile.r;
    const d = Math.hypot(projectile.x - rock.x, projectile.y - rock.y);
    if (d < homingRadius && d < best) {
      best = d;
      target = rock;
    }
  }
  if (!target) return;
  const speed = Math.hypot(projectile.vx, projectile.vy) || 700;
  const desired = norm(target.x - projectile.x, target.y - projectile.y);
  const blend = clamp(dt * 8.5, 0, 0.28);
  projectile.vx = projectile.vx * (1 - blend) + desired.x * speed * blend;
  projectile.vy = projectile.vy * (1 - blend) + desired.y * speed * blend;
  const corrected = norm(projectile.vx, projectile.vy);
  projectile.vx = corrected.x * speed;
  projectile.vy = corrected.y * speed;
}

function activateHazardEvent(type) {
  const duration = 15;
  hazardEvent = { type, timeLeft: duration, maxTime: duration };
  blasterDisabled = false;
  gravityMultiplier = 1;
  moonSpeedMultiplier = 1;
  spawnRateMultiplier = 1;
  const bannerMap = {
    meteor: "METEOR SHOWER! Spawn rate doubled for 15s",
    solar: "SOLAR FLARE! Blaster offline for 15s",
    moon: "ROGUE MOON! Orbit speed tripled for 15s",
    gravity: "GRAVITY SURGE! Rocks accelerate faster for 15s",
  };
  switch (type) {
    case "meteor": spawnRateMultiplier = 2; break;
    case "solar": blasterDisabled = true; break;
    case "moon": moonSpeedMultiplier = 3; break;
    case "gravity": gravityMultiplier = 2; break;
  }
  hazardBanner = { text: bannerMap[type] || type, timeLeft: 3 };
}

function deactivateHazardEvent() {
  hazardEvent = null;
  blasterDisabled = false;
  gravityMultiplier = 1;
  moonSpeedMultiplier = 1;
  spawnRateMultiplier = 1;
}

function nextLevel() {
  if (level >= TOTAL_LEVELS) {
    endGame("All 10 levels cleared. Earth survives.");
    return;
  }
  level += 1;
  levelClock = LEVEL_TIME;
  deactivateHazardEvent();

  const hazardType = HAZARD_SCHEDULE[level - 1];
  if (hazardType) activateHazardEvent(hazardType);

  if (BOSS_LEVELS.has(level)) {
    bossActive = true;
    for (let i = 0; i < 2; i += 1) spawnRock();
    spawnBoss();
    if (!hazardBanner) hazardBanner = { text: `LEVEL ${level} — CATASTROPHE INCOMING!`, timeLeft: 3 };
  } else {
    const count = Math.min(4, Math.ceil(level / 2) + 1);
    for (let i = 0; i < count; i += 1) spawnRock();
  }
}

function endGame(message) {
  running = false;
  deactivateHazardEvent();
  bossActive = false;
  els.overlay.querySelector("h1").textContent = damage >= 100 ? "Earth Lost" : "Mission Report";
  els.overlay.querySelector("p").textContent = `${message} Score: ${score}.`;
  els.startBtn.textContent = "Restart Mission";
  els.tutorialOverlay.classList.remove("show");
  els.overlay.classList.add("show");
}

function applyMagneticPull(dt) {
  for (const magRock of rocks) {
    if (magRock.cleared || magRock.rockType !== "magnetic") continue;
    for (const other of rocks) {
      if (other.cleared || other === magRock || other.rockType === "magnetic" || other.rockType === "boss") continue;
      const dx = magRock.x - other.x;
      const dy = magRock.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d < MAGNETIC_PULL_RADIUS && d > 1) {
        const fieldFrac = 1 - d / MAGNETIC_PULL_RADIUS;
        const pull = MAGNETIC_PULL_STRENGTH * dt * fieldFrac;
        other.vx += (dx / d) * pull;
        other.vy += (dy / d) * pull;

        // Brake rocks approaching head-on
        const approach = (other.vx * dx + other.vy * dy) / d;
        if (approach > 80) {
          const brake = approach * 0.3 * dt * fieldFrac;
          other.vx -= (dx / d) * brake;
          other.vy -= (dy / d) * brake;
        }

        // Purple trail — shows path being deflected by the magnetic field
        if (pull > 0.15 && Math.random() < 0.07) {
          particles.push({
            x: other.x + rand(-4, 4),
            y: other.y + rand(-4, 4),
            vx: rand(-20, 20),
            vy: rand(-20, 20),
            life: rand(0.15, 0.32),
            color: "#b060ff",
          });
        }
      }
    }
  }
}

function rockThreatScore(rock) {
  const d = Math.hypot(rock.x - earth.x, rock.y - earth.y);
  const proximityDanger = Math.max(0, 1 - d / (earth.r * 3.5)) * 50;
  const dmg = (ROCK_DAMAGE[Math.min(rock.level, 5)] / 35) * 25;
  const speed = Math.min(Math.hypot(rock.vx, rock.vy) / 500, 1) * 15;
  const typeBonus = { comet: 12, armored: 8, magnetic: 6, boss: 30 }[rock.rockType] || 0;
  return proximityDanger + dmg + speed + typeBonus;
}

function fireMoonLaser() {
  const range = starnetRange();
  let best = null;
  let bestScore = -Infinity;
  for (const rock of rocks) {
    if (rock.cleared || rock.rockType === "healing" || rock.rockType === "boss") continue;
    if (Math.hypot(rock.x - earth.x, rock.y - earth.y) > range) continue;
    const s = rockThreatScore(rock);
    if (s > bestScore) { bestScore = s; best = rock; }
  }
  if (!best) return;
  lasers.push({ x1: moon.x, y1: moon.y, x2: best.x, y2: best.y, life: 0.14, maxLife: 0.14, fromMoon: true });
  hitRock(best, { x: moon.x, y: moon.y, vx: 0, vy: 0, type: "blaster" });
}

function update(dt) {
  updateMoon(dt);
  if (!running) return;

  if (hazardEvent) {
    hazardEvent.timeLeft -= dt;
    if (hazardEvent.timeLeft <= 0) deactivateHazardEvent();
  }
  if (hazardBanner) {
    hazardBanner.timeLeft -= dt;
    if (hazardBanner.timeLeft <= 0) hazardBanner = null;
  }

  if (!bossActive) levelClock -= dt;
  moonPulse = Math.max(0, moonPulse - dt);
  moonShieldLife = Math.max(0, moonShieldLife - dt);
  blasterCooldown = Math.max(0, blasterCooldown - dt);
  earthSpin += dt * 0.22;
  spawnClock -= dt;
  starnetRingLife = Math.max(0, starnetRingLife - dt);
  if (starnetRingLife > 0) {
    moonLaserClock = Math.max(0, moonLaserClock - dt);
    if (moonLaserClock <= 0) { moonLaserClock = 0.5; fireMoonLaser(); }
  }
  shake = Math.max(0, shake - dt);

  // Moon fires lasers while starnet is active
  if (starnetRingLife > 0 && running) {
    moonLaserClock = Math.max(0, moonLaserClock - dt);
    if (moonLaserClock <= 0) {
      moonLaserClock = 0.5;
      fireMoonLaser();
    }
  }

  for (const hit of impactMemory) hit.ttl -= dt;
  while (impactMemory.length && impactMemory[0].ttl <= 0) impactMemory.shift();

  if (spawnClock <= 0) {
    spawnRock();
    const baseInterval = Math.max(1.0, 2.8 - level * 0.14);
    spawnClock = baseInterval / spawnRateMultiplier;
  }

  applyMagneticPull(dt);

  for (const projectile of projectiles) {
    applyBlasterHoming(projectile, dt);
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    if (Math.hypot(projectile.x - earth.x, projectile.y - earth.y) < earth.r) {
      addEarthDamage(projectile.type === "blaster" ? 3 : 1, projectile);
      projectile.life = -1;
      addBurst(projectile.x, projectile.y, "#ff6e7b", 8);
    }
  }

  for (const rock of rocks) {
    if (rock.cleared) continue;
    integrateRock(rock, dt);
    markArenaState(rock);

    if (rock.rockType === "comet") addCometTrail(rock);

    rock.pathClock -= dt;
    if (rock.pathClock <= 0) {
      predictPath(rock);
      rock.pathClock = 0.28;
    }
    applyStarnetField(rock);
    if (rock.cleared) continue;

    if (Math.hypot(rock.x - earth.x, rock.y - earth.y) < earth.r + rock.r * 0.45) {
      if (rock.rockType === "boss") {
        addEarthDamage(50, rock);
        bossActive = false;
      } else if (rock.rockType !== "healing") {
        addEarthDamage(ROCK_DAMAGE[rock.level], rock);
      }
      clearRock(rock, true);
    } else if (rock.rockType !== "boss" && Math.hypot(rock.x - moon.x, rock.y - moon.y) < moon.r + rock.r * 0.4) {
      bounceFromMoon(rock);
    } else if (isOutsideArena(rock)) {
      if (rock.deflected) clearRock(rock, false);
      else rock.cleared = true;
    }
  }
  resolveRockCollisions();

  for (const projectile of projectiles) {
    if (projectile.life <= 0) continue;
    for (const rock of rocks) {
      if (rock.cleared) continue;
      const hitRadius = rock.r * 1.25 + projectile.r;
      if (Math.hypot(projectile.x - rock.x, projectile.y - rock.y) <= hitRadius) {
        if (rock.rockType === "magnetic" && projectile.type === "deflector") {
          const away = norm(projectile.x - rock.x, projectile.y - rock.y);
          const speed = Math.hypot(projectile.vx, projectile.vy);
          projectile.vx = away.x * speed;
          projectile.vy = away.y * speed;
          addBurst(rock.x, rock.y, "#b060ff", 12);
        } else {
          hitRock(rock, projectile);
          projectile.life = -1;
        }
        break;
      }
    }
  }

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  for (const shock of starnetEffects) shock.life -= dt;
  for (const laser of lasers) laser.life -= dt;

  projectiles = projectiles.filter((p) => p.life > 0 && p.x > -80 && p.x < w + 80 && p.y > -80 && p.y < h + 80);
  rocks = rocks.filter((r) => !r.cleared && r.x > -w && r.x < w * 2 && r.y > -h && r.y < h * 2);
  particles = particles.filter((p) => p.life > 0);
  starnetEffects = starnetEffects.filter((shock) => shock.life > 0);
  lasers = lasers.filter((laser) => laser.life > 0);

  if (bossActive && !rocks.some(r => !r.cleared && r.rockType === "boss")) {
    bossActive = false;
    levelClock = 5;
  }

  if (levelClock <= 0 && !bossActive) nextLevel();
  if (damage >= 100) endGame("Earth took too many hits.");
}

function draw() {
  ctx.clearRect(0, 0, w, h);
  const sx = shake ? rand(-5, 5) * shake : 0;
  const sy = shake ? rand(-5, 5) * shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  drawSpace();
  drawOrbits();
  drawStarnetRangeRing();
  drawPaths();
  drawEarth();
  drawBurnSites();
  drawSatellite();
  drawMoon();
  drawRocks();
  drawLasers();
  drawProjectiles();
  drawStarnetEffects();
  drawParticles();
  ctx.restore();
  drawReticle();
  drawHazardBanner();
  drawHazardIndicator();
  updateHud();
}

function drawSpace() {
  const gradient = ctx.createRadialGradient(earth.x, earth.y, earth.r * 0.6, earth.x, earth.y, Math.max(w, h) * 0.75);
  gradient.addColorStop(0, "#0c1630");
  gradient.addColorStop(1, "#030713");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#eef7ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOrbits() {
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.arc(earth.x, earth.y, moon.orbit, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawStarnetRangeRing() {
  if (starnetRingLife <= 0) return;
  const t = clamp(starnetRingLife / 2, 0, 1);
  const radius = starnetRange();
  ctx.save();
  ctx.globalAlpha = 0.18 + t * 0.72;
  ctx.shadowColor = "#72e6ff";
  ctx.shadowBlur = 24;
  ctx.strokeStyle = "#72e6ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(earth.x, earth.y, radius, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 0.12 + t * 0.25;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(earth.x, earth.y, radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawPaths() {
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 7]);
  for (const rock of rocks) {
    if (!rock.path.length || rock.rockType === "healing") continue;
    if (rock.rockType === "boss") ctx.strokeStyle = "rgba(255, 50, 72, 0.55)";
    else if (rock.level === 5 && rock.breakCount === 0) ctx.strokeStyle = "rgba(255, 70, 82, 0.42)";
    else if (rock.level >= 4) ctx.strokeStyle = "rgba(255, 207, 112, 0.32)";
    else ctx.strokeStyle = "rgba(184, 224, 255, 0.22)";
    ctx.beginPath();
    ctx.moveTo(rock.x, rock.y);
    for (const p of rock.path) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawEarth() {
  if (earthTextureReady && earthTextureData) {
    drawTexturedEarth();
    return;
  }

  ctx.save();
  ctx.translate(earth.x, earth.y);
  ctx.beginPath();
  ctx.arc(0, 0, earth.r, 0, TAU);
  ctx.clip();

  const ocean = ctx.createRadialGradient(-earth.r * 0.35, -earth.r * 0.35, earth.r * 0.2, 0, 0, earth.r);
  ocean.addColorStop(0, "#53d8ff");
  ocean.addColorStop(0.58, "#1e76d4");
  ocean.addColorStop(1, "#083276");
  ctx.fillStyle = ocean;
  ctx.fillRect(-earth.r, -earth.r, earth.r * 2, earth.r * 2);

  ctx.rotate(earthSpin);
  drawContinent(-earth.r * 0.22, -earth.r * 0.22, 0.85, "#46b579");
  drawContinent(earth.r * 0.33, earth.r * 0.08, 0.72, "#7ecb70");
  drawContinent(-earth.r * 0.52, earth.r * 0.33, 0.58, "#8ccb68");
  drawClouds();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(earth.x, earth.y, earth.r, 0, TAU);
  ctx.strokeStyle = "rgba(151, 221, 255, 0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawTexturedEarth() {
  const size = Math.round(clamp(earth.r * 2, 180, 320));
  const radius = size / 2;
  if (earthFrameCanvas.width !== size || earthFrameCanvas.height !== size) {
    earthFrameCanvas.width = size;
    earthFrameCanvas.height = size;
  }

  const frame = earthFrameCtx.createImageData(size, size);
  const pixels = frame.data;
  const tex = earthTextureData;
  for (let y = 0; y < size; y += 1) {
    const ny = (y - radius) / radius;
    for (let x = 0; x < size; x += 1) {
      const nx = (x - radius) / radius;
      const rr = nx * nx + ny * ny;
      const out = (y * size + x) * 4;
      if (rr > 1) {
        pixels[out + 3] = 0;
        continue;
      }
      const z = Math.sqrt(1 - rr);
      const lat = Math.asin(-ny);
      const lon = normalizeLon(Math.atan2(nx, z) - earthSpin);
      const sx = Math.floor(positiveMod((lon / TAU + 0.5) * tex.width, tex.width));
      const sy = Math.floor(clamp((0.5 - lat / Math.PI) * tex.height, 0, tex.height - 1));
      const src = (sy * tex.width + sx) * 4;
      const limb = clamp(z * 1.18, 0.18, 1);
      const light = clamp(0.42 + z * 0.58 + nx * -0.08 + ny * -0.05, 0.18, 1.08) * limb;
      pixels[out] = tex.data[src] * light;
      pixels[out + 1] = tex.data[src + 1] * light;
      pixels[out + 2] = tex.data[src + 2] * light;
      pixels[out + 3] = 255;
    }
  }
  earthFrameCtx.putImageData(frame, 0, 0);
  ctx.drawImage(earthFrameCanvas, earth.x - earth.r, earth.y - earth.r, earth.r * 2, earth.r * 2);

  ctx.beginPath();
  ctx.arc(earth.x, earth.y, earth.r, 0, TAU);
  ctx.strokeStyle = "rgba(151, 221, 255, 0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawContinent(x, y, scale, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= 16; i += 1) {
    const a = (i / 16) * TAU;
    const r = earth.r * scale * (0.22 + Math.sin(i * 1.7) * 0.035 + Math.cos(i * 2.9) * 0.03);
    const px = x + Math.cos(a) * r * 1.25;
    const py = y + Math.sin(a) * r * 0.75;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.fill();
}

function drawClouds() {
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = Math.max(3, earth.r * 0.025);
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, i * earth.r * 0.26, earth.r * 0.82, earth.r * 0.08, 0.25 * i, 0.25, Math.PI * 1.55);
    ctx.stroke();
  }
}

function drawMoon() {
  ctx.save();
  ctx.translate(moon.x, moon.y);

  // Energy shield ring — expands and fades after a rock bounces
  if (moonShieldLife > 0) {
    const t = moonShieldLife / 0.55;
    const expansion = (1 - t) * 16;
    ctx.globalAlpha = t * 0.85;
    ctx.strokeStyle = "#72e6ff";
    ctx.lineWidth = 2 + t * 4;
    ctx.shadowColor = "#72e6ff";
    ctx.shadowBlur = 22 * t;
    ctx.beginPath();
    ctx.arc(0, 0, moon.r + 7 + expansion, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Moon body
  const g = ctx.createRadialGradient(-moon.r * 0.35, -moon.r * 0.4, 2, 0, 0, moon.r);
  g.addColorStop(0, "#f1f2e8");
  g.addColorStop(1, "#8f958f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, moon.r, 0, TAU);
  ctx.fill();

  // Craters
  ctx.fillStyle = "rgba(40, 44, 48, 0.28)";
  for (const crater of moonCraters) {
    ctx.beginPath();
    ctx.arc(crater.x, crater.y, crater.r, 0, TAU);
    ctx.fill();
  }

  // Deflector arc — pulses bright when a deflector shot fires
  const pulseT = moonPulse / 0.4;
  const arcAlpha = 0.75 + pulseT * 0.55;
  const arcWidth = 2 + pulseT * 3;
  ctx.strokeStyle = `rgba(114,230,255,${arcAlpha.toFixed(2)})`;
  ctx.lineWidth = arcWidth;
  if (pulseT > 0) {
    ctx.shadowColor = "#72e6ff";
    ctx.shadowBlur = 18 * pulseT;
  }
  ctx.beginPath();
  ctx.arc(0, 0, moon.r + 5, 0.15, Math.PI * 1.25);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawSatellite() {
  ctx.save();
  ctx.strokeStyle = blasterDisabled ? "rgba(255,80,50,0.25)" : "rgba(255,207,112,0.18)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.arc(earth.x, earth.y, satellite.orbit, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.translate(satellite.x, satellite.y);
  ctx.rotate(satellite.angle + Math.PI / 2);
  ctx.shadowColor = blasterDisabled ? "#ff5032" : "#ffcf70";
  ctx.shadowBlur = blasterDisabled ? 6 : blasterCooldown <= 0 ? 16 : 4;
  ctx.fillStyle = blasterDisabled ? "#cc9988" : "#dfe8ef";
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.fillRect(-satellite.r * 0.55, -satellite.r * 0.55, satellite.r * 1.1, satellite.r * 1.1);
  ctx.strokeRect(-satellite.r * 0.55, -satellite.r * 0.55, satellite.r * 1.1, satellite.r * 1.1);
  ctx.fillStyle = "#3f9bd6";
  ctx.fillRect(-satellite.r * 2.4, -satellite.r * 0.35, satellite.r * 1.45, satellite.r * 0.7);
  ctx.fillRect(satellite.r * 0.95, -satellite.r * 0.35, satellite.r * 1.45, satellite.r * 0.7);
  ctx.restore();
}

function drawBurnSites() {
  if (!burnSites.length) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(earth.x, earth.y, earth.r, 0, TAU);
  ctx.clip();
  const now = performance.now();
  for (const site of burnSites) {
    const p = geoToScreen(site.lat, site.lon);
    if (!p) continue;
    const pulse = 0.7 + Math.sin(now * 0.008 + site.lon * 3) * 0.3;
    const r = earth.r * (0.035 + site.intensity * 0.025) * (0.85 + pulse * 0.3) * p.z;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
    glow.addColorStop(0, "rgba(255,245,130,0.96)");
    glow.addColorStop(0.32, "rgba(255,96,32,0.84)");
    glow.addColorStop(1, "rgba(120,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(45,0,0,0.7)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.78, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawRocks() {
  for (const rock of rocks) {
    ctx.save();
    ctx.translate(rock.x, rock.y);

    if (rock.rockType === "comet") {
      ctx.rotate(Math.atan2(rock.vy, rock.vx) + performance.now() * 0.001);
      ctx.shadowColor = "#88eeff";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#d8f8ff";
      ctx.strokeStyle = "rgba(140,240,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU;
        const r = rock.r * (0.75 + 0.3 * Math.sin(i * 2.1 + rock.seed));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

    } else if (rock.rockType === "armored") {
      ctx.rotate(rock.seed + performance.now() * 0.00012);
      ctx.fillStyle = "#7a7870";
      ctx.strokeStyle = rock.cracked ? "rgba(255,200,60,0.85)" : "rgba(200,200,180,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 11; i += 1) {
        const a = (i / 11) * TAU;
        const r = rock.r * (0.82 + 0.2 * Math.sin(i * 2.4 + rock.seed));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (rock.cracked) {
        ctx.strokeStyle = "rgba(255,210,60,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-rock.r * 0.7, -rock.r * 0.1);
        ctx.lineTo(rock.r * 0.35, rock.r * 0.65);
        ctx.moveTo(-rock.r * 0.15, -rock.r * 0.72);
        ctx.lineTo(rock.r * 0.28, rock.r * 0.18);
        ctx.stroke();
      }

    } else if (rock.rockType === "magnetic") {
      ctx.rotate(rock.seed + performance.now() * 0.00018);
      ctx.shadowColor = "#b060ff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#7b30cc";
      ctx.strokeStyle = "rgba(190,120,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 11; i += 1) {
        const a = (i / 11) * TAU;
        const r = rock.r * (0.78 + 0.28 * Math.sin(i * 2.4 + rock.seed));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = "rgba(180,100,255,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, MAGNETIC_PULL_RADIUS, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

    } else if (rock.rockType === "healing") {
      ctx.rotate(performance.now() * 0.00035);
      ctx.shadowColor = "#44ff88";
      ctx.shadowBlur = 20 + Math.sin(performance.now() * 0.004) * 8;
      ctx.fillStyle = "#1a8844";
      ctx.strokeStyle = "rgba(80,255,140,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * TAU;
        const r = rock.r * (0.78 + 0.22 * Math.sin(i * 2.1 + rock.seed));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(120,255,160,0.9)";
      ctx.fillRect(-rock.r * 0.12, -rock.r * 0.52, rock.r * 0.24, rock.r * 1.04);
      ctx.fillRect(-rock.r * 0.52, -rock.r * 0.12, rock.r * 1.04, rock.r * 0.24);

    } else if (rock.rockType === "boss") {
      ctx.rotate(rock.seed + performance.now() * 0.00008);
      const pulse = 0.92 + Math.sin(performance.now() * 0.005) * 0.08;
      ctx.shadowColor = "#ff3148";
      ctx.shadowBlur = 28;
      ctx.fillStyle = "#8a1020";
      ctx.strokeStyle = "rgba(255,100,120,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 13; i += 1) {
        const a = (i / 13) * TAU;
        const r = rock.r * pulse * (0.82 + 0.2 * Math.sin(i * 2.4 + rock.seed));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (rock.bossHp !== undefined) {
        ctx.shadowBlur = 0;
        const barW = rock.r * 2.2;
        const barH = 8;
        const bx = -barW / 2;
        const by = -rock.r - 18;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(bx, by, barW, barH);
        const hpFrac = rock.bossHp / rock.bossMaxHp;
        ctx.fillStyle = hpFrac > 0.5 ? "#ff3148" : hpFrac > 0.25 ? "#ff8000" : "#ffff00";
        ctx.fillRect(bx, by, barW * hpFrac, barH);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, barW, barH);
        ctx.fillStyle = "#fff";
        ctx.font = `bold 10px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`CATASTROPHE ${rock.bossHp}/${rock.bossMaxHp}`, 0, by - 2);
      }

    } else {
      ctx.rotate(rock.seed + performance.now() * 0.00025);
      ctx.fillStyle = ["", "#bfc0bb", "#a99c8c", "#9a7662", "#805b52", "#a06058"][rock.level];
      ctx.strokeStyle = rock.level >= 4 ? "rgba(255,110,123,0.75)" : "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 11; i += 1) {
        const a = (i / 11) * TAU;
        const r = rock.r * (0.78 + 0.28 * Math.sin(i * 2.4 + rock.seed));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawProjectiles() {
  for (const p of projectiles) {
    ctx.strokeStyle = p.type === "blaster" ? "#ffcf70" : "#8ff0b2";
    ctx.lineWidth = p.type === "blaster" ? 3 : 2;
    if (p.type === "blaster") {
      ctx.shadowColor = "#ffcf70";
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
    ctx.stroke();
    ctx.fillStyle = p.type === "blaster" ? "#fff0b5" : "#d2ffe1";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawLasers() {
  for (const laser of lasers) {
    const t = clamp(laser.life / laser.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t;
    if (laser.fromMoon) {
      ctx.strokeStyle = "#72e6ff";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#72e6ff";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.strokeStyle = "#d8f8ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#ffcf70";
      ctx.lineWidth = 7;
      ctx.shadowColor = "#ffcf70";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.strokeStyle = "#fff8d6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawStarnetEffects() {
  for (const shock of starnetEffects) {
    const t = clamp(shock.life / shock.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t * 0.95;
    ctx.strokeStyle = "#72e6ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#72e6ff";
    ctx.shadowBlur = 18;
    for (let b = 0; b < 5; b += 1) {
      const startAngle = shock.seed + b * 1.23 + performance.now() * 0.003;
      const sx = earth.x + Math.cos(startAngle) * earth.r * 0.92;
      const sy = earth.y + Math.sin(startAngle) * earth.r * 0.92;
      drawLightning(sx, sy, shock.x, shock.y, 7, shock.seed + b);
    }
    ctx.beginPath();
    ctx.arc(shock.x, shock.y, shock.r * (1.5 + (1 - t) * 2.2), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawLightning(x1, y1, x2, y2, segments, seed) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const perp = norm(-dy, dx);
  for (let i = 1; i < segments; i += 1) {
    const p = i / segments;
    const jitter = Math.sin(seed * 9.7 + i * 2.4 + performance.now() * 0.03) * 12;
    ctx.lineTo(x1 + dx * p + perp.x * jitter, y1 + dy * p + perp.y * jitter);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life * 1.7, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawReticle() {
  // Deflector ring — always visible
  ctx.strokeStyle = "rgba(143,240,178,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, moon.r + 14, 0, TAU);
  ctx.stroke();

  // Blaster ring — shown whenever ready
  if (blasterCooldown <= 0 && !blasterDisabled) {
    ctx.strokeStyle = "rgba(255,207,112,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(satellite.x, satellite.y, satellite.r + 14, 0, TAU);
    ctx.stroke();
  }
}

function drawHazardBanner() {
  if (!hazardBanner) return;
  const alpha = clamp(hazardBanner.timeLeft * 1.2, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(200, 60, 20, 0.88)";
  ctx.fillRect(0, h * 0.46, w, 50);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hazardBanner.text, w / 2, h * 0.46 + 25);
  ctx.restore();
}

function drawHazardIndicator() {
  if (!hazardEvent) return;
  const eventColors = { meteor: "#ff9f40", solar: "#ffcf70", moon: "#aad4ff", gravity: "#ff6e7b" };
  const eventLabels = { meteor: "Meteor Shower", solar: "Solar Flare", moon: "Rogue Moon", gravity: "Gravity Surge" };
  const color = eventColors[hazardEvent.type] || "#fff";
  const label = eventLabels[hazardEvent.type] || hazardEvent.type;
  const timeLeft = Math.ceil(hazardEvent.timeLeft);
  const barW = 160;
  const barH = 6;
  const px = w / 2 - barW / 2;
  const py = 68;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(px - 8, py - 18, barW + 16, barH + 28);
  ctx.fillStyle = color;
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${label} — ${timeLeft}s`, w / 2, py - 14);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(px, py, barW, barH);
  ctx.fillStyle = color;
  ctx.fillRect(px, py, barW * (hazardEvent.timeLeft / hazardEvent.maxTime), barH);
  ctx.restore();
}

function updateHud() {
  els.level.textContent = `${level}/${TOTAL_LEVELS}`;
  els.timer.textContent = bossActive ? "CATAS" : Math.max(0, Math.ceil(levelClock));
  els.score.textContent = score;
  els.lostCountry.textContent = lostCountry;
  els.damageBar.style.width = `${clamp(damage, 0, 100)}%`;
  els.starnetCount.textContent = starnet;
  if (blasterDisabled) {
    els.blasterCooldown.textContent = "Flare!";
  } else {
    els.blasterCooldown.textContent = blasterCooldown <= 0 ? "Ready" : `${blasterCooldown.toFixed(1)}s`;
  }
  els.blasterBtn.disabled = blasterDisabled || (blasterCooldown > 0 && selectedWeapon !== "blaster");
  els.blasterBtn.classList.toggle("ready", blasterCooldown <= 0 && !blasterDisabled);
  els.starnetBtn.disabled = starnet <= 0;
}

function selectWeapon(type) {
  selectedWeapon = type;
  els.deflectorBtn.classList.toggle("active", type === "deflector");
  els.blasterBtn.classList.toggle("active", type === "blaster");
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
shell.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button") || els.overlay.classList.contains("show")) return;
  shoot(event.clientX, event.clientY);
});
els.deflectorBtn.addEventListener("click", () => selectWeapon("deflector"));
els.blasterBtn.addEventListener("click", () => selectWeapon("blaster"));
els.starnetBtn.addEventListener("click", useStarnet);
els.friendlyFireBtn.addEventListener("click", () => {
  friendlyFire = !friendlyFire;
  updateHud();
});
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function updateFullscreenIcons() {
  const icon = document.fullscreenElement ? "✕" : "⛶";
  if (els.fullscreenBtn) els.fullscreenBtn.textContent = icon;
  if (els.fullscreenHudBtn) els.fullscreenHudBtn.textContent = icon;
}

document.addEventListener("fullscreenchange", updateFullscreenIcons);

els.startBtn.addEventListener("click", resetGame);

els.tutorialBtn.addEventListener("click", () => {
  els.overlay.classList.remove("show");
  els.tutorialOverlay.classList.add("show");
});

els.tutCloseBtn.addEventListener("click", () => {
  els.tutorialOverlay.classList.remove("show");
  els.overlay.classList.add("show");
});

els.tutBackBtn.addEventListener("click", () => {
  els.tutorialOverlay.classList.remove("show");
  els.overlay.classList.add("show");
});

els.tutPlayBtn.addEventListener("click", () => {
  els.tutorialOverlay.classList.remove("show");
  resetGame();
});

els.fullscreenBtn.addEventListener("click", toggleFullscreen);
els.fullscreenHudBtn.addEventListener("click", toggleFullscreen);

function rockThreatScore(rock) {
  const d = Math.hypot(rock.x - earth.x, rock.y - earth.y);
  const proximityDanger = Math.max(0, 1 - d / (earth.r * 3.5)) * 50;
  const damage = (ROCK_DAMAGE[Math.min(rock.level, 5)] / 35) * 25;
  const speed = Math.min(Math.hypot(rock.vx, rock.vy) / 500, 1) * 15;
  const typeBonus = { comet: 12, armored: 8, magnetic: 6, boss: 30 }[rock.rockType] || 0;
  return proximityDanger + damage + speed + typeBonus;
}

function fireMoonLaser() {
  const range = starnetRange();
  let best = null, bestScore = -Infinity;

  // Target rocks using deflector logic: skip healing and boss
  for (const rock of rocks) {
    if (rock.cleared || rock.rockType === "healing" || rock.rockType === "boss") continue;
    const d = Math.hypot(rock.x - earth.x, rock.y - earth.y);
    if (d > range) continue;
    const tx = rock.x, ty = rock.y;
    const moonBlocked = moonBlockedForTarget(tx, ty) || lineIntersectsEarth(moon, tx, ty, earth.r * 0.92);
    if (moonBlocked) continue;

    const s = rockThreatScore(rock);
    if (s > bestScore) { bestScore = s; best = rock; }
  }

  if (!best) return;

  // Laser originates from moon surface pointing toward target
  const dir = norm(best.x - moon.x, best.y - moon.y);
  const origin = { x: moon.x + dir.x * moon.r, y: moon.y + dir.y * moon.r };

  lasers.push({ x1: origin.x, y1: origin.y, x2: best.x, y2: best.y, life: 0.14, maxLife: 0.14, fromMoon: true });
  hitRock(best, { x: origin.x, y: origin.y, vx: 0, vy: 0, type: "deflector" });
}

function autoAttack(weaponType) {
  if (!running) return;

  const onScreen = rocks.filter(r =>
    !r.cleared && r.rockType !== "healing" && r.x > 0 && r.x < w && r.y > 0 && r.y < h
  );

  let targets;
  switch (autoAttackMode) {
    case "special":
      targets = onScreen.filter(r => r.rockType !== "normal");
      break;
    case "closest":
      targets = [...onScreen].sort((a, b) =>
        Math.hypot(a.x - earth.x, a.y - earth.y) - Math.hypot(b.x - earth.x, b.y - earth.y)
      );
      break;
    case "damage":
      targets = [...onScreen].sort((a, b) =>
        (ROCK_DAMAGE[Math.min(b.level, 5)] || 0) - (ROCK_DAMAGE[Math.min(a.level, 5)] || 0)
      );
      break;
    case "fastest":
      targets = [...onScreen].sort((a, b) =>
        Math.hypot(b.vx, b.vy) - Math.hypot(a.vx, a.vy)
      );
      break;
    default: // auto
      targets = [...onScreen].sort((a, b) => rockThreatScore(b) - rockThreatScore(a));
  }

  if (!targets.length) return;

  if (weaponType === "deflector") {
    for (const rock of targets) {
      if (rock.rockType === "boss") continue;
      const tx = rock.x, ty = rock.y;
      const moonBlocked = moonBlockedForTarget(tx, ty) || lineIntersectsEarth(moon, tx, ty, earth.r * 0.92);
      if (moonBlocked) continue;
      shoot(tx, ty);
      return;
    }
  }

  if (weaponType === "blaster") {
    if (blasterDisabled || blasterCooldown > 0) return;
    for (const rock of targets) {
      const tx = rock.x, ty = rock.y;
      if (!friendlyFire && lineIntersectsEarth(satellite, tx, ty, earth.r * 0.96)) continue;
      fireLaser(tx, ty);
      return;
    }
  }
}

window.addEventListener("keydown", (event) => {
  if (event.key === "1") { selectWeapon("deflector"); autoAttack("deflector"); }
  if (event.key === "2") { selectWeapon("blaster"); autoAttack("blaster"); }
  if (event.key === "3" || event.key.toLowerCase() === "s") useStarnet();
  if (event.code === "Space") {
    event.preventDefault();
    if (running) useStarnet();
    else resetGame();
  }
});

els.autoModeBtn.addEventListener("click", () => {
  const idx = AUTO_ATTACK_MODES.indexOf(autoAttackMode);
  autoAttackMode = AUTO_ATTACK_MODES[(idx + 1) % AUTO_ATTACK_MODES.length];
  els.autoModeLabel.textContent = AUTO_ATTACK_LABELS[autoAttackMode];
});

els.autoModeLabel.textContent = AUTO_ATTACK_LABELS[autoAttackMode];

// Initialize friendly fire button state
els.friendlyFireState.textContent = friendlyFire ? "On" : "Off";
els.friendlyFireBtn.classList.toggle("on", friendlyFire);
els.friendlyFireBtn.classList.toggle("off", !friendlyFire);

resize();
updateMoon(0);
requestAnimationFrame(frame);
