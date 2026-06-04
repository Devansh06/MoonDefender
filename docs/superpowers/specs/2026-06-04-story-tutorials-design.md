# Story Tutorials + Mission Control Agent — Design Spec

**Date:** 2026-06-04  
**Status:** Approved

---

## Overview

Two interactive tutorials guided by a persistent Mission Control (MC) agent. MC is a standalone module usable anywhere in the game — not locked to tutorials. Tutorials run inside the real game engine with real physics; rocks move at normal speed with very low spawn rate.

---

## 1. Architecture

### New files

| File | Purpose |
|---|---|
| `src/mission-control.js` | Standalone MC agent — speech bubble UI, TTS voice, public API |
| `src/tutorial.js` | Tutorial engine — scripted sequences, game API hooks |

### Modified files

| File | Changes |
|---|---|
| `index.html` | Tutorial select overlay, MC bubble element, MC SVG icon |
| `src/main.js` | Expose game API hooks, wire Tutorial button to select screen |
| `src/state.js` | Add `tutorialMode`, `tutorialStep`, `hitsCleared` |
| `src/rocks.js` | Add `hitsCleared` counter (blasts + deflections); trigger +1 starnet every 3 `hitsCleared` in normal gameplay |
| `src/hud.js` | `lockWeapon(name)` / `unlockWeapon(name)` helpers |

### Data flow

```
Tutorial button → tutorialSelectOverlay
  → user picks → tutorial.js.startCombat() or startRockTypes(rockType)
      → pauseNormalSpawning()
      → lockWeapons([...])
      → spawnScriptedRock(type)
      → missionControl.speak(text)
      → waitFor(condition)
      → ... next step
  → tutorial ends → choice screen (Combat) or return to select (Rock Types)
```

---

## 2. Mission Control Agent (`src/mission-control.js`)

Standalone module. Importable by tutorial, hazard events, level transitions, boss fights — anything.

### Public API

```js
missionControl.speak(text)     // show bubble + play TTS voice
missionControl.silence()       // hide bubble, cancel speech
missionControl.setIcon(svg)    // swap icon (optional, has default)
```

### UI

- **Position:** floating top-center of game canvas, above HUD
- **Style:** semi-transparent dark panel, glowing border, SVG icon left of text
- **Icon:** SVG headset/comms symbol (no text label)
- **Text:** types in character-by-character for cinematic feel
- Bubble fades out automatically when speech ends; hides on `silence()`

### Voice

- **Engine:** Web Speech API (`SpeechSynthesisUtterance`)
- **Voice selection:** iterate `speechSynthesis.getVoices()`, pick first female voice available on the OS (name contains "female", "woman", or common female names like "Samantha", "Karen", "Zira")
- **Raspy effect:** Web Speech API does not expose an audio stream so Web Audio routing is not possible. Raspiness achieved through voice selection + settings: `pitch: 0.78`, `rate: 0.88`. Lower pitch + slower rate on a female voice produces a naturally graver, grittier quality. Best result depends on OS voice library.
- **Fallback:** if Web Speech API not supported, bubble shows text only, no audio — silent failure, no error thrown

---

## 3. Tutorial Engine (`src/tutorial.js`)

### Game API (exposed by `main.js`)

```js
pauseNormalSpawning()          // stop the regular rock spawn clock
resumeNormalSpawning()         // restore it
spawnScriptedRock(type, opts)  // spawn one rock of given type, slow entry speed optional
lockWeapons(nameArray)         // disable all weapon buttons not in array
unlockWeapon(name)             // enable one weapon button
setTutorialMode(bool)          // sets state.tutorialMode, suppresses hazards + level transitions
```

### Wait conditions

Each tutorial step has a `waitFor` function checked every game frame:

```js
{ waitFor: () => state.hitsCleared > prevHits }
{ waitFor: () => state.selectedWeapon === 'blaster' }
{ waitFor: () => state.starnetRingLife > 0 }
{ waitFor: () => timer > stepStartTime + 3 }   // timed delay
```

### `hitsCleared` mechanic

New counter in `state.js`. Incremented by `rocks.js` on every successful deflection **or** blaster destroy. Every 3 `hitsCleared` awards +1 Starnet charge in normal gameplay (replaces current deflection-only mechanic).

---

## 4. Tutorial 1 — Combat Sequence

Entry: Tutorial Select → "Combat Tutorial"  
Weapons start locked. Hazards and level transitions suppressed. Normal rock speed; no auto-spawn.

| Step | Action | MC Line | Advance Condition |
|---|---|---|---|
| ★ | Cinematic opening | *"This is Mission Control. We've picked up a hostile approach vector. Earth is not ready. You are."* | 3 seconds |
| 1 | Deflector locked. Spawn 1 normal rock. (hit 1/3) | *"Rock inbound. Tap toward it — the Deflector fires a push-pulse. Redirect it."* | player deflects |
| 2 | Spawn 1 normal rock, different angle. (hit 2/3) | *"Another one. Different angle. Stay sharp."* | player deflects |
| 3 | Unlock Blaster. Spawn 1 **Magnetic Rock**. | *"Magnetic contact. Deflecting it won't kill the pull — it'll keep dragging others toward it. Switch to Blaster, key 2. Destroy it."* | player switches to Blaster |
| 4 | Magnetic rock closes in. (hit 3/3 → Starnet auto-unlocks) | *"Fire."* | blaster hits rock → `hitsCleared` = 3 → `unlockWeapon('starnet')` → MC: *"Starnet is now available."* |
| 5 | Spawn 4 rocks from spread directions. | *"Four contacts — too many to pick off. Starnet deploys a full ring shield. Space bar. Use it."* | player fires Starnet |
| 6 | 1.5s pause after Starnet resolves. | *"You start with only two charges. Refill them with 3 blasts or deflections. Use them wisely."* | 1.5 seconds |
| ✓ | Tutorial complete. Show choice screen. | *"Earth is still standing. Your call, soldier."* | player taps button |

**End screen buttons:**
- **Start Mission** → `resumeNormalSpawning()`, `setTutorialMode(false)`, start Level 1
- **Back to Tutorials** → return to Tutorial Select overlay

---

## 5. Tutorial 2 — Rock Types Sequence

Entry: Tutorial Select → "Rock Types" → **Entry Screen**

### Entry Screen

Six rock-type buttons displayed before tutorial begins. Player picks one to jump directly to that rock, or taps **"All rocks (start from Normal)"** for the full sequence. After completing one rock in sequential mode, the tutorial auto-advances to the next.

Default entry point: **Normal Rock**.

### Rock sequences (one per type)

All weapons unlocked in Rock Types tutorial. Player interacts freely. Advance condition: player successfully deals with the rock as instructed.

| Rock | MC Line | Methods shown | Advance condition |
|---|---|---|---|
| **Normal Rock** | *"Standard debris. Small ones go down in one hit. Level 3–5 splits on impact."* | Deflect (redirects) · Blast Lv1-2 (destroys) · Blast Lv3-5 (splits) · Starnet (destroys all in range) | rock cleared |
| **Comet** | *"Three times normal speed. Fragile — one hit drops it. Worth 150 bonus points."* | Deflect (destroys) · Blast (destroys) · Starnet (destroys in range) | rock cleared |
| **Armored Rock** | *"There's a sequence. Learn it or waste shots."* | Deflect×2 (redirects uncracked) · Blast→Deflect · Blast×2 (destroys) · Starnet (any state) | rock cleared |
| **Magnetic Rock** | *"That dotted ring is a gravity well. Pulling other rocks toward it. Kill the source — pull stops instantly."* | Blast (destroys, stops pull) · Starnet (destroys in range) · **Deflect: not possible** | rock cleared |
| **Healing Rock** | *"This one's different. Don't shoot it. Figure out how to bring it in safely."* | Deflect ❌ · Blast ❌ · ??? (player discovers Starnet capture) | rock captured or dismissed after 20s |
| **Catastrophe Rock** | *"Boss-class. Three orbiting companions. Crack the shell first — 2 hits. One more ends it. Starnet on uncracked armor bounces back."* | Blast×3 · Deflect after crack · Starnet on cracked only | rock destroyed |

After last rock (or single-rock mode): return to Tutorial Select overlay.

---

## 6. Tutorial Select Overlay

Triggered by the existing **Tutorial** button on the main menu. Replaces direct-link to old static tutorial.

Three options:
1. **Combat Tutorial** — story-driven weapon training
2. **Rock Types Guide** — learn each rock type, pick entry point
3. **How-to-Play** — existing static reference screen (unchanged)

---

## 7. Numpad Controls

Add numpad key support in `main.js` keyboard handler alongside existing `1` / `2` / `3` bindings:

| Numpad key | Action |
|---|---|
| `Numpad1` | Select Deflector (same as `1`) |
| `Numpad2` | Select Blaster (same as `2`) |
| `Numpad3` | Activate Starnet (same as `3` / Space) |

Also update the tutorial overlay Controls section in `index.html` to show `1 / Numpad1`, `2 / Numpad2`, `Space / 3 / Numpad3`.

---

## 8. Implementation Notes

- Tutorial sequences are data (array of step objects), not procedural code — easy to extend
- `spawnScriptedRock` bypasses the normal spawn clock and level-gating
- Magnetic rocks cannot be deflected — **needs verification in `rocks.js`**; if deflection is not already blocked, add an early return in the deflect path when `rock.type === 'magnetic'`
- `hitsCleared` counter replaces `deflectionsCleared` as the trigger for Starnet refill (+1 every 3 hits in normal play); `deflectionsCleared` still tracked separately for stats
- MC bubble is an HTML element overlaid on the canvas, not drawn on canvas — avoids re-render cost
- Web Audio distortion node reused across all `speak()` calls; AudioContext created once on first `speak()`
