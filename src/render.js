import { TAU, MAGNETIC_PULL_RADIUS, BLASTER_REFILL } from "./constants.js";
import { clamp, rand } from "./utils.js";
import { ctx, state } from "./state.js";
import { geoToScreen, normalizeLon, starnetRange } from "./world.js";

const earthFrameCanvas = document.createElement("canvas");
const earthFrameCtx = earthFrameCanvas.getContext("2d", { willReadFrequently: true });

export function addBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, TAU);
    const s = rand(40, 190);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.8), color });
  }
}

export function addCometTrail(rock) {
  const speed = Math.hypot(rock.vx, rock.vy) || 1;
  const bx = -rock.vx / speed;
  const by = -rock.vy / speed;
  for (let i = 0; i < 3; i += 1) {
    state.particles.push({
      x: rock.x + bx * rock.r * rand(0.5, 1.8),
      y: rock.y + by * rock.r * rand(0.5, 1.8),
      vx: bx * rand(60, 140) + rand(-15, 15),
      vy: by * rand(60, 140) + rand(-15, 15),
      life: rand(0.1, 0.3),
      color: Math.random() < 0.55 ? "#ffdd88" : "#ff9940",
    });
  }
}

export function addStarnetShock(rock) {
  state.starnetEffects.push({
    x: rock.x,
    y: rock.y,
    r: rock.r,
    life: 0.42,
    maxLife: 0.42,
    seed: Math.random() * TAU,
  });
}

export function draw() {
  ctx.clearRect(0, 0, state.w, state.h);
  const sx = state.shake ? rand(-5, 5) * state.shake : 0;
  const sy = state.shake ? rand(-5, 5) * state.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  drawSpace();
  drawStarnetRangeRing();
  drawPaths();
  drawEarth();
  drawHealthRing();
  drawBurnSites();
  drawStarnetBadge();
  drawSatellite();
  drawMoon();
  drawRocks();
  drawLasers();
  drawProjectiles();
  drawStarnetEffects();
  drawParticles();
  ctx.restore();
  drawIncomingIndicators();
  drawFloatingTexts();
  drawReticle();
  drawHazardBanner();
  drawHazardIndicator();
  drawPauseOverlay();
}

function drawPauseOverlay() {
  if (!state.paused) return;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, 0, state.w, state.h);
  ctx.fillStyle = "#eef7ff";
  ctx.font = "bold 38px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAUSED", state.w / 2, state.h / 2);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#9eb3c6";
  ctx.fillText("press P or Esc to resume", state.w / 2, state.h / 2 + 44);
  ctx.restore();
}

function drawSpace() {
  const gradient = ctx.createRadialGradient(
    state.earth.x, state.earth.y, state.earth.r * 0.6,
    state.earth.x, state.earth.y, Math.max(state.w, state.h) * 0.75
  );
  gradient.addColorStop(0, "#0c1630");
  gradient.addColorStop(1, "#030713");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.w, state.h);
  for (const s of state.stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#eef7ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStarnetRangeRing() {
  const radius = starnetRange();
  const active = state.starnetRingLife > 0;

  if (active) {
    const t = clamp(state.starnetRingLife / 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.10 + t * 0.42;
    ctx.shadowColor = "#72e6ff";
    ctx.shadowBlur = 28;
    ctx.strokeStyle = "#72e6ff";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(state.earth.x, state.earth.y, radius, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.setLineDash([6, 10]);
  ctx.strokeStyle = "rgba(114,230,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(state.earth.x, state.earth.y, radius, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPaths() {
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 7]);
  for (const rock of state.rocks) {
    if (!rock.path.length || rock.rockType === "healing") continue;
    if (rock.rockType === "boss") ctx.strokeStyle = "rgba(170, 80, 255, 0.55)";
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
  if (state.earthTextureReady && state.earthTextureData) {
    drawTexturedEarth();
    return;
  }

  ctx.save();
  ctx.translate(state.earth.x, state.earth.y);
  ctx.beginPath();
  ctx.arc(0, 0, state.earth.r, 0, TAU);
  ctx.clip();

  const ocean = ctx.createRadialGradient(
    -state.earth.r * 0.35, -state.earth.r * 0.35, state.earth.r * 0.2,
    0, 0, state.earth.r
  );
  ocean.addColorStop(0, "#53d8ff");
  ocean.addColorStop(0.58, "#1e76d4");
  ocean.addColorStop(1, "#083276");
  ctx.fillStyle = ocean;
  ctx.fillRect(-state.earth.r, -state.earth.r, state.earth.r * 2, state.earth.r * 2);

  ctx.rotate(state.earthSpin);
  drawContinent(-state.earth.r * 0.22, -state.earth.r * 0.22, 0.85, "#46b579");
  drawContinent(state.earth.r * 0.33, state.earth.r * 0.08, 0.72, "#7ecb70");
  drawContinent(-state.earth.r * 0.52, state.earth.r * 0.33, 0.58, "#8ccb68");
  drawClouds();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(state.earth.x, state.earth.y, state.earth.r, 0, TAU);
  ctx.strokeStyle = "rgba(151, 221, 255, 0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawTexturedEarth() {
  const size = Math.round(clamp(state.earth.r * 2, 180, 320));
  const radius = size / 2;
  if (earthFrameCanvas.width !== size || earthFrameCanvas.height !== size) {
    earthFrameCanvas.width = size;
    earthFrameCanvas.height = size;
  }

  const frame = earthFrameCtx.createImageData(size, size);
  const pixels = frame.data;
  const tex = state.earthTextureData;
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
      const lon = normalizeLon(Math.atan2(nx, z) - state.earthSpin);
      const sx = Math.floor(positiveMod((lon / TAU + 0.5) * tex.width, tex.width));
      const sy = Math.floor(clamp((0.5 - lat / Math.PI) * tex.height, 0, tex.height - 1));
      const src = (sy * tex.width + sx) * 4;
      const limb = clamp(z * 1.18, 0.18, 1);
      const light = clamp(0.42 + z * 0.58 + nx * -0.08 + ny * -0.05, 0.18, 1.08) * limb;
      pixels[out]     = tex.data[src]     * light;
      pixels[out + 1] = tex.data[src + 1] * light;
      pixels[out + 2] = tex.data[src + 2] * light;
      pixels[out + 3] = 255;
    }
  }
  earthFrameCtx.putImageData(frame, 0, 0);
  ctx.drawImage(earthFrameCanvas, state.earth.x - state.earth.r, state.earth.y - state.earth.r, state.earth.r * 2, state.earth.r * 2);

  ctx.beginPath();
  ctx.arc(state.earth.x, state.earth.y, state.earth.r, 0, TAU);
  ctx.strokeStyle = "rgba(151, 221, 255, 0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function positiveMod(value, size) {
  return ((value % size) + size) % size;
}

function drawContinent(x, y, scale, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= 16; i += 1) {
    const a = (i / 16) * TAU;
    const r = state.earth.r * scale * (0.22 + Math.sin(i * 1.7) * 0.035 + Math.cos(i * 2.9) * 0.03);
    const px = x + Math.cos(a) * r * 1.25;
    const py = y + Math.sin(a) * r * 0.75;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.fill();
}

function drawClouds() {
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = Math.max(3, state.earth.r * 0.025);
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, i * state.earth.r * 0.26, state.earth.r * 0.82, state.earth.r * 0.08, 0.25 * i, 0.25, Math.PI * 1.55);
    ctx.stroke();
  }
}

function drawMoon() {
  ctx.save();
  ctx.translate(state.moon.x, state.moon.y);

  if (state.moonShieldLife > 0) {
    const t = state.moonShieldLife / 0.55;
    const expansion = (1 - t) * 16;
    ctx.globalAlpha = t * 0.85;
    ctx.strokeStyle = "#72e6ff";
    ctx.lineWidth = 2 + t * 4;
    ctx.shadowColor = "#72e6ff";
    ctx.shadowBlur = 22 * t;
    ctx.beginPath();
    ctx.arc(0, 0, state.moon.r + 7 + expansion, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  const g = ctx.createRadialGradient(-state.moon.r * 0.35, -state.moon.r * 0.4, 2, 0, 0, state.moon.r);
  g.addColorStop(0, "#f1f2e8");
  g.addColorStop(1, "#8f958f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, state.moon.r, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(40, 44, 48, 0.28)";
  for (const crater of state.moonCraters) {
    ctx.beginPath();
    ctx.arc(crater.x, crater.y, crater.r, 0, TAU);
    ctx.fill();
  }

  const pulseT = state.moonPulse / 0.4;
  const arcAlpha = 0.75 + pulseT * 0.55;
  const arcWidth = 2 + pulseT * 3;
  ctx.strokeStyle = `rgba(114,230,255,${arcAlpha.toFixed(2)})`;
  ctx.lineWidth = arcWidth;
  if (pulseT > 0) {
    ctx.shadowColor = "#72e6ff";
    ctx.shadowBlur = 18 * pulseT;
  }
  ctx.beginPath();
  ctx.arc(0, 0, state.moon.r + 5, 0.15, Math.PI * 1.25);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawSatellite() {
  ctx.save();
  ctx.translate(state.satellite.x, state.satellite.y);
  ctx.rotate(state.satellite.angle + Math.PI / 2);
  ctx.shadowColor = state.blasterDisabled ? "#ff5032" : "#ffcf70";
  ctx.shadowBlur = state.blasterDisabled ? 6 : state.blasterCooldown <= 0 ? 16 : 4;
  ctx.fillStyle = state.blasterDisabled ? "#cc9988" : "#dfe8ef";
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.fillRect(-state.satellite.r * 0.55, -state.satellite.r * 0.55, state.satellite.r * 1.1, state.satellite.r * 1.1);
  ctx.strokeRect(-state.satellite.r * 0.55, -state.satellite.r * 0.55, state.satellite.r * 1.1, state.satellite.r * 1.1);
  ctx.fillStyle = "#3f9bd6";
  ctx.fillRect(-state.satellite.r * 2.4, -state.satellite.r * 0.35, state.satellite.r * 1.45, state.satellite.r * 0.7);
  ctx.fillRect(state.satellite.r * 0.95, -state.satellite.r * 0.35, state.satellite.r * 1.45, state.satellite.r * 0.7);
  ctx.restore();

  if (!state.blasterDisabled) {
    const frac = state.blasterCooldown <= 0 ? 1 : 1 - state.blasterCooldown / BLASTER_REFILL;
    const ringR = state.satellite.r * 2.6;
    ctx.save();
    ctx.translate(state.satellite.x, state.satellite.y);
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, TAU);
    ctx.strokeStyle = "rgba(255,207,112,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (frac > 0) {
      const a0 = -Math.PI / 2;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, a0, a0 + frac * TAU);
      ctx.strokeStyle = frac >= 1 ? "rgba(255,207,112,0.92)" : "rgba(255,207,112,0.58)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      if (frac >= 1) { ctx.shadowColor = "#ffcf70"; ctx.shadowBlur = 12; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineCap = "butt";
    }
    ctx.restore();
  }
}

function drawHealthRing() {
  const healthFrac = clamp(1 - state.damage / 100, 0, 1);
  const ringR = state.earth.r + 11;
  const ringW = 6;
  const startAngle = -Math.PI / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = ringW;
  ctx.beginPath();
  ctx.arc(state.earth.x, state.earth.y, ringR, 0, TAU);
  ctx.stroke();

  if (healthFrac > 0) {
    const color = state.damage < 40 ? "#44ff88" : state.damage < 70 ? "#ffcf70" : "#ff6e7b";
    ctx.strokeStyle = color;
    ctx.lineWidth = ringW;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(state.earth.x, state.earth.y, ringR, startAngle, startAngle + healthFrac * TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawStarnetBadge() {
  if (!state.running) return;
  const { x, y, r } = state.earth;
  const count = state.starnet;
  const has = count > 0;
  const R = r * 0.28;
  const clearR = R * 0.42;
  const color = has ? "#72e6ff" : "rgba(255,80,100,0.6)";

  ctx.save();

  // Dark background
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.fillStyle = "rgba(0,5,15,0.82)";
  ctx.fill();

  // Cage bars clipped to circle, stopping before centre gap
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, R * 0.09);
  ctx.globalAlpha = 0.65;
  for (let i = -2; i <= 2; i++) {
    const off = i * R * 0.5;
    // vertical segment above centre gap
    ctx.beginPath();
    ctx.moveTo(x + off, y - R);
    ctx.lineTo(x + off, y - clearR);
    ctx.stroke();
    // vertical segment below centre gap
    ctx.beginPath();
    ctx.moveTo(x + off, y + clearR);
    ctx.lineTo(x + off, y + R);
    ctx.stroke();
    // horizontal segment left of centre gap
    ctx.beginPath();
    ctx.moveTo(x - R, y + off);
    ctx.lineTo(x - clearR, y + off);
    ctx.stroke();
    // horizontal segment right of centre gap
    ctx.beginPath();
    ctx.moveTo(x + clearR, y + off);
    ctx.lineTo(x + R, y + off);
    ctx.stroke();
  }
  ctx.restore();

  // Outer cage ring
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (has) { ctx.shadowColor = "#72e6ff"; ctx.shadowBlur = 12; }
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Dark backdrop for count so it reads cleanly over the bars
  ctx.beginPath();
  ctx.arc(x, y, clearR * 0.88, 0, TAU);
  ctx.fillStyle = "rgba(0,5,15,0.80)";
  ctx.fill();

  // Count centred inside the cage
  const fs = Math.round(Math.max(11, R * 0.62));
  ctx.fillStyle = has ? "#72e6ff" : "rgba(255,100,120,0.80)";
  if (has) { ctx.shadowColor = "#72e6ff"; ctx.shadowBlur = 8; }
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(count), x, y + 1);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawBurnSites() {
  if (!state.burnSites.length) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(state.earth.x, state.earth.y, state.earth.r, 0, TAU);
  ctx.clip();
  const now = performance.now();
  for (const site of state.burnSites) {
    const p = geoToScreen(site.lat, site.lon);
    if (!p) continue;
    const pulse = 0.7 + Math.sin(now * 0.008 + site.lon * 3) * 0.3;
    const r = state.earth.r * (0.035 + site.intensity * 0.025) * (0.85 + pulse * 0.3) * p.z;
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
  for (const rock of state.rocks) {
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
      if (rock.companions) {
        for (const c of rock.companions) {
          const cx = Math.cos(c.angle) * c.radius;
          const cy = Math.sin(c.angle) * c.radius;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(c.angle * 1.5 + c.seed);
          ctx.fillStyle = rock.cracked ? "#4d3360" : "#5a5060";
          ctx.strokeStyle = rock.cracked ? "rgba(190,90,255,0.55)" : "rgba(155,135,195,0.42)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < 7; i += 1) {
            const a = (i / 7) * TAU;
            const r = c.size * (0.75 + 0.3 * Math.sin(i * 2.1 + c.seed));
            if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
      if (rock.cometSlots) {
        for (const c of rock.cometSlots) {
          const cx = Math.cos(c.angle) * c.radius;
          const cy = Math.sin(c.angle) * c.radius;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(c.angle * 2.0 + performance.now() * 0.001);
          ctx.shadowColor = "#88eeff";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#d8f8ff";
          ctx.strokeStyle = "rgba(140,240,255,0.88)";
          ctx.lineWidth = 1.5;
          const cs = 9;
          ctx.beginPath();
          for (let i = 0; i < 8; i += 1) {
            const a = (i / 8) * TAU;
            const r = cs * (0.75 + 0.3 * Math.sin(i * 2.1 + c.seed));
            if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
      ctx.rotate(rock.seed + performance.now() * 0.00006);
      ctx.fillStyle = rock.cracked ? "#4a2060" : "#33234a";
      ctx.strokeStyle = rock.cracked ? "rgba(200,100,255,0.9)" : "rgba(160,130,220,0.65)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 13; i += 1) {
        const a = (i / 13) * TAU;
        const r = rock.r * (0.82 + 0.2 * Math.sin(i * 2.4 + rock.seed));
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (rock.cracked) {
        ctx.strokeStyle = "rgba(210,140,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-rock.r * 0.7, -rock.r * 0.15);
        ctx.lineTo(rock.r * 0.4, rock.r * 0.72);
        ctx.moveTo(-rock.r * 0.18, -rock.r * 0.78);
        ctx.lineTo(rock.r * 0.3, rock.r * 0.22);
        ctx.moveTo(rock.r * 0.1, -rock.r * 0.5);
        ctx.lineTo(-rock.r * 0.45, rock.r * 0.38);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      const barW = rock.r * 2.2;
      const barH = 8;
      const bx = -barW / 2;
      const by = -rock.r - 18;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx, by, barW, barH);
      const armorFrac = rock.cracked ? 1 : rock.armorHits / 2;
      ctx.fillStyle = rock.cracked ? "#aa44ff" : rock.armorHits > 0 ? "#8855cc" : "#5533aa";
      ctx.fillRect(bx, by, barW * armorFrac, barH);
      ctx.strokeStyle = "rgba(180,120,255,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.fillStyle = "#ddd";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(rock.cracked ? "FINISH IT!" : `CATASTROPHE ${rock.armorHits}/2`, 0, by - 2);

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
  for (const p of state.projectiles) {
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
  for (const laser of state.lasers) {
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
  for (const shock of state.starnetEffects) {
    const t = clamp(shock.life / shock.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t * 0.95;
    ctx.strokeStyle = "#72e6ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#72e6ff";
    ctx.shadowBlur = 18;
    for (let b = 0; b < 5; b += 1) {
      const startAngle = shock.seed + b * 1.23 + performance.now() * 0.003;
      const sx = state.earth.x + Math.cos(startAngle) * state.earth.r * 0.92;
      const sy = state.earth.y + Math.sin(startAngle) * state.earth.r * 0.92;
      drawLightning(sx, sy, shock.x, shock.y, 7, shock.seed + b);
    }
    ctx.beginPath();
    ctx.arc(shock.x, shock.y, shock.r * (1.5 + (1 - t) * 2.2), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawLightning(x1, y1, x2, y2, segments, seed) {
  const { norm: _norm } = { norm: (x, y) => { const len = Math.hypot(x, y) || 1; return { x: x / len, y: y / len }; } };
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const perp = _norm(-dy, dx);
  for (let i = 1; i < segments; i += 1) {
    const p = i / segments;
    const jitter = Math.sin(seed * 9.7 + i * 2.4 + performance.now() * 0.03) * 12;
    ctx.lineTo(x1 + dx * p + perp.x * jitter, y1 + dy * p + perp.y * jitter);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life * 1.7, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawReticle() {
  ctx.strokeStyle = "rgba(143,240,178,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(state.moon.x, state.moon.y, state.moon.r + 14, 0, TAU);
  ctx.stroke();

  if (state.blasterCooldown <= 0 && !state.blasterDisabled) {
    ctx.strokeStyle = "rgba(255,207,112,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(state.satellite.x, state.satellite.y, state.satellite.r + 14, 0, TAU);
    ctx.stroke();
  }
}

function drawHazardBanner() {
  if (!state.hazardBanner) return;
  const alpha = clamp(state.hazardBanner.timeLeft * 1.2, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(200, 60, 20, 0.88)";
  ctx.fillRect(0, state.h * 0.46, state.w, 50);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.hazardBanner.text, state.w / 2, state.h * 0.46 + 25);
  ctx.restore();
}

function clampAngleToEdge(cx, cy, angle, margin) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const candidates = [];
  if (cos > 1e-6)  candidates.push((state.w - margin - cx) / cos);
  if (cos < -1e-6) candidates.push((margin - cx) / cos);
  if (sin > 1e-6)  candidates.push((state.h - margin - cy) / sin);
  if (sin < -1e-6) candidates.push((margin - cy) / sin);
  const t = Math.min(...candidates.filter(d => d > 0));
  return { x: cx + cos * t, y: cy + sin * t };
}

function drawIncomingIndicators() {
  if (!state.running) return;
  const margin = 22;
  for (const rock of state.rocks) {
    if (rock.cleared) continue;
    const onScreen = rock.x >= 0 && rock.x <= state.w && rock.y >= 0 && rock.y <= state.h;
    if (onScreen) continue;
    const angle = Math.atan2(rock.y - state.earth.y, rock.x - state.earth.x);
    const pt = clampAngleToEdge(state.earth.x, state.earth.y, angle, margin);
    const color = rock.rockType === "boss"     ? "#cc44ff"
      : rock.rockType === "comet"              ? "#88eeff"
      : rock.rockType === "healing"            ? "#44ff88"
      : rock.rockType === "armored"            ? "#c8c8b4"
      : rock.rockType === "magnetic"           ? "#c070ff"
      : rock.level >= 4                        ? "#ff6e7b"
      : "#9eb3c6";
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    const as = 9;
    ctx.beginPath();
    ctx.moveTo(as, 0);
    ctx.lineTo(-as, -as * 0.6);
    ctx.lineTo(-as,  as * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawFloatingTexts() {
  if (!state.floatingTexts || !state.floatingTexts.length) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const ft of state.floatingTexts) {
    const alpha = clamp(ft.life / ft.maxLife * 2, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 10;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.restore();
}

function drawHazardIndicator() {
  if (!state.hazardEvent) return;
  const eventColors = { meteor: "#ff9f40", solar: "#ffcf70", moon: "#aad4ff", gravity: "#ff6e7b" };
  const eventLabels = { meteor: "Meteor Shower", solar: "Solar Flare", moon: "Rogue Moon", gravity: "Gravity Surge" };
  const color = eventColors[state.hazardEvent.type] || "#fff";
  const label = eventLabels[state.hazardEvent.type] || state.hazardEvent.type;
  const timeLeft = Math.ceil(state.hazardEvent.timeLeft);
  const barW = 160;
  const barH = 6;
  const px = state.w / 2 - barW / 2;
  const py = 68;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(px - 8, py - 18, barW + 16, barH + 28);
  ctx.fillStyle = color;
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${label} — ${timeLeft}s`, state.w / 2, py - 14);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(px, py, barW, barH);
  ctx.fillStyle = color;
  ctx.fillRect(px, py, barW * (state.hazardEvent.timeLeft / state.hazardEvent.maxTime), barH);
  ctx.restore();
}
