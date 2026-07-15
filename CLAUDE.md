# Moon Defender — Claude Instructions

## Architecture

The game is a **vanilla JS ES-module** project — no build step, no npm runtime. Everything runs directly in the browser. `index.html` loads `src/main.js` as `type="module"` and all other modules are imported from there.

```
index.html        ← shell, all overlay HTML, tutorial overlay
styles.css        ← all styles
src/
  main.js         ← game loop, reset, endGame, leaderboard init, event wiring
  state.js        ← shared state object + DOM element refs (els)
  constants.js    ← tuning constants (LEVEL_TIME, ROCK_DAMAGE, TOTAL_LEVELS…)
  rocks.js        ← spawn, hit, split, clear, scoring, magnetic pull
  weapons.js      ← shoot, deflect, blast, starnet, moon laser, auto-attack
  render.js       ← all canvas drawing, edge indicators, floating texts
  world.js        ← earth/moon/satellite sizing, earth damage, burn sites
  physics.js      ← gravity integration, collision, deflection range
  hazards.js      ← hazard event activation/deactivation
  hud.js          ← HUD update, weapon lock/unlock
  tutorial.js     ← tutorial sequences (COMBAT_STEPS, ROCK_TYPE_STEPS)
  mission-control.js ← MC bubble typewriter, **bold** markup, isSpeaking gate
  leaderboard.js  ← Supabase fetch/submit, IP detection, localStorage name
  config.js       ← Supabase URL + anon key (fill in to enable leaderboard)
  utils.js        ← rand(), norm()
```

## After every feature change

Run the tutorial sync check:

```
node check-tutorial.js
```

If it fails, update `index.html` (`#tutorialOverlay` section) so every item passes, then re-run until **PASS**.

## When adding a new feature

1. Implement logic in the relevant `src/` file
2. Add its display name to the correct category in `check-tutorial.js` FEATURES manifest
3. Add a tutorial entry in `index.html` inside `#tutorialOverlay`
4. Run `node check-tutorial.js` — must pass before the task is complete

## Feature manifest categories

| Category | What counts as an entry |
|---|---|
| Rock Types | Any `rockType` value with distinct player-facing behaviour |
| Hazard Events | Any `activateHazardEvent` type |
| Weapons | Any selectable weapon button |
| Controls | Any keyboard shortcut or tap mechanic |

## Key rules

- **No build step** — never introduce a bundler or npm runtime dependency
- **GitHub Pages** — keep all imports relative, no absolute `/` paths; `.nojekyll` is already present
- **Leaderboard** — `src/config.js` holds Supabase credentials; the `submit_score` stored procedure enforces max-2 scores per IP server-side
- **Tutorial gating** — `missionControl.isSpeaking` pauses `tutorialTick`; steps only advance when speaking is done AND `waitFor()` returns true
- **Floating texts** — push to `state.floatingTexts[]`; lifecycle managed in `main.js` `update()`
- **Device-adaptive UI** — use `.kbd-only` (hidden on touch) and `.show-touch` / `.show-mouse` CSS classes; no JS detection
- **MC bubble markup** — `**word**` in speak() strings renders as `<strong>` (yellow glow) after typewriter completes

## Starnet refill

Starnet gains 1 charge every **5** hits or deflections (`state.hitsCleared % 5 === 0` in `src/rocks.js`).

## Scoring

| Event | Points |
|---|---|
| Destroy rock | `level × 75` |
| Deflect rock | `level × 40` |
| Destroy comet | `+150` bonus |
| Destroy boss | `+500` |
| Rock hits Earth | `0` (HP damage only) |
| Hit healing rock | `-15` (deflect) / `-50` (blast) |
| Capture healing rock | `0` (HP restore only) |
