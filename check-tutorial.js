/**
 * Tutorial sync check — run after any game.js feature change.
 * Add new entries to FEATURES when adding rock types, hazards, or weapons.
 */
const fs = require("fs");

const FEATURES = {
  "Rock Types": [
    "Normal Rock",
    "Comet",
    "Armored Rock",
    "Magnetic Rock",
    "Healing Rock",
    "Catastrophe Rock",
  ],
  "Hazard Events": [
    "Solar Flare",
    "Meteor Shower",
    "Rogue Moon",
    "Gravity Surge",
  ],
  "Weapons": [
    "Deflect",
    "Blast",
    "Starnet",
  ],
  "Controls": [
    "Tap / Click",
    "moon lasers",
    "Fastest",
  ],
};

const html = fs.readFileSync("index.html", "utf8");
const tutStart = html.indexOf('id="tutorialOverlay"');
if (tutStart === -1) {
  console.error("ERROR: #tutorialOverlay not found in index.html");
  process.exit(1);
}
const tutHtml = html.slice(tutStart);

let pass = true;
const missing = [];

for (const [category, items] of Object.entries(FEATURES)) {
  console.log(`\n${category}`);
  for (const item of items) {
    const found = tutHtml.includes(item);
    const mark = found ? "  [OK]" : "  [!!]";
    console.log(`${mark} ${item}`);
    if (!found) {
      pass = false;
      missing.push(`${category} → "${item}"`);
    }
  }
}

console.log("\n" + "─".repeat(48));
if (pass) {
  console.log("PASS  Tutorial covers all features.");
} else {
  console.log("FAIL  Tutorial is missing:");
  for (const m of missing) console.log(`  - ${m}`);
  console.log("\nUpdate the tutorial in index.html, then re-run this check.");
}

process.exit(pass ? 0 : 1);
