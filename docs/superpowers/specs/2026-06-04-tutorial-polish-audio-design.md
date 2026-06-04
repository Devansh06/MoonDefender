# Tutorial Polish + Audio Design Spec

**Date:** 2026-06-04  
**Status:** Approved

---

## Overview

Two parallel workstreams:

1. **Tutorial fixes & improvements** — bug fixes, pacing changes, rock announcements, keyboard lock fix
2. **Audio** — ElevenLabs streaming TTS for Mission Control + procedural Interstellar-style ambient music

---

## Part 1 — Tutorial Fixes & Improvements

### 1.1 New branch

All work lands on `tutorial-polish` branch, pushed to origin.

### 1.2 Remove raspy voice

Delete `pitch: 0.78` and `rate: 0.88` from `mission-control.js`. ElevenLabs replaces the Web Speech API voice entirely; these settings become irrelevant.

### 1.3 MC speech gate — wait for speech before advancing

Add `missionControl.isSpeaking` boolean to `mission-control.js`. Set `true` in `speak()`, set `false` in the `onended` callback of `AudioBufferSourceNode` (ElevenLabs path) and in the fallback timeout completion.

In `tutorialTick(dt)` in `tutorial.js`, add an early-return guard:

```js
if (missionControl.isSpeaking) return; // wait for MC to finish
```

This means every step's `waitFor` is only evaluated after MC has finished speaking. MC speech *is* the natural pause between steps.

### 1.4 Lock weapon — keyboard bypass fix

Currently `keydown` in `main.js` calls `selectWeapon("blaster")` regardless of tutorial locks. Fix: check `dataset.tutLocked` before acting.

```js
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
  // ... rest unchanged
});
```

The deflector button has no `disabled` logic in `updateHud` so no guard is needed there — it stays locked once `lockWeapon("deflector")` sets `disabled = true`.

### 1.5 Slow rocks in tutorial

`spawnScriptedRock(type, angle, slow)` gains optional third parameter `slow` (boolean, default `false`). When `true`, multiplies speed by `0.45`.

All `spawnScriptedRock` calls in `tutorial.js` pass `true` for slow:
```js
spawnScriptedRock("normal", Math.PI * 0.75, true);
```

### 1.6 Tutorial 2 — show rock type before spawning

Each rock-type step in `ROCK_TYPE_STEPS` is split into two sub-steps:
1. **Announce step**: MC speaks the rock name (e.g. *"Normal Rock incoming."*), `waitFor` waits for `!missionControl.isSpeaking`
2. **Explain + spawn step**: existing step with MC explanation + rock spawn

This means players see the rock type called out before it arrives.

### 1.7 X button stops MC

Add `missionControl.silence()` call to every overlay close action in `main.js`:
- `exitBtn` click
- `tutSelCloseBtn`, `tutSelBackBtn`
- `tutEndBackBtn`
- `rockEntryCloseBtn`, `rockEntryBackBtn`

---

## Part 2 — Audio

### 2.1 ElevenLabs TTS (`src/mission-control.js`)

**API:**
- Endpoint: `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/stream`
- Voice: `21m00Tcm4TlvDq8ikWAM` (Rachel — warm authoritative female). Stored as `const VOICE_ID`.
- Model: `eleven_turbo_v2` (fast, low latency)
- Voice settings: `{ stability: 0.55, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true }`
- Headers: `xi-api-key: {key}`, `Content-Type: application/json`, `Accept: audio/mpeg`

**Flow:**
1. `speak(text)` fetches audio blob from ElevenLabs
2. Response blob → `AudioContext.decodeAudioData()`
3. Creates `AudioBufferSourceNode`, connects to `AudioContext.destination`
4. `source.start()` — plays immediately when decoded
5. `source.onended` → sets `missionControl.isSpeaking = false`, starts hide timer

**API key storage:**
- Key stored in `localStorage` under key `"mc_el_key"`
- New Preferences overlay field: text input `id="elApiKeyInput"` + "Save" button
- `missionControl.getKey()` reads from localStorage
- If no key: fallback to Web Speech API (existing path)

**isSpeaking tracking:**
- Set `true` at start of `speak()`
- Set `false` in `source.onended` (ElevenLabs) or in the Web Speech `utter.onend` callback
- `silence()` sets `false` immediately + stops audio source

**AudioContext lifecycle:**
- Single `AudioContext` created on first `speak()` call (browser autoplay rule compliance)
- Stored as module-level `let audioCtx = null`
- On `silence()`: stop current source node, don't close context

### 2.2 Preferences overlay — API key input

In `index.html` Preferences panel, add after existing prefs:
```html
<div class="pref-row">
  <span class="pref-label">Mission Control Voice</span>
  <div class="pref-voice-row">
    <input id="elApiKeyInput" class="pref-input" type="password" placeholder="ElevenLabs API key" autocomplete="off"/>
    <button id="elApiKeySaveBtn" class="setting-btn" type="button">Save</button>
  </div>
</div>
```

Save button writes to localStorage. On page load, if key exists, input shows `"••••••••"` placeholder.

Wire in `state.js` + `main.js`.

### 2.3 Procedural ambient music (`src/music.js`)

**Architecture:** Standalone module, no imports from game modules. Exposes `music.start()`, `music.stop()`, `music.setVolume(v)`, `music.toggle()`.

**Signal graph:**

```
[Oscillators x4] → [GainNode: osc mix]
                                       \
[Bass pulse LFO] → [BassOsc] → [BassGain] → [MasterGain] → [ConvolverNode reverb] → destination
                                       /
[Pad LFO] → [BiquadFilter] → [PadGain]
```

**Oscillators (organ drone):**
- Osc 1: `sine`, 55 Hz (A1), gain 0.6
- Osc 2: `sine`, 110 Hz (A2), gain 0.35
- Osc 3: `triangle`, 165 Hz (E3 approx), gain 0.18
- Osc 4: `sine`, 220 Hz (A3), gain 0.12
- Slight detuning: osc1 +0, osc2 +1.5 cents, osc3 −2 cents, osc4 +0.8 cents

**LFO for filter movement:**
- `sine`, 0.04 Hz (one cycle per 25 seconds)
- Modulates `BiquadFilter.frequency` between 200–800 Hz
- Filter type: `lowpass`, Q: 1.2

**Bass pulse:**
- `sine`, 27.5 Hz
- Triggered every 2.5 seconds via `setInterval`
- Per pulse: gain envelope — attack 0.1s → peak 0.5 → decay 1.2s → 0
- Creates the "heartbeat" pulse of Interstellar

**Reverb:**
- `ConvolverNode` with synthetically generated impulse response
- IR generation: white noise × exponential decay (`decayTime: 3.5s`)
- Dry/wet: 0.4 wet

**Master volume:** 0.10 (subtle background)

**Startup:** `music.start()` called on first `pointerdown` anywhere on the page (browser autoplay compliance). Fade-in over 4 seconds.

**Mute toggle:** Added to Preferences overlay. Stores preference in `localStorage("mc_music_muted")`.

---

## Files Changed / Created

| Action | File | Change |
|---|---|---|
| Modify | `src/mission-control.js` | ElevenLabs streaming, isSpeaking, AudioContext, key lookup |
| Modify | `src/tutorial.js` | isSpeaking gate in tutorialTick, slow rock flag, announce steps in Tutorial 2, silence on X |
| Modify | `src/main.js` | Keydown tutLocked guards, silence() calls, music start trigger, API key save wiring |
| Modify | `src/state.js` | Add elApiKeyInput, elApiKeySaveBtn, music mute toggle to els |
| Modify | `src/hud.js` | deflector tutLocked guard in updateHud |
| Modify | `index.html` | API key input in prefs, music mute toggle in prefs |
| Modify | `styles.css` | Styles for pref-input, pref-voice-row |
| Create | `src/music.js` | Procedural ambient music engine |
| Git | — | `git checkout -b tutorial-polish` |
