import { TOTAL_LEVELS, AUTO_ATTACK_LABELS } from "./constants.js";
import { clamp } from "./utils.js";
import { els, state } from "./state.js";

export function updateHud() {
  els.level.textContent = `${state.level}/${TOTAL_LEVELS}`;
  els.timer.textContent = state.bossActive ? "CATAS" : Math.max(0, Math.ceil(state.levelClock));
  els.score.textContent = state.score;
  els.lostCountry.textContent = state.lostCountry;
  els.starnetCount.textContent = state.starnet;
  if (state.blasterDisabled) {
    els.blasterCooldown.textContent = "Flare!";
  } else {
    els.blasterCooldown.textContent = state.blasterCooldown <= 0 ? "Ready" : `${state.blasterCooldown.toFixed(1)}s`;
  }
  if (!els.blasterBtn.dataset.tutLocked) {
    els.blasterBtn.disabled = state.blasterDisabled || (state.blasterCooldown > 0 && state.selectedWeapon !== "blaster");
    els.blasterBtn.classList.toggle("ready", state.blasterCooldown <= 0 && !state.blasterDisabled);
  }
  if (!els.starnetBtn.dataset.tutLocked) {
    els.starnetBtn.disabled = state.starnet <= 0;
  }
}

export function selectWeapon(type) {
  state.selectedWeapon = type;
  els.deflectorBtn.classList.toggle("active", type === "deflector");
  els.blasterBtn.classList.toggle("active", type === "blaster");
}

export function lockWeapon(name) {
  const btn = name === "deflector" ? els.deflectorBtn
            : name === "blaster"   ? els.blasterBtn
            : name === "starnet"   ? els.starnetBtn : null;
  if (btn) { btn.disabled = true; btn.dataset.tutLocked = "1"; }
}

export function unlockWeapon(name) {
  const btn = name === "deflector" ? els.deflectorBtn
            : name === "blaster"   ? els.blasterBtn
            : name === "starnet"   ? els.starnetBtn : null;
  if (btn) { btn.disabled = false; delete btn.dataset.tutLocked; }
}

export function lockAllWeapons() {
  ["deflector", "blaster", "starnet"].forEach(lockWeapon);
}
