import { TAU, EARTH_MASS, MOON_MASS, EARTH_TEXTURE_URL } from "./constants.js";
import { clamp, rand, positiveMod } from "./utils.js";
import { canvas, ctx, state } from "./state.js";

export function starnetRange() {
  return state.earth.r + (state.moon.orbit - state.earth.r) * 0.5;
}

export function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.floor(state.w * state.dpr);
  canvas.height = Math.floor(state.h * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  const shortSide = Math.min(state.w, state.h);
  state.earth = {
    x: state.w * 0.5,
    y: state.h * 0.52,
    r: clamp(shortSide * 0.21, 96, 190),
  };
  state.moon = {
    orbit: state.earth.r * 1.82,
    r: Math.max(13, state.earth.r * 0.19),
    angle: -Math.PI / 2,
    speed: 0.42,
    x: 0,
    y: 0,
  };
  state.satellite = {
    orbit: starnetRange() + Math.max(18, state.earth.r * 0.12),
    r: Math.max(8, state.earth.r * 0.055),
    angle: state.moon.angle + state.satelliteOffset,
    x: 0,
    y: 0,
  };
  state.moonCraters = Array.from({ length: 5 }, (_, i) => ({
    x: Math.cos(i * 1.8) * state.moon.r * 0.38,
    y: Math.sin(i * 2.1) * state.moon.r * 0.36,
    r: state.moon.r * rand(0.08, 0.15),
  }));
  state.stars = Array.from({ length: Math.floor((state.w * state.h) / 9000) }, () => ({
    x: Math.random() * state.w,
    y: Math.random() * state.h,
    r: rand(0.4, 1.6),
    a: rand(0.3, 0.95),
  }));
}

export function updateMoon(dt) {
  state.moon.angle += state.moon.speed * state.moonSpeedMultiplier * dt;
  state.moon.x = state.earth.x + Math.cos(state.moon.angle) * state.moon.orbit;
  state.moon.y = state.earth.y + Math.sin(state.moon.angle) * state.moon.orbit;
  state.satellite.orbit = starnetRange() + Math.max(18, state.earth.r * 0.12);
  state.satellite.angle = state.moon.angle + state.satelliteOffset;
  state.satellite.x = state.earth.x + Math.cos(state.satellite.angle) * state.satellite.orbit;
  state.satellite.y = state.earth.y + Math.sin(state.satellite.angle) * state.satellite.orbit;
}

function cacheEarthTexture() {
  try {
    const tex = document.createElement("canvas");
    tex.width = 1024;
    tex.height = 512;
    const texCtx = tex.getContext("2d", { willReadFrequently: true });
    texCtx.drawImage(earthTexture, 0, 0, tex.width, tex.height);
    state.earthTextureData = {
      width: tex.width,
      height: tex.height,
      data: texCtx.getImageData(0, 0, tex.width, tex.height).data,
    };
  } catch (error) {
    state.earthTextureData = null;
  }
}

export const earthTexture = new Image();
earthTexture.crossOrigin = "anonymous";
earthTexture.onload = () => { state.earthTextureReady = true; cacheEarthTexture(); };
earthTexture.onerror = () => { state.earthTextureReady = false; };
earthTexture.src = EARTH_TEXTURE_URL;

export function normalizeLon(lon) {
  return Math.atan2(Math.sin(lon), Math.cos(lon));
}

export function geoToScreen(lat, lon) {
  const relLon = normalizeLon(lon + state.earthSpin);
  const cosLat = Math.cos(lat);
  const z = cosLat * Math.cos(relLon);
  if (z <= 0) return null;
  return {
    x: state.earth.x + state.earth.r * cosLat * Math.sin(relLon),
    y: state.earth.y - state.earth.r * Math.sin(lat),
    z,
  };
}

export function screenToGeo(x, y) {
  const nx = clamp((x - state.earth.x) / state.earth.r, -0.98, 0.98);
  const ny = clamp((y - state.earth.y) / state.earth.r, -0.98, 0.98);
  const z = Math.sqrt(Math.max(0.001, 1 - nx * nx - ny * ny));
  return {
    lat: Math.asin(-ny),
    lon: normalizeLon(Math.atan2(nx, z) - state.earthSpin),
  };
}

export function countryAt(latRad, lonRad) {
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

export function isOceanHit(rock) {
  const lon = Math.atan2(rock.y - state.earth.y, rock.x - state.earth.x) - state.earthSpin;
  const latWave = Math.sin(lon * 2.3) + Math.cos(lon * 4.2 + 1.1) * 0.55;
  return latWave < 0.12;
}

export function repeatedHitFactor(rock) {
  const angle = Math.atan2(rock.y - state.earth.y, rock.x - state.earth.x) - state.earthSpin;
  let factor = 1;
  for (const hit of state.impactMemory) {
    const delta = Math.abs(Math.atan2(Math.sin(angle - hit.angle), Math.cos(angle - hit.angle)));
    if (delta < 0.28) factor *= 0.55;
  }
  state.impactMemory.push({ angle, ttl: 18 });
  return clamp(factor, 0.22, 1);
}

export function registerImpact(rock, actualDamage) {
  const geo = screenToGeo(rock.x, rock.y);
  const country = countryAt(geo.lat, geo.lon);
  state.lostCountry = country;
  state.lostCountries.add(country);
  state.burnSites.push({
    lat: geo.lat,
    lon: geo.lon,
    country,
    intensity: clamp(actualDamage / 15, 0.35, 2.2),
    born: performance.now(),
  });
  if (state.burnSites.length > 26) state.burnSites.shift();
}

export function addEarthDamage(amount, rock) {
  const oceanFactor = isOceanHit(rock) ? 0.25 : 1;
  const repeatedFactor = repeatedHitFactor(rock);
  const actualDamage = amount * oceanFactor * repeatedFactor;
  state.damage += actualDamage;
  registerImpact(rock, actualDamage);
  while (state.damage >= state.nextDamageStarnet && state.nextDamageStarnet <= 100) {
    state.starnet += 1;
    state.nextDamageStarnet += 10;
  }
  state.shake = 0.35;
}
