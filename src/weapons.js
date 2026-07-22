import { TAU, BLASTER_REFILL, ROCK_DAMAGE, AUTO_ATTACK_MODES } from "./constants.js";
import { clamp, norm } from "./utils.js";
import { els, state } from "./state.js";
import { lineIntersectsEarth, moonBlockedForTarget, closestPointOnSegment, laserScreenEdge } from "./physics.js";
import { starnetRange, addEarthDamage } from "./world.js";
import { hitRock, clearRock, destroyWithStarnet } from "./rocks.js";
import { addBurst } from "./render.js";

function rockThreatScore(rock) {
  const d = Math.hypot(rock.x - state.earth.x, rock.y - state.earth.y);
  const proximityDanger = Math.max(0, 1 - d / (state.earth.r * 3.5)) * 50;
  const dmg = (ROCK_DAMAGE[Math.min(rock.level, 5)] / 35) * 25;
  const speed = Math.min(Math.hypot(rock.vx, rock.vy) / 500, 1) * 15;
  const typeBonus = { comet: 12, armored: 8, magnetic: 6, boss: 30 }[rock.rockType] || 0;
  return proximityDanger + dmg + speed + typeBonus;
}

export function shoot(targetX, targetY) {
  if (!state.running) return;

  const shot = chooseShot(targetX, targetY);
  if (!shot) return;
  if (shot.type === "blaster") {
    fireLaser(targetX, targetY);
    return;
  }

  const { type, origin } = shot;
  const dir = norm(targetX - origin.x, targetY - origin.y);
  if (!state.tutorialMode) state.totalShots += 1;
  state.projectiles.push({
    x: origin.x + dir.x * (origin.r + 4),
    y: origin.y + dir.y * (origin.r + 4),
    vx: dir.x * 560,
    vy: dir.y * 560,
    r: 4,
    type,
    life: 1.9,
    hit: false,
  });
  if (type === "deflector") state.moonPulse = 0.4;
}

function chooseShot(targetX, targetY) {
  const moonBlocked = moonBlockedForTarget(targetX, targetY) || lineIntersectsEarth(state.moon, targetX, targetY, state.earth.r * 0.92);
  const blasterLocked = Boolean(els.blasterBtn?.dataset.tutLocked);
  const deflectorLocked = Boolean(els.deflectorBtn?.dataset.tutLocked);

  if (!blasterLocked && !state.blasterDisabled && state.blasterCooldown <= 0 && moonBlocked) {
    if (state.friendlyFire || !lineIntersectsEarth(state.satellite, targetX, targetY, state.earth.r * 0.96)) {
      return { type: "blaster", origin: state.satellite };
    }
  }

  if (moonBlocked || deflectorLocked) return null;
  return { type: "deflector", origin: state.moon };
}

export function fireLaser(targetX, targetY) {
  state.blasterCooldown = BLASTER_REFILL;
  const start = { x: state.satellite.x, y: state.satellite.y };
  const dir = norm(targetX - start.x, targetY - start.y);
  const edgeEnd = laserScreenEdge(start, dir.x, dir.y);
  const hits = findAllLaserHits(start, edgeEnd);
  state.lasers.push({ x1: start.x, y1: start.y, x2: edgeEnd.x, y2: edgeEnd.y, life: 0.16, maxLife: 0.16 });
  if (!state.tutorialMode) {
    state.totalShots += 1;
    if (!hits.length) state.missedShots += 1;
  }
  for (const hit of hits) {
    if (hit.rock.cleared) continue;
    hitRock(hit.rock, {
      x: hit.point.x - dir.x * 12,
      y: hit.point.y - dir.y * 12,
      vx: dir.x * 920,
      vy: dir.y * 920,
      type: "blaster",
    });
  }
  if (!hits.length && state.friendlyFire) {
    const earthHit = lineIntersectsEarth(start, edgeEnd.x, edgeEnd.y, state.earth.r);
    if (earthHit) addEarthDamage(3, earthHit);
  }
}

function findAllLaserHits(start, target) {
  const hits = [];
  for (const rock of state.rocks) {
    if (rock.cleared) continue;
    const hit = closestPointOnSegment(start, target, rock);
    if (hit.distance <= rock.r * 1.38) hits.push({ rock, point: hit.point, t: hit.t });
  }
  return hits.sort((a, b) => a.t - b.t);
}

export function applyBlasterHoming(projectile, dt) {
  if (projectile.type !== "blaster") return;
  let target = null;
  let best = Infinity;
  for (const rock of state.rocks) {
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

export function useStarnet() {
  if (els.starnetBtn?.dataset.tutLocked) return;
  if (!state.running) return;
  // Allow early re-activation in the last 0.5s (1.5s after activation) at cost of 2 charges
  const earlyReactivate = state.starnetRingLife > 0 && state.starnetRingLife <= 0.5;
  if (state.starnetRingLife > 0.5) return; // still in first 1.5s window
  const cost = earlyReactivate ? 2 : 1;
  if (state.starnet < cost) return;
  state.starnet -= cost;
  state.starnetRingLife = 2;
  state.starnetActivationId += 1;
  const range = starnetRange();

  for (const rock of state.rocks) {
    if (rock.cleared) continue;
    const d = Math.hypot(rock.x - state.earth.x, rock.y - state.earth.y);
    rock.starnetActivationId = state.starnetActivationId;
    rock.starnetOrigin = d <= range ? "inside" : "outside";
    rock.starnetHit = false;
    rock.lastStarnetDistance = d;
    if (rock.starnetOrigin === "inside") destroyWithStarnet(rock);
  }
}

export function autoAttack(weaponType) {
  if (!state.running) return;

  const onScreen = state.rocks.filter(r =>
    !r.cleared && r.rockType !== "healing" && r.x > 0 && r.x < state.w && r.y > 0 && r.y < state.h
  );

  let targets;
  switch (state.autoAttackMode) {
    case "special":
      targets = onScreen.filter(r => r.rockType !== "normal");
      break;
    case "closest":
      targets = [...onScreen].sort((a, b) =>
        Math.hypot(a.x - state.earth.x, a.y - state.earth.y) - Math.hypot(b.x - state.earth.x, b.y - state.earth.y)
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
    default:
      targets = [...onScreen].sort((a, b) => rockThreatScore(b) - rockThreatScore(a));
  }

  if (!targets.length) return;

  if (weaponType === "deflector") {
    for (const rock of targets) {
      if (rock.rockType === "boss") continue;
      const tx = rock.x, ty = rock.y;
      const moonBlocked = moonBlockedForTarget(tx, ty) || lineIntersectsEarth(state.moon, tx, ty, state.earth.r * 0.92);
      if (moonBlocked) continue;
      shoot(tx, ty);
      return;
    }
  }

  if (weaponType === "blaster") {
    if (state.blasterDisabled || state.blasterCooldown > 0) return;
    for (const rock of targets) {
      const tx = rock.x, ty = rock.y;
      if (!state.friendlyFire && lineIntersectsEarth(state.satellite, tx, ty, state.earth.r * 0.96)) continue;
      fireLaser(tx, ty);
      return;
    }
  }
}
