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
| `boss` | 5, 10 | 3 orbiting companions; crack with 2 blasts, then 1 more; 50 HP on Earth hit (25 HP when cracked) |

Armored rocks deal half Earth damage when cracked (`Math.ceil(ROCK_DAMAGE[level] * 0.5)`). Boss rocks deal 25 HP when cracked (vs 50 HP uncracked).

**Scoring** happens inside `clearRock()`. Pass `earthImpact=true` to skip scoring.

**Starnet refill:** every 4th hit/deflection (`state.hitsCleared % 4 === 0`) grants +1 charge.

### Weapons (`src/weapons.js`)

| Weapon | Input | Notes |
|---|---|---|
| Deflector | Click/tap (PC: key `1`) | Pushes rocks off course; bounces off magnetic; from Moon |
| Blaster | Click/tap (PC: key `2`) | 1.5s cooldown; laser pierces ALL rocks along beam to screen edge; cracks armored |
| Starnet | Tap Earth / key `Space`/`3` | Deploys pulse around Earth; destroys/deflects rocks in range; captures healing rocks; -1 charge |

Blaster cooldown shown as a buffering arc ring around the satellite (fills over 1.5s, no text).

Moon laser fires from moon position every 0.5s while Starnet ring is active (`state.starnetRingLife > 0`).

Starnet deployment radius is always shown as a dashed cyan ring around Earth. When active the ring glows. Count displayed as a badge on Earth; red ring when 0 charges remain.

### Earth damage (`src/world.js`)

`addEarthDamage(amount, source)` — increments `state.damage`, triggers burn sites, screen shake. Every 10 HP of damage grants +1 Starnet charge (`state.nextDamageStarnet`). At 100 damage → `endGame()`.

Cracked armored rocks deal half damage on Earth impact. Cracked boss deals 25 HP instead of 50.

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
- **Submit:** calls `submit_score` RPC which enforces max-3 scores per **name** (not per IP); name is locked to the first IP that used it; different IP + same name → "Name is taken"
- **Name check:** calls `check_name` RPC before confirming name in modal; `{"available":true/false}`
- **Fetch:** `GET /rest/v1/leaderboard?select=player_name,score,level&order=score.desc&limit=20`
- **"Is mine" highlighting:** local submissions logged in `localStorage('md_subs')`, matched by name+score+level
- **Name modal:** shown on first visit; stored in `localStorage('md_player_name')`; changeable in Preferences

If `SUPABASE_URL` is empty, leaderboard shows a "not configured" message and all submit calls are no-ops.

---

## Rendering (`src/render.js`)

All drawing on a single `<canvas id="game">` scaled by `devicePixelRatio`.

Draw order per frame:
1. Clear + starfield
2. Starnet range ring — single dashed cyan ring at `starnetRange()` radius; always visible; glows when active
3. Earth (texture + burn sites + health ring + starnet count badge)
4. Satellite (no orbit ring; only the cooldown buffering arc)
5. Moon
6. Rocks (with type-specific visuals: crack lines, magnetic rings, healing cross, comet trail)
7. Projectiles + particles + lasers
8. Hazard/level banner
9. Edge indicators — arrows at screen edge for off-screen incoming rocks
10. Floating texts — score/damage popups that drift upward and fade

No orbital path rings are drawn for the moon or satellite — the only dashed ring is the Starnet range ring.

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

## Scoring reference

All scoring is level-aware unless noted. `L` = current level (1–10).

### Destroy (blast / deflector kills / starnet inside ring)

| Rock | Points |
|---|---|
| Normal (Lv 1–2) | `L × 75` |
| Normal (Lv 3–5, split hit) | `L × 30` for the split + `L × 75` per fragment destroyed |
| Comet | `150 + L × 75` (150 flat bonus + standard destroy) |
| Armored (destroyed) | `L × 75` |
| Magnetic | `L × 75` |
| Boss / Catastrophe | `+500` flat (clearRock skips points for boss; +500 in hitRock) |

### Deflect (rock goes off-screen after deflector push)

| Rock | Points |
|---|---|
| Normal / Armored / Magnetic / Comet | `L × 40` |
| Healing (deflected away) | `−15` penalty |
| Boss | cannot deflect |

### Starnet

| Scenario | Points |
|---|---|
| Rock inside ring → destroyed | `L × 75` each |
| Comet inside ring → destroyed | `150 + L × 75` |
| Rock outside ring → pushed outward, goes off-screen | `L × 40` (deflection credit) |
| Healing rock inside ring → captured | `0` (restores 33% Earth HP) |
| Armored uncracked → cracked but not destroyed | `0` |
| Armored cracked → destroyed | `L × 75` |
| Boss cracked → destroyed | `+500` |
| Boss uncracked → armor cracked | `0` |

### Blast (direct blaster shot)

Blaster hits call `hitRock()` which may `clearRock()` (→ same scoring as Destroy above) or split the rock.

### Healing rock penalty summary

| Action | Points |
|---|---|
| Deflect healing rock off-screen | `−15` |
| Blast healing rock | `−50` |
| Capture with Starnet | `0` (heal only) |
| Healing rock hits Earth | `0` damage, no HP loss |

### Starnet charge refill

Starnet charges do not affect score. Refill sources:
- Every 4th hit or deflection: `state.hitsCleared % 4 === 0` → `+1`
- Every 10 HP of Earth damage: `state.nextDamageStarnet` threshold → `+1`
- Boss kill: `+3` flat
- Level start: `+1` bonus charge

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
