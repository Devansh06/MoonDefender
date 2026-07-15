import { LEVEL_TIME, TOTAL_LEVELS, BOSS_LEVELS, HAZARD_SCHEDULE, AUTO_ATTACK_MODES, AUTO_ATTACK_LABELS, ROCK_DAMAGE } from "./constants.js";
import { rand, norm } from "./utils.js";
import { els, canvas, shell, state } from "./state.js";
import { isEnabled, getPlayerIP, getStoredName, storeName, fetchLeaderboard, submitScore, isMySub } from "./leaderboard.js";
import { resize, updateMoon, addEarthDamage } from "./world.js";
import { resolveRockCollisions, integrateRock } from "./physics.js";
import { spawnRock, spawnBoss, markArenaState, isOutsideArena, bounceFromMoon, clearRock, applyMagneticPull, applyStarnetField, hitRock, predictPath, updateCatastropheCompanions, spawnMagneticCompanions } from "./rocks.js";
import { activateHazardEvent, deactivateHazardEvent } from "./hazards.js";
import { shoot, fireLaser, useStarnet, applyBlasterHoming, fireMoonLaser, autoAttack } from "./weapons.js";
import { draw, addCometTrail, addBurst } from "./render.js";
import { updateHud, selectWeapon, lockWeapon, unlockWeapon, lockAllWeapons } from "./hud.js";
import { tutorialTick, startCombat, startRockTypes, tutEndStartMission, tutEndBackToTutorials, isInActiveTutorial, exitActiveTutorial } from "./tutorial.js";
import { missionControl } from "./mission-control.js";

export function resetGame() {
  state.level = 1;
  state.levelClock = LEVEL_TIME;
  state.spawnClock = 1.1;
  state.damage = 0;
  state.score = 0;
  state.deflectionsCleared = 0;
  state.hitsCleared = 0;
  state.starnet = 2;
  state.blasterCooldown = 0;
  state.selectedWeapon = "deflector";
  state.earthSpin = 0;
  state.shake = 0;
  state.projectiles = [];
  state.rocks = [];
  state.particles = [];
  state.lasers = [];
  state.starnetEffects = [];
  state.floatingTexts = [];
  state.starnetRingLife = 0;
  state.starnetActivationId = 0;
  state.nextDamageStarnet = 10;
  state.lostCountry = "None";
  state.burnSites = [];
  state.lostCountries = new Set();
  state.friendlyFire = false;
  state.impactMemory.length = 0;
  state.moonPulse = 0;
  state.moonShieldLife = 0;
  state.hazardEvent = null;
  state.gravityMultiplier = 1;
  state.moonSpeedMultiplier = 1;
  state.spawnRateMultiplier = 1;
  state.blasterDisabled = false;
  state.bossActive = false;
  state.hazardBanner = null;
  state.moonLaserClock = 0;
  state.autoAttackMode = AUTO_ATTACK_MODES[0];
  state.running = true;
  state.paused = false;
  els.pauseBtn.innerHTML = "&#x23F8;";
  els.pauseBtn.title = "Pause";
  els.pauseBtn.classList.remove("is-paused");
  selectWeapon("deflector");
  els.tutorialOverlay.classList.remove("show");
  els.tutorialSelectOverlay.classList.remove("show");
  els.tutEndScreen?.classList.remove("show");
  els.rockEntryScreen?.classList.remove("show");
  els.overlay.classList.remove("show");
  for (let i = 0; i < 3; i += 1) spawnRock();
}

export function pauseNormalSpawning() {
  state.spawnClock = 999999;
}

export function resumeNormalSpawning() {
  state.spawnClock = 0;
}

export function setTutorialMode(on) {
  state.tutorialMode = on;
  if (on) {
    lockAllWeapons();
  } else {
    unlockWeapon("deflector");
    unlockWeapon("blaster");
    unlockWeapon("starnet");
  }
}

export function spawnScriptedRock(type, angleOverride, slow = false) {
  const angle = angleOverride !== undefined ? angleOverride : Math.random() * Math.PI * 2;
  const side = Math.cos(angle) < 0 ? -1 : 1;
  const margin = type === "boss" ? state.earth.r * 0.22 : 34;
  const pos = state.tutorialMode
    ? {
        x: side < 0 ? -margin : state.w + margin,
        y: state.earth.y + Math.sin(angle) * state.earth.r * 1.2,
      }
    : (() => {
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const candidates = [];
        if (dir.x > 0) candidates.push((state.w - state.earth.x) / dir.x);
        if (dir.x < 0) candidates.push((0 - state.earth.x) / dir.x);
        if (dir.y > 0) candidates.push((state.h - state.earth.y) / dir.y);
        if (dir.y < 0) candidates.push((0 - state.earth.y) / dir.y);
        const edgeDistance = Math.min(...candidates.filter(d => d > 0));
        return {
          x: state.earth.x + dir.x * (edgeDistance + margin),
          y: state.earth.y + dir.y * (edgeDistance + margin),
        };
      })();
  const target = state.tutorialMode
    ? { x: state.earth.x - side * state.earth.r * 0.38, y: state.earth.y + Math.sin(angle) * state.earth.r * 0.24 }
    : state.earth;
  const targetAngle = Math.atan2(target.y - pos.y, target.x - pos.x);
  const speedMult = state.tutorialMode ? (slow ? 0.24 : 0.36) : (slow ? 0.45 : 1);
  const speed = (type === "comet" ? 140 : 92) * speedMult;
  const r = type === "comet" ? 8 : type === "healing" ? 14 : type === "magnetic" ? 19 : 15;

  const rock = {
    x: pos.x, y: pos.y,
    vx: Math.cos(targetAngle) * speed,
    vy: Math.sin(targetAngle) * speed,
    level: type === "boss" ? 5 : 2,
    rockType: type,
    breakCount: 0, r,
    seed: Math.random() * 999,
    cleared: false, deflected: false,
    spiral: false, enteredArena: false,
    earthSeeking: false, path: [], pathClock: 0,
    armorHits: 0, deflectorHits: 0, cracked: false,
    starnetActivationId: 0, starnetOrigin: null,
    starnetHit: false, lastStarnetDistance: 0,
  };
  state.rocks.push(rock);
  if (type === "magnetic" && !state.tutorialMode) spawnMagneticCompanions(rock);
}

export function nextLevel() {
  if (state.level >= TOTAL_LEVELS) {
    endGame("All 10 levels cleared. Earth survives.");
    return;
  }
  state.level += 1;
  state.levelClock = LEVEL_TIME;
  deactivateHazardEvent();

  const hazardType = HAZARD_SCHEDULE[state.level - 1];
  if (hazardType) activateHazardEvent(hazardType);

  if (BOSS_LEVELS.has(state.level)) {
    state.bossActive = true;
    for (let i = 0; i < 2; i += 1) spawnRock();
    spawnBoss();
    if (!state.hazardBanner) state.hazardBanner = { text: `LEVEL ${state.level} — CATASTROPHE INCOMING!`, timeLeft: 3 };
  } else {
    const count = Math.min(4, Math.ceil(state.level / 2) + 1);
    for (let i = 0; i < count; i += 1) spawnRock();
  }
}

export function endGame(message) {
  state.running = false;
  deactivateHazardEvent();
  state.bossActive = false;
  els.overlay.querySelector("h1").textContent = state.damage >= 100 ? "Earth Lost" : "Mission Report";
  els.overlay.querySelector("p").textContent = `${message} Score: ${state.score}.`;
  els.startBtn.textContent = "Restart Mission";
  els.tutorialOverlay.classList.remove("show");
  els.overlay.classList.add("show");

  const score = state.score;
  const level = state.level;
  const name  = state.playerName;
  const ip    = state.playerIP;
  if (name && name !== "Guest" && score > 0) {
    submitScore(name, score, level, ip).then(() => loadLeaderboard());
  } else {
    loadLeaderboard();
  }
}

function update(dt) {
  updateMoon(dt);
  if (!state.running) return;

  if (state.hazardEvent) {
    state.hazardEvent.timeLeft -= dt;
    if (state.hazardEvent.timeLeft <= 0) deactivateHazardEvent();
  }
  if (state.hazardBanner) {
    state.hazardBanner.timeLeft -= dt;
    if (state.hazardBanner.timeLeft <= 0) state.hazardBanner = null;
  }

  if (!state.bossActive) state.levelClock -= dt;
  state.moonPulse = Math.max(0, state.moonPulse - dt);
  state.moonShieldLife = Math.max(0, state.moonShieldLife - dt);
  state.blasterCooldown = Math.max(0, state.blasterCooldown - dt);
  state.earthSpin += dt * 0.22;
  state.spawnClock -= dt;
  state.starnetRingLife = Math.max(0, state.starnetRingLife - dt);
  if (state.starnetRingLife > 0) {
    state.moonLaserClock = Math.max(0, state.moonLaserClock - dt);
    if (state.moonLaserClock <= 0) { state.moonLaserClock = 0.5; fireMoonLaser(); }
  }
  state.shake = Math.max(0, state.shake - dt);

  for (const hit of state.impactMemory) hit.ttl -= dt;
  while (state.impactMemory.length && state.impactMemory[0].ttl <= 0) state.impactMemory.shift();

  if (state.spawnClock <= 0) {
    spawnRock();
    const baseInterval = Math.max(1.0, 2.8 - state.level * 0.14);
    state.spawnClock = baseInterval / state.spawnRateMultiplier;
  }

  applyMagneticPull(dt);
  updateCatastropheCompanions(dt);

  for (const projectile of state.projectiles) {
    applyBlasterHoming(projectile, dt);
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    if (Math.hypot(projectile.x - state.earth.x, projectile.y - state.earth.y) < state.earth.r) {
      addEarthDamage(projectile.type === "blaster" ? 3 : 1, projectile);
      projectile.life = -1;
      addBurst(projectile.x, projectile.y, "#ff6e7b", 8);
    }
  }

  for (const rock of state.rocks) {
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

    if (Math.hypot(rock.x - state.earth.x, rock.y - state.earth.y) < state.earth.r + rock.r * 0.45) {
      if (rock.rockType === "boss") {
        addEarthDamage(50, rock);
        state.bossActive = false;
        state.floatingTexts.push({ x: rock.x, y: rock.y - 10, text: "-50 HP", life: 1.6, maxLife: 1.6, vy: -45, color: "#cc44ff" });
      } else if (rock.rockType !== "healing") {
        const dmg = ROCK_DAMAGE[rock.level];
        addEarthDamage(dmg, rock);
        const impactColor = { comet: "#88eeff", armored: "#c8c8b4", magnetic: "#c070ff" }[rock.rockType] || "#ff8866";
        state.floatingTexts.push({ x: rock.x, y: rock.y - 10, text: `-${dmg} HP`, life: 1.4, maxLife: 1.4, vy: -40, color: impactColor });
      }
      clearRock(rock, true, true);
    } else if (rock.rockType !== "boss" && Math.hypot(rock.x - state.moon.x, rock.y - state.moon.y) < state.moon.r + rock.r * 0.4) {
      bounceFromMoon(rock);
    } else if (isOutsideArena(rock)) {
      if (rock.deflected) clearRock(rock, false);
      else rock.cleared = true;
    }
  }
  resolveRockCollisions();

  for (const projectile of state.projectiles) {
    if (projectile.life <= 0) continue;
    for (const rock of state.rocks) {
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

  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  for (const shock of state.starnetEffects) shock.life -= dt;
  for (const laser of state.lasers) laser.life -= dt;
  for (const ft of state.floatingTexts) { ft.y += ft.vy * dt; ft.life -= dt; }
  state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);

  state.projectiles = state.projectiles.filter((p) => p.life > 0 && p.x > -80 && p.x < state.w + 80 && p.y > -80 && p.y < state.h + 80);
  state.rocks = state.rocks.filter((r) => !r.cleared && r.x > -state.w && r.x < state.w * 2 && r.y > -state.h && r.y < state.h * 2);
  state.particles = state.particles.filter((p) => p.life > 0);
  state.starnetEffects = state.starnetEffects.filter((shock) => shock.life > 0);
  state.lasers = state.lasers.filter((laser) => laser.life > 0);

  if (state.bossActive && !state.rocks.some(r => !r.cleared && r.rockType === "boss")) {
    state.bossActive = false;
    state.levelClock = 5;
  }

  if (state.levelClock <= 0 && !state.bossActive && !state.tutorialMode) nextLevel();
  if (state.tutorialMode) tutorialTick(dt);
  if (state.damage >= 100) endGame("Earth took too many hits.");
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  els.pauseBtn.innerHTML = state.paused ? "&#x25B6;" : "&#x23F8;";
  els.pauseBtn.title = state.paused ? "Resume" : "Pause";
  els.pauseBtn.classList.toggle("is-paused", state.paused);
}

function cycleSpeed() {
  const speeds = [1, 1.5, 2];
  state.gameSpeed = speeds[(speeds.indexOf(state.gameSpeed) + 1) % speeds.length];
  els.speedBtn.textContent = `${state.gameSpeed}×`;
  els.speedBtn.classList.toggle("speed-fast", state.gameSpeed > 1);
}

function frame(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0) * state.gameSpeed;
  state.lastTime = now;
  if (!state.paused) update(dt);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
}

function updateFullscreenIcons() {
  const icon = document.fullscreenElement ? "✕" : "⛶";
  if (els.fullscreenBtn)    els.fullscreenBtn.textContent = icon;
  if (els.fullscreenHudBtn) els.fullscreenHudBtn.textContent = icon;
}

window.addEventListener("resize", resize);
shell.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button") || els.overlay.classList.contains("show")) return;
  shoot(event.clientX, event.clientY);
});
els.exitBtn.addEventListener("click", () => {
  missionControl.silence();
  if (isInActiveTutorial()) {
    exitActiveTutorial();
  } else if (state.running) {
    endGame("Mission abandoned.");
  }
});
els.pauseBtn.addEventListener("click", togglePause);
els.deflectorBtn.addEventListener("click", () => selectWeapon("deflector"));
els.blasterBtn.addEventListener("click",   () => selectWeapon("blaster"));
els.starnetBtn.addEventListener("click",   useStarnet);
els.friendlyFireBtn.addEventListener("click", () => {
  state.friendlyFire = !state.friendlyFire;
  els.friendlyFireState.textContent = state.friendlyFire ? "On" : "Off";
  els.friendlyFireBtn.classList.toggle("on",  state.friendlyFire);
  els.friendlyFireBtn.classList.toggle("off", !state.friendlyFire);
  updateHud();
});
els.startBtn.addEventListener("click", resetGame);
els.panelCloseBtn.addEventListener("click", resetGame);
els.tutorialBtn.addEventListener("click", () => {
  els.overlay.classList.remove("show");
  els.tutorialSelectOverlay.classList.add("show");
});
els.tutSelCloseBtn.addEventListener("click", () => {
  missionControl.silence();
  els.tutorialSelectOverlay.classList.remove("show");
  els.overlay.classList.add("show");
});
els.tutSelBackBtn.addEventListener("click", () => {
  missionControl.silence();
  els.tutorialSelectOverlay.classList.remove("show");
  els.overlay.classList.add("show");
});
els.tutHowToPlayBtn.addEventListener("click", () => {
  els.tutorialSelectOverlay.classList.remove("show");
  els.tutorialOverlay.classList.add("show");
});

// Tutorial combat
els.tutCombatBtn.addEventListener("click", () => {
  startCombat();
});

// Tutorial end screen
els.tutEndStartBtn.addEventListener("click", tutEndStartMission);
els.tutEndBackBtn.addEventListener("click", () => {
  missionControl.silence();
  tutEndBackToTutorials();
});

// Rock types entry screen
els.tutRocksBtn.addEventListener("click", () => {
  els.tutorialSelectOverlay.classList.remove("show");
  els.rockEntryScreen.classList.add("show");
});
els.rockEntryCloseBtn.addEventListener("click", () => {
  missionControl.silence();
  els.rockEntryScreen.classList.remove("show");
  els.overlay.classList.add("show");
});
els.rockEntryBackBtn.addEventListener("click", () => {
  missionControl.silence();
  els.rockEntryScreen.classList.remove("show");
  els.tutorialSelectOverlay.classList.add("show");
});
document.querySelectorAll(".rock-entry-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    startRockTypes(btn.dataset.rock);
  });
});
els.tutCloseBtn.addEventListener("click",  () => { els.tutorialOverlay.classList.remove("show"); els.overlay.classList.add("show"); });
els.tutBackBtn.addEventListener("click",   () => { els.tutorialOverlay.classList.remove("show"); els.overlay.classList.add("show"); });
els.tutPlayBtn.addEventListener("click",   () => { els.tutorialOverlay.classList.remove("show"); resetGame(); });
els.prefsBtn.addEventListener("click", () => {
  const d = document.getElementById("callsignDisplay");
  if (d) d.textContent = state.playerName || "—";
  els.overlay.classList.remove("show");
  els.prefsOverlay.classList.add("show");
});
els.prefsCloseBtn.addEventListener("click", () => { els.prefsOverlay.classList.remove("show"); els.overlay.classList.add("show"); });
els.prefsBackBtn.addEventListener("click",  () => { els.prefsOverlay.classList.remove("show"); els.overlay.classList.add("show"); });
document.querySelectorAll(".sat-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    state.satelliteOffset = parseInt(btn.dataset.offset, 10) * Math.PI / 180;
    document.querySelectorAll(".sat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});
els.speedBtn.addEventListener("click", cycleSpeed);
els.fullscreenBtn.addEventListener("click",    toggleFullscreen);
els.fullscreenHudBtn.addEventListener("click", toggleFullscreen);
function cycleAutoMode() {
  const idx = AUTO_ATTACK_MODES.indexOf(state.autoAttackMode);
  state.autoAttackMode = AUTO_ATTACK_MODES[(idx + 1) % AUTO_ATTACK_MODES.length];
  const label = AUTO_ATTACK_LABELS[state.autoAttackMode];
  els.autoModeLabel.textContent = label;
  els.targetLabel.textContent = label;
}
els.autoModeBtn.addEventListener("click", cycleAutoMode);
els.targetBtn.addEventListener("click", cycleAutoMode);
window.addEventListener("keydown", (event) => {
  if (event.key === "1" || event.code === "Numpad1") {
    if (!els.deflectorBtn.dataset.tutLocked) { selectWeapon("deflector"); autoAttack("deflector"); }
  }
  if (event.key === "2" || event.code === "Numpad2") {
    if (!els.blasterBtn.dataset.tutLocked) { selectWeapon("blaster"); autoAttack("blaster"); }
  }
  if (event.key === "3" || event.key.toLowerCase() === "s" || event.code === "Numpad3") {
    if (!els.starnetBtn.dataset.tutLocked) useStarnet();
  }
  if (event.key === "=" || event.key === "+") cycleSpeed();
  if (event.key.toLowerCase() === "p" || event.key === "Escape") { event.preventDefault(); togglePause(); }
  if (event.code === "Space") {
    event.preventDefault();
    if (state.running) {
      if (!els.starnetBtn.dataset.tutLocked) useStarnet();
    } else {
      resetGame();
    }
  }
});
document.addEventListener("fullscreenchange", updateFullscreenIcons);

els.autoModeLabel.textContent = AUTO_ATTACK_LABELS[state.autoAttackMode];
els.targetLabel.textContent   = AUTO_ATTACK_LABELS[state.autoAttackMode];
els.friendlyFireState.textContent = state.friendlyFire ? "On" : "Off";
els.friendlyFireBtn.classList.toggle("on",  state.friendlyFire);
els.friendlyFireBtn.classList.toggle("off", !state.friendlyFire);
resize();
updateMoon(0);
requestAnimationFrame(frame);

// ── Leaderboard helpers ───────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function loadLeaderboard() {
  const listEl   = document.getElementById("leaderboardList");
  const statusEl = document.getElementById("lbStatus");
  if (!listEl) return;

  if (!isEnabled()) {
    listEl.innerHTML = '<div class="lb-empty">Connect Supabase in <code>src/config.js</code> to enable global scores.</div>';
    return;
  }

  if (statusEl) statusEl.textContent = "Loading…";
  const rows = await fetchLeaderboard();
  if (statusEl) statusEl.textContent = "";

  if (!rows.length) {
    listEl.innerHTML = '<div class="lb-empty">No scores yet — be the first!</div>';
    return;
  }

  listEl.innerHTML = rows.map((row, i) => {
    const mine   = isMySub(row.player_name, row.score, row.level);
    const medals = ["#1", "#2", "#3"];
    const rank   = i < 3 ? `<span class="lb-medal lb-medal-${i+1}">${medals[i]}</span>` : `<span>${i + 1}</span>`;
    return `<div class="lb-row${mine ? " lb-mine" : ""}">
      <span class="lb-rank">${rank}</span>
      <span class="lb-name">${escHtml(row.player_name)}</span>
      <span class="lb-score">${row.score.toLocaleString()}</span>
      <span class="lb-level">Lv&nbsp;${row.level}</span>
    </div>`;
  }).join("");
}

// ── Name modal ────────────────────────────────────────────────────────
const nameModal      = document.getElementById("nameModal");
const nameInput      = document.getElementById("nameInput");
const nameConfirmBtn = document.getElementById("nameConfirmBtn");
const nameSkipBtn    = document.getElementById("nameSkipBtn");

function applyName(name) {
  state.playerName = name;
  const display = document.getElementById("callsignDisplay");
  if (display) display.textContent = name || "—";
}

function confirmName() {
  const name = nameInput?.value.trim();
  if (!name) { nameInput?.classList.add("input-error"); return; }
  nameInput?.classList.remove("input-error");
  storeName(name);
  applyName(name);
  nameModal.classList.remove("show");
  els.overlay.classList.add("show");
  loadLeaderboard();
}

nameConfirmBtn?.addEventListener("click", confirmName);
nameSkipBtn?.addEventListener("click", () => {
  applyName("Guest");
  nameModal.classList.remove("show");
  els.overlay.classList.add("show");
  loadLeaderboard();
});
nameInput?.addEventListener("keydown", e => { if (e.key === "Enter") confirmName(); });
nameInput?.addEventListener("input",   () => nameInput.classList.remove("input-error"));

// ── Startup ───────────────────────────────────────────────────────────
getPlayerIP().then(ip => { state.playerIP = ip; });

const storedName = getStoredName();
if (storedName) {
  applyName(storedName);
  loadLeaderboard();
} else {
  els.overlay.classList.remove("show");
  nameModal.classList.add("show");
  setTimeout(() => nameInput?.focus(), 80);
}

// ── Change-name button in Preferences ────────────────────────────────
document.getElementById("changeNameBtn")?.addEventListener("click", () => {
  els.prefsOverlay.classList.remove("show");
  if (nameInput) nameInput.value = state.playerName !== "Guest" ? state.playerName : "";
  nameModal.classList.add("show");
  setTimeout(() => nameInput?.focus(), 80);
});
