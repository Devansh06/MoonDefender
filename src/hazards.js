import { state } from "./state.js";

export function activateHazardEvent(type) {
  const duration = 15;
  state.hazardEvent = { type, timeLeft: duration, maxTime: duration };
  state.blasterDisabled = false;
  state.gravityMultiplier = 1;
  state.moonSpeedMultiplier = 1;
  state.spawnRateMultiplier = 1;
  const bannerMap = {
    meteor: "METEOR SHOWER! Spawn rate doubled for 15s",
    solar: "SOLAR FLARE! Blaster offline for 15s",
    moon: "ROGUE MOON! Orbit speed tripled for 15s",
    gravity: "GRAVITY SURGE! Rocks accelerate faster for 15s",
  };
  switch (type) {
    case "meteor": state.spawnRateMultiplier = 2; break;
    case "solar": state.blasterDisabled = true; break;
    case "moon": state.moonSpeedMultiplier = 3; break;
    case "gravity": state.gravityMultiplier = 2; break;
  }
  state.hazardBanner = { text: bannerMap[type] || type, timeLeft: 3 };
}

export function deactivateHazardEvent() {
  state.hazardEvent = null;
  state.blasterDisabled = false;
  state.gravityMultiplier = 1;
  state.moonSpeedMultiplier = 1;
  state.spawnRateMultiplier = 1;
}
