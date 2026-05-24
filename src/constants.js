export const TAU = Math.PI * 2;
export const G = 2600000;
export const EARTH_MASS = 1;
export const MOON_MASS = 1 / 6;
export const LEVEL_TIME = 60;
export const TOTAL_LEVELS = 10;
export const BOSS_LEVELS = new Set([5, 10]);
export const BLASTER_REFILL = 1.5;
export const PHYSICS_SUBSTEPS = 3;
export const ROCK_DAMAGE = [0, 3, 7, 15, 25, 35];
export const HAZARD_SCHEDULE = [null, "meteor", "solar", "moon", null, "gravity", "meteor", "moon", "solar", null];
export const BOSS_HP_BASE = 5;
export const MAGNETIC_PULL_RADIUS = 220;
export const MAGNETIC_PULL_STRENGTH = 38;
export const AUTO_ATTACK_MODES = ["auto", "special", "closest", "damage", "fastest"];
export const AUTO_ATTACK_LABELS = { auto: "Auto", special: "Special", closest: "Closest", damage: "Danger", fastest: "Fastest" };
export const EARTH_TEXTURE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png";
