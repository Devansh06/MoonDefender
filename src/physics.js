import { G, EARTH_MASS, MOON_MASS, PHYSICS_SUBSTEPS } from "./constants.js";
import { clamp, norm } from "./utils.js";
import { state } from "./state.js";

export function deflectionRange() {
  return state.moon.orbit * 2;
}

export function gravityAt(pos) {
  const bodies = [
    { x: state.earth.x, y: state.earth.y, mass: EARTH_MASS },
    { x: state.moon.x,  y: state.moon.y,  mass: MOON_MASS  },
  ];
  let ax = 0, ay = 0;
  for (const body of bodies) {
    const dx = body.x - pos.x;
    const dy = body.y - pos.y;
    const r2 = Math.max(900, dx * dx + dy * dy);
    const invR = 1 / Math.sqrt(r2);
    const force = (G * state.gravityMultiplier * body.mass) / r2;
    ax += dx * invR * force;
    ay += dy * invR * force;
  }
  return { x: ax, y: ay };
}

export function integrateRock(rock, dt) {
  const step = dt / PHYSICS_SUBSTEPS;
  for (let i = 0; i < PHYSICS_SUBSTEPS; i += 1) {
    const a = gravityAt(rock);
    rock.vx += a.x * step;
    rock.vy += a.y * step;
    if (rock.earthSeeking) {
      const toward = norm(state.earth.x - rock.x, state.earth.y - rock.y);
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

export function resolveRockCollisions() {
  for (let i = 0; i < state.rocks.length; i += 1) {
    const a = state.rocks[i];
    if (a.cleared || a.rockType === "boss") continue;
    for (let j = i + 1; j < state.rocks.length; j += 1) {
      const b = state.rocks[j];
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

export function closestPointOnSegment(a, b, p) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { point, t, distance: Math.hypot(p.x - point.x, p.y - point.y) };
}

export function lineIntersectsEarth(origin, targetX, targetY, radius) {
  const closest = closestPointOnSegment(origin, { x: targetX, y: targetY }, state.earth);
  if (closest.distance > radius) return null;
  return closest.point;
}

export function moonBlockedForTarget(targetX, targetY) {
  const target = norm(targetX - state.earth.x, targetY - state.earth.y);
  const moonSide = norm(state.moon.x - state.earth.x, state.moon.y - state.earth.y);
  return target.x * moonSide.x + target.y * moonSide.y < -0.18;
}

export function laserScreenEdge(start, dirX, dirY) {
  let tMin = Infinity;
  if (dirX > 0) tMin = Math.min(tMin, (state.w - start.x) / dirX);
  else if (dirX < 0) tMin = Math.min(tMin, -start.x / dirX);
  if (dirY > 0) tMin = Math.min(tMin, (state.h - start.y) / dirY);
  else if (dirY < 0) tMin = Math.min(tMin, -start.y / dirY);
  if (!isFinite(tMin)) tMin = 1;
  return { x: start.x + dirX * tMin, y: start.y + dirY * tMin };
}
