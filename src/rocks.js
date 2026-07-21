import { TAU, ROCK_DAMAGE, MAGNETIC_PULL_RADIUS, MAGNETIC_PULL_STRENGTH } from "./constants.js";
import { clamp, rand, norm } from "./utils.js";
import { state } from "./state.js";
import { gravityAt, integrateRock, deflectionRange, lineIntersectsEarth } from "./physics.js";
import { starnetRange, addEarthDamage } from "./world.js";
import { addBurst, addCometTrail, addStarnetShock } from "./render.js";

function chooseRockType() {
  const r = Math.random();
  if (state.level >= 3 && r < 0.07) return "healing";
  if (state.level >= 2 && r < 0.17) return "comet";
  const activeArmored = state.rocks.filter(rock => !rock.cleared && rock.rockType === "armored").length;
  if (state.level >= 3 && activeArmored === 0 && r < 0.28) return "armored";
  if (state.level >= 4 && r < 0.38) return "magnetic";
  return "normal";
}

export function spawnRock(forcedLevel, forcedType) {
  const maxRockLevel = Math.min(Math.ceil(state.level * 0.55), 5);
  const rockLevel = forcedLevel || clamp(Math.ceil(rand(0, maxRockLevel + 0.9)), 1, maxRockLevel);
  const rockType = forcedType || chooseRockType(rockLevel);

  let pos;
  let targetAngle;
  let target;
  const spiral = rockLevel < 5 && rockType === "normal" && Math.random() < 0.26;

  if (rockLevel === 5) {
    const side = Math.random() < 0.5 ? -1 : 1;
    pos = {
      x: side < 0 ? -state.earth.r : state.w + state.earth.r,
      y: rand(state.h * 0.18, state.h * 0.82),
    };
    const earthPath = Math.random() < 0.5;
    target = earthPath
      ? { x: state.earth.x + rand(-state.earth.r * 0.32, state.earth.r * 0.32), y: state.earth.y + rand(-state.earth.r * 0.32, state.earth.r * 0.32) }
      : { x: state.earth.x + rand(-state.moon.orbit * 0.62, state.moon.orbit * 0.62), y: state.earth.y + rand(-state.moon.orbit * 0.62, state.moon.orbit * 0.62) };
    targetAngle = Math.atan2(target.y - pos.y, target.x - pos.x) + rand(-0.14, 0.14);
  } else {
    let angle;
    do { angle = rand(0, TAU); } while (
      (angle > Math.PI * 3 / 8 && angle < Math.PI * 5 / 8) ||
      (angle > Math.PI * 11 / 8 && angle < Math.PI * 13 / 8)
    );
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const margin = 24;
    const candidates = [];
    if (dir.x > 1e-6) candidates.push((state.w - state.earth.x - margin) / dir.x);
    if (dir.x < -1e-6) candidates.push((margin - state.earth.x) / dir.x);
    if (dir.y > 1e-6) candidates.push((state.h - state.earth.y - margin) / dir.y);
    if (dir.y < -1e-6) candidates.push((margin - state.earth.y) / dir.y);
    const edgeDist = Math.min(...candidates.filter(d => d > 0));
    pos = {
      x: state.earth.x + dir.x * (edgeDist + margin),
      y: state.earth.y + dir.y * (edgeDist + margin),
    };
    const earthPath = Math.random() < 0.41;
    target = earthPath
      ? { x: state.earth.x + rand(-state.earth.r * 0.62, state.earth.r * 0.62), y: state.earth.y + rand(-state.earth.r * 0.62, state.earth.r * 0.62) }
      : { x: state.earth.x + rand(-state.moon.orbit * 0.38, state.moon.orbit * 0.38), y: state.earth.y + rand(-state.moon.orbit * 0.38, state.moon.orbit * 0.38) };
    targetAngle = Math.atan2(target.y - pos.y, target.x - pos.x) + rand(-0.18, 0.18);
  }

  const baseSpeed = 32 + state.level * 16 + rockLevel * 8;
  let velocity;

  if (spiral && rockType === "normal") {
    const inward = norm(state.earth.x - pos.x, state.earth.y - pos.y);
    const turn = Math.random() < 0.5 ? -1 : 1;
    const tangent = { x: -inward.y * turn, y: inward.x * turn };
    velocity = {
      x: tangent.x * (125 + state.level * 18) + inward.x * (28 + state.level * 8),
      y: tangent.y * (125 + state.level * 18) + inward.y * (28 + state.level * 8),
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
  state.rocks.push(newRock);
  if (rockType === "magnetic") spawnMagneticCompanions(newRock);
}

export function spawnMagneticCompanions(magRock) {
  const count = 2 + Math.floor(Math.random() * 2);
  const companionLevel = Math.max(1, magRock.level - 1);
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, TAU);
    const offset = rand(magRock.r * 2.5, magRock.r * 5.5);
    const fr = 7 + companionLevel * 4;
    state.rocks.push({
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

export function spawnBoss() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const pos = {
    x: side < 0 ? -state.earth.r * 1.5 : state.w + state.earth.r * 1.5,
    y: state.earth.y + rand(-state.earth.r * 0.5, state.earth.r * 0.5),
  };
  const dir = norm(state.earth.x - pos.x, state.earth.y - pos.y);
  const speed = 8 + state.level * 1.5;
  const bossR = state.earth.r * 0.42;
  const companions = [];
  for (let i = 0; i < 3; i += 1) {
    companions.push({
      angle: (i / 3) * TAU,
      radius: 58 + i * 24,
      speed: 0.85 + i * 0.35,
      seed: Math.random() * 999,
      size: 7 + i * 3,
    });
  }
  const cometSlots = state.level >= 10 ? [
    { angle: rand(0, TAU),           radius: bossR * 2.0, speed: -1.15, seed: Math.random() * 999 },
    { angle: rand(0, TAU) + Math.PI, radius: bossR * 2.7, speed: -0.82, seed: Math.random() * 999 },
  ] : null;
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
    cracked: false,
    companions,
    cometSlots,
  });
}

function releaseBoundComets(rock) {
  if (!rock.cometSlots) return;
  for (const c of rock.cometSlots) {
    const cx = rock.x + Math.cos(c.angle) * c.radius;
    const cy = rock.y + Math.sin(c.angle) * c.radius;
    const sign = Math.sign(c.speed) || 1;
    const tx = -Math.sin(c.angle) * sign;
    const ty =  Math.cos(c.angle) * sign;
    const cometSpeed = 260 + Math.abs(c.speed) * c.radius * 0.6;
    state.rocks.push({
      x: cx, y: cy,
      vx: tx * cometSpeed + rock.vx * 0.4,
      vy: ty * cometSpeed + rock.vy * 0.4,
      level: 1,
      rockType: "comet",
      breakCount: 0,
      r: 8,
      seed: Math.random() * 999,
      cleared: false,
      deflected: false,
      spiral: false,
      enteredArena: true,
      earthSeeking: false,
      path: [],
      pathClock: 0,
      armorHits: 0,
      deflectorHits: 0,
      cracked: false,
    });
  }
}

export function updateCatastropheCompanions(dt) {
  for (const rock of state.rocks) {
    if (rock.cleared || rock.rockType !== "boss") continue;
    if (rock.companions) {
      for (const c of rock.companions) c.angle += c.speed * dt;
    }
    if (rock.cometSlots) {
      for (const c of rock.cometSlots) c.angle += c.speed * dt;
    }
  }
}

export function predictPath(rock) {
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
    if (Math.hypot(ghost.x - state.earth.x, ghost.y - state.earth.y) < state.earth.r) break;
    if (Math.hypot(ghost.x - state.moon.x, ghost.y - state.moon.y) < state.moon.r) break;
  }
  rock.path = pts;
}

export function clearRock(rock, destroyed, earthImpact = false) {
  if (rock.cleared) return;
  rock.cleared = true;
  if (!earthImpact) {
    const successfulDeflection = !destroyed && rock.deflected;
    if (rock.rockType !== "healing" && rock.rockType !== "boss") {
      const pts = destroyed ? rock.level * 75 : successfulDeflection ? rock.level * 40 : 0;
      state.score += pts;
      if (destroyed || successfulDeflection) {
        state.hitsCleared += 1;
        if (state.hitsCleared % 4 === 0) state.starnet += 1;
      }
      if (pts > 0 && rock.rockType !== "comet") {
        state.floatingTexts.push({ x: rock.x, y: rock.y - rock.r - 5, text: `+${pts}`, life: 1.2, maxLife: 1.2, vy: -40, color: destroyed ? "#ffcf70" : "#8ff0b2" });
      }
    }
    if (!state.tutorialMode) {
      const s = state.rockStats[rock.rockType];
      if (s) {
        if (rock.rockType === "healing") { if (destroyed) s.captured += 1; }
        else if (rock.rockType === "boss") { if (destroyed) s.destroyed += 1; }
        else if (destroyed) s.destroyed += 1;
        else if (successfulDeflection) s.deflected += 1;
      }
    }
  }
  addBurst(rock.x, rock.y, destroyed ? "#ffcf70" : "#8ff0b2", 16 + rock.level * 4);
}

export function markArenaState(rock) {
  const hm = rock.r * 2;
  if (rock.x > state.arenaLeft - hm && rock.x < state.arenaRight + hm &&
      rock.y > -hm && rock.y < state.h + hm) {
    rock.enteredArena = true;
  }
}

export function isOutsideArena(rock) {
  const margin = Math.max(90, rock.r * 5);
  const offScreen = rock.x < -margin || rock.x > state.w + margin || rock.y < -margin || rock.y > state.h + margin;
  return rock.enteredArena && offScreen && Math.hypot(rock.x - state.earth.x, rock.y - state.earth.y) > deflectionRange();
}

export function bounceFromMoon(rock) {
  const away = norm(rock.x - state.moon.x, rock.y - state.moon.y);
  const speed = Math.max(140, Math.hypot(rock.vx, rock.vy));
  rock.x = state.moon.x + away.x * (state.moon.r + rock.r + 3);
  rock.y = state.moon.y + away.y * (state.moon.r + rock.r + 3);
  rock.vx = away.x * speed + state.moon.speed * state.moon.orbit * -Math.sin(state.moon.angle) * 0.2;
  rock.vy = away.y * speed + state.moon.speed * state.moon.orbit * Math.cos(state.moon.angle) * 0.2;
  rock.pathClock = 0;
  addBurst(rock.x, rock.y, "#cfd6d4", 8);
  state.moonShieldLife = 0.55;
}

export function applyMagneticPull(dt) {
  for (const magRock of state.rocks) {
    if (magRock.cleared || magRock.rockType !== "magnetic") continue;
    for (const other of state.rocks) {
      if (other.cleared || other === magRock || other.rockType === "magnetic" || other.rockType === "boss") continue;
      const dx = magRock.x - other.x;
      const dy = magRock.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d < MAGNETIC_PULL_RADIUS && d > 1) {
        const fieldFrac = 1 - d / MAGNETIC_PULL_RADIUS;
        const pull = MAGNETIC_PULL_STRENGTH * dt * fieldFrac;
        other.vx += (dx / d) * pull;
        other.vy += (dy / d) * pull;

        const approach = (other.vx * dx + other.vy * dy) / d;
        if (approach > 80) {
          const brake = approach * 0.3 * dt * fieldFrac;
          other.vx -= (dx / d) * brake;
          other.vy -= (dy / d) * brake;
        }

        if (pull > 0.15 && Math.random() < 0.07) {
          state.particles.push({
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

export function hitRock(rock, projectile) {
  if (rock.rockType === "comet") {
    state.score += 150;
    state.floatingTexts.push({ x: rock.x, y: rock.y - rock.r - 5, text: "+150", life: 1.4, maxLife: 1.4, vy: -55, color: "#88eeff" });
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
      const penalty = 15;
      state.score = Math.max(0, state.score - penalty);
      state.floatingTexts.push({ x: rock.x, y: rock.y - rock.r - 5, text: `-${penalty}`, life: 1.2, maxLife: 1.2, vy: -40, color: "#ff9944" });
      addBurst(rock.x, rock.y, "#44ff88", 8);
    } else {
      const penalty = 50;
      state.score = Math.max(0, state.score - penalty);
      state.floatingTexts.push({ x: rock.x, y: rock.y - rock.r - 5, text: `-${penalty}`, life: 1.2, maxLife: 1.2, vy: -40, color: "#ff6644" });
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
        rock.armorHits += 1;
        rock.cracked = true;
        state.shake = 0.22;
        rock.vx += impulse.x * 80;
        rock.vy += impulse.y * 80;
        addBurst(rock.x, rock.y, "#ffcf70", 16);
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.vx = -impulse.x * speed;
        projectile.vy = -impulse.y * speed;
        projectile.bounced = true;
      }
      return;
    }
    rock.armorHits += 1;
    if (rock.armorHits >= 2) {
      clearRock(rock, true);
    } else {
      rock.cracked = true;
      state.shake = 0.22;
      addBurst(rock.x, rock.y, "#ffcf70", 16);
    }
    return;
  }

  if (rock.rockType === "boss") {
    if (projectile.type === "deflector") {
      addBurst(rock.x, rock.y, "#aaa", 6);
      return;
    }
    state.shake = 0.35;
    if (rock.cracked) {
      releaseBoundComets(rock);
      state.score += 500;
      state.floatingTexts.push({ x: rock.x, y: rock.y - rock.r - 10, text: "+500", life: 1.8, maxLife: 1.8, vy: -45, color: "#cc44ff" });
      state.starnet += 3;
      state.bossActive = false;
      state.levelClock = 5;
      state.hazardBanner = { text: "CATASTROPHE AVERTED! +3 Starnet — Next level in 5s", timeLeft: 3.5 };
      clearRock(rock, true);
    } else {
      rock.armorHits += 1;
      spawnRock(Math.max(1, Math.floor(rock.level / 2)));
      if (rock.armorHits >= 2) {
        rock.cracked = true;
        addBurst(rock.x, rock.y, "#cc88ff", 22);
      } else {
        addBurst(rock.x, rock.y, "#9966cc", 14);
      }
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
  const splitPts = 30 * rock.level;
  state.score += splitPts;
  state.floatingTexts.push({ x: rock.x, y: rock.y - rock.r - 5, text: `+${splitPts}`, life: 1.2, maxLife: 1.2, vy: -40, color: "#ffcf70" });
  addBurst(rock.x, rock.y, "#ffcf70", 22);
  const earthward = norm(state.earth.x - rock.x, state.earth.y - rock.y);
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
    state.rocks.push({
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

export function applyStarnetField(rock) {
  if (state.starnetRingLife <= 0 || rock.cleared) return;
  const range = starnetRange();
  const d = Math.hypot(rock.x - state.earth.x, rock.y - state.earth.y);

  if (rock.starnetActivationId !== state.starnetActivationId) {
    rock.starnetActivationId = state.starnetActivationId;
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

export function destroyWithStarnet(rock) {
  if (rock.rockType === "healing") {
    captureHealingRock(rock);
    return;
  }
  if ((rock.rockType === "armored" || rock.rockType === "boss") && !rock.cracked) {
    if (!rock.starnetHit) {
      rock.armorHits = (rock.armorHits || 0) + 1;
      const crackAt = rock.rockType === "boss" ? 2 : 1;
      if (rock.armorHits >= crackAt) rock.cracked = true;
      const away = norm(rock.x - state.earth.x, rock.y - state.earth.y);
      rock.vx = rock.vx * 0.25 + away.x * 130;
      rock.vy = rock.vy * 0.25 + away.y * 130;
      rock.earthSeeking = true;
      rock.pathClock = 0;
      rock.starnetHit = true;
      addBurst(rock.x, rock.y, "#72e6ff", 8);
      addStarnetShock(rock);
    }
    return;
  }
  if (rock.rockType === "boss") {
    releaseBoundComets(rock);
    state.score += 500;
    state.floatingTexts.push({ x: rock.x, y: rock.y - rock.r - 10, text: "+500", life: 1.8, maxLife: 1.8, vy: -45, color: "#cc44ff" });
    state.starnet += 3;
    state.bossActive = false;
    state.levelClock = 5;
    state.hazardBanner = { text: "CATASTROPHE AVERTED! +3 Starnet — Next level in 5s", timeLeft: 3.5 };
  }
  addStarnetShock(rock);
  clearRock(rock, true);
}

function captureHealingRock(rock) {
  const healed = state.damage * 0.33;
  state.damage = Math.max(0, state.damage - healed);
  rock.cleared = true;
  if (!state.tutorialMode && state.rockStats.healing) state.rockStats.healing.captured += 1;
  state.floatingTexts.push({ x: rock.x, y: rock.y - rock.r - 5, text: "Earth +33% HP", life: 1.8, maxLife: 1.8, vy: -35, color: "#44ff88" });
  addBurst(rock.x, rock.y, "#44ff88", 32);
  state.hazardBanner = { text: `Healing Rock captured! Earth healed 33%`, timeLeft: 2.5 };
}

function deflectWithStarnet(rock, distanceFromEarth) {
  const uncracked = (rock.rockType === "armored" || rock.rockType === "boss") && !rock.cracked;
  if (uncracked) {
    if (!rock.starnetHit) {
      rock.armorHits = (rock.armorHits || 0) + 1;
      const crackAt = rock.rockType === "boss" ? 2 : 1;
      if (rock.armorHits >= crackAt) rock.cracked = true;
      const away = norm(rock.x - state.earth.x, rock.y - state.earth.y);
      rock.vx = rock.vx * 0.25 + away.x * 130;
      rock.vy = rock.vy * 0.25 + away.y * 130;
      rock.earthSeeking = true;
      rock.pathClock = 0;
      rock.starnetHit = true;
      addBurst(rock.x, rock.y, "#72e6ff", 8);
      addStarnetShock(rock);
    }
    return;
  }
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
