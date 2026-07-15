# Moon Defender — Game Reference

Quick orientation for anyone editing or extending the game without reading every file.

---

## What the game is

Top-down space shooter. The player controls the **Moon** orbiting Earth. An orbiting **Satellite** provides a second firing point. Rocks fly in from screen edges toward Earth; the player must destroy or deflect them before they hit. Earth has 100 HP. Survive 10 levels.

---

## Game loop (`src/main.js`)

```
requestAnimationFrame → frame(now)
  dt = capped at 33ms, scaled by gameSpeed
  update(dt)
    updateMoon        — moon orbits, satellite follows
    hazard tick       — active hazard counts down
    spawn clock       — spawnRock() when timer expires
    physics           — integrate rocks, apply gravity/magnetic pull
    collision         — projectiles hit rocks → hitRock()
    earth impact      — rock reaches earth radius → damage + floatingText
    level advance     — levelClock hits 0 → nextLevel()
    tutorial tick     — tutorialTick(dt) if tutorialMode
  draw()             — canvas render
  updateHud()        — DOM HUD refresh
```

---

## Core systems

### Rocks (`src/rocks.js`)

Every rock is a plain object pushed into `state.rocks[]`.

Key fields: `x y vx vy level rockType r cleared deflected cracked armorHits`

**Rock types and behaviours:**

| rockType | Spawn level | Behaviour |
|---|---|---|
| `normal` | 1+ | Lv 1–2: one-shot. Bigger rocks split into fragments on hit. |
| `comet` | 2+ | 3× speed, fire trail, one-shot, +150 pts |
| `armored` | 3+ | 2 deflector hits or 1 blast (cracks) + 1 deflect, or 2 blasts |
| `magnetic` | 4+ | Pulls nearby rocks; deflector bounces off; blast/starnet kills |
| `healing` | 5+ | Don't shoot — capture via Starnet; restores 33% HP |
| `boss` | 5, 10 | 3 orbiting companions; crack with 2 blasts, then 1 more; 50 HP on Earth hit |

**Scoring** happens inside `clearRock()`. Pass `earthImpact=true` to skip scoring.

**Starnet refill:** every 5th hit/deflection (`state.hitsCleared % 5 === 0`) grants +1 charge.

### Weapons (`src/weapons.js`)

| Weapon | Function | Notes |
|---|---|---|
| Deflector | `shoot()` → deflector projectile | Pushes rocks off course; bounces off magnetic |
| Blaster | `shoot()` → blaster projectile | 1.5s cooldown (`BLASTER_REFILL`); homes slightly; cracks armored |
| Starnet | `useStarnet()` | Deploys ring around Earth; fires moon lasers; captures healing rocks; -1 charge |

Auto-attack (`autoAttack()`) fires toward a target selected by `state.autoAttackMode`.

Moon laser fires from moon position every 0.5s while Starnet ring is active (`state.starnetRingLife > 0`).

### Earth damage (`src/world.js`)

`addEarthDamage(amount, source)` — increments `state.damage`, triggers burn sites, screen shake. Every 10 HP of damage grants +1 Starnet charge (`state.nextDamageStarnet`). At 100 damage → `endGame()`.

### Hazard events (`src/hazards.js`)

One hazard per level, scheduled in `HAZARD_SCHEDULE` (constants.js), lasts 15s.

| Type | Effect |
|---|---|
| `solar` | `state.blasterDisabled = true` |
| `meteor` | `state.spawnRateMultiplier = 2` |
| `moon` | `state.moonSpeedMultiplier = 3` |
| `gravity` | `state.gravityMultiplier = 2` |

### Levels (`src/main.js → nextLevel()`)

10 levels total (`TOTAL_LEVELS`). Boss spawns at levels 5 and 10 (`BOSS_LEVELS`). Level clock is 60s (`LEVEL_TIME`). Boss pauses the level clock until killed.

---

## Tutorial system (`src/tutorial.js`)

Two tutorial sequences: **COMBAT_STEPS** and **ROCK_TYPE_STEPS**.

Each step is `{ enter(), waitFor(), leave() }`.

- `enter()` — spawns rocks, calls `missionControl.speak()`
- `waitFor()` — returns true when step is complete (rock gone, action taken, timeout)
- `leave()` — cleanup (clear rocks, restore weapons)

`tutorialTick(dt)` is called every frame when `state.tutorialMode = true`. It only advances a step when `missionControl.isSpeaking` is false AND `waitFor()` returns true. This means the MC bubble must finish typing and its read-delay must expire before the next step fires.

Tutorial rocks spawn via `spawnScriptedRock(type, angle, slow)`. In tutorial mode, `slow=false` gives ~33px/s so rocks reach Earth in ~16s from the edge — within the 25s timeout.

Weapons during tutorial are locked/unlocked per step via `setTutorialWeapons(['deflector'])` etc.

---

## Mission Control bubble (`src/mission-control.js`)

`missionControl.speak(text)` — types out text character by character at 30 chars/s.

- `**word**` in the string → shows as plain text during typing, snaps to `<strong>` (yellow glow) when complete
- `isSpeaking` stays true during typing + a read-delay (`max(1500ms, words × 350ms)`)
- Tutorial steps gate on `isSpeaking` — no step advances mid-message

---

## Leaderboard (`src/leaderboard.js` + `src/config.js`)

Backend: Supabase (PostgreSQL + REST API). Credentials in `src/config.js`.

- **IP detection:** `https://api.ipify.org` on page load → `state.playerIP`
- **Submit:** calls `submit_score` RPC (stored procedure) which enforces max-2 scores per IP atomically
- **Fetch:** `GET /rest/v1/leaderboard?select=player_name,score,level&order=score.desc&limit=20`
- **"Is mine" highlighting:** local submissions logged in `localStorage('md_subs')`, matched by name+score+level
- **Name modal:** shown on first visit; stored in `localStorage('md_player_name')`; changeable in Preferences

If `SUPABASE_URL` is empty, leaderboard shows a "not configured" message and all submit calls are no-ops.

---

## Rendering (`src/render.js`)

All drawing on a single `<canvas id="game">` scaled by `devicePixelRatio`.

Draw order per frame:
1. Clear + starfield
2. Earth (texture + burn sites + health ring)
3. Starnet ring (if active)
4. Rocks (with type-specific visuals: crack lines, magnetic rings, healing cross, comet trail)
5. Moon + satellite
6. Projectiles + particles + lasers
7. Hazard/level banner
8. Edge indicators — arrows at screen edge for off-screen incoming rocks
9. Floating texts — score/damage popups that drift upward and fade

---

## State object (`src/state.js`)

`state` is a single shared object imported by every module. Key groups:

| Group | Fields |
|---|---|
| Viewport | `w h dpr` |
| Bodies | `earth moon satellite stars` |
| Timing | `lastTime running paused gameSpeed` |
| Progress | `level levelClock damage score starnet` |
| Collections | `rocks projectiles particles lasers starnetEffects floatingTexts` |
| Counters | `hitsCleared deflectionsCleared starnetActivationId` |
| Identity | `playerName playerIP` |
| Preferences | `satelliteOffset gameSpeed friendlyFire autoAttackMode` |

`els` (same file) is a map of all DOM elements used by the game, keyed by logical name.

---

## Adding a new rock type

1. Add spawn logic in `src/rocks.js` — handle in `spawnRock()` weight table and `hitRock()`
2. Add visual in `src/render.js` `drawRock()` switch
3. Add tutorial entry in `src/tutorial.js` `ROCK_TYPE_STEPS`
4. Add rock card in `index.html` `#tutorialOverlay` `.tut-rocks`
5. Add to `check-tutorial.js` FEATURES manifest under `"Rock Types"`
6. Run `node check-tutorial.js` — must PASS

## Adding a new hazard

1. Add handler in `src/hazards.js` `activateHazardEvent()`
2. Schedule it in `HAZARD_SCHEDULE` array in `src/constants.js`
3. Add hazard card in `index.html` `.tut-hazards`
4. Add to `check-tutorial.js` FEATURES manifest under `"Hazard Events"`
5. Run `node check-tutorial.js` — must PASS
