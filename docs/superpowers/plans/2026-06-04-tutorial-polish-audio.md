# Tutorial Polish + Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix tutorial weapon locks/pacing, add ElevenLabs emotional TTS for Mission Control, add Interstellar-style procedural ambient music.

**Architecture:** `mission-control.js` gains ElevenLabs streaming TTS with `isSpeaking` flag; `tutorial.js` gates `waitFor` on speech completion and adds rock-announce steps; `src/music.js` is a new standalone procedural music engine; `main.js` gets keyboard lock guards and music start wiring.

**Tech Stack:** Vanilla ES modules, ElevenLabs REST API, Web Audio API, Web Speech API (fallback).

**Spec:** `docs/superpowers/specs/2026-06-04-tutorial-polish-audio-design.md`

---

## File Map

| Action | File | Change |
|---|---|---|
| Git | — | New branch `tutorial-polish` |
| Modify | `src/mission-control.js` | ElevenLabs streaming, isSpeaking, remove raspy settings |
| Modify | `src/tutorial.js` | isSpeaking gate, slow rock flag, announce steps, silence on X |
| Modify | `src/main.js` | Keyboard tutLocked guards, silence() calls, music trigger, EL key save |
| Modify | `src/state.js` | Add elApiKeyInput, elApiKeySaveBtn, musicMuteBtn to els |
| Modify | `index.html` | API key input + music mute in Preferences |
| Modify | `styles.css` | pref-input, pref-voice-row styles |
| Create | `src/music.js` | Procedural ambient music engine |

---

## Task 1: New branch

**Files:** git only

- [ ] **Step 1: Create and push branch**

```bash
cd e:/MoonDefender
git checkout -b tutorial-polish
git push -u origin tutorial-polish
```

Expected: branch created, pushed to origin.

- [ ] **Step 2: Verify**

```bash
git branch --show-current
```

Expected output: `tutorial-polish`

---

## Task 2: Remove raspy voice + add `isSpeaking` flag

**Files:**
- Modify: `src/mission-control.js`

- [ ] **Step 1: Rewrite mission-control.js**

Replace the entire file with:

```js
import { els } from "./state.js";

const TYPEWRITER_SPEED = 30;
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

let typewriterTimer = null;
let hideTimer = null;
let audioCtx = null;
let currentSource = null;

export const missionControl = {
  isSpeaking: false,

  getKey() {
    return localStorage.getItem("mc_el_key") || "";
  },

  async speak(text) {
    const bubble = els.mcBubble;
    const textEl  = els.mcText;
    if (!bubble || !textEl) return;

    this.silence();
    this.isSpeaking = true;

    bubble.classList.remove("mc-hidden");
    textEl.textContent = "";

    let i = 0;
    typewriterTimer = setInterval(() => {
      textEl.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(typewriterTimer);
    }, 1000 / TYPEWRITER_SPEED);

    const key = this.getKey();

    if (key) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
          {
            method: "POST",
            headers: {
              "xi-api-key": key,
              "Content-Type": "application/json",
              "Accept": "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_turbo_v2",
              voice_settings: {
                stability: 0.55,
                similarity_boost: 0.75,
                style: 0.5,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);

        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === "suspended") await audioCtx.resume();

        const buf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);
        const source = audioCtx.createBufferSource();
        source.buffer = decoded;
        source.connect(audioCtx.destination);
        currentSource = source;
        source.onended = () => {
          this.isSpeaking = false;
          currentSource = null;
          hideTimer = setTimeout(() => bubble.classList.add("mc-hidden"), 1200);
        };
        source.start();
        return;
      } catch (err) {
        console.warn("ElevenLabs failed, falling back to Web Speech:", err);
      }
    }

    // Fallback: Web Speech API
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      const female = voices.find(v =>
        /female|woman|samantha|karen|zira|victoria|moira|fiona|tessa/i.test(v.name)
      ) || voices.find(v => v.lang.startsWith("en")) || null;
      if (female) utter.voice = female;
      utter.onend = () => {
        this.isSpeaking = false;
        hideTimer = setTimeout(() => bubble.classList.add("mc-hidden"), 1200);
      };
      speechSynthesis.speak(utter);
    } else {
      const readMs = Math.max(2000, (text.split(" ").length / 150) * 60000);
      hideTimer = setTimeout(() => {
        this.isSpeaking = false;
        bubble.classList.add("mc-hidden");
      }, readMs);
    }
  },

  silence() {
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (currentSource) {
      try { currentSource.stop(); } catch (_) {}
      currentSource = null;
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    this.isSpeaking = false;
    els.mcBubble?.classList.add("mc-hidden");
  },

  setIcon(svgString) {
    const icon = els.mcBubble?.querySelector(".mc-icon");
    if (icon) icon.outerHTML = svgString;
  },
};
```

- [ ] **Step 2: Verify no syntax errors**

Open the game in browser (http://localhost:8080), open DevTools Console. Should be no import errors.

- [ ] **Step 3: Commit**

```bash
git add src/mission-control.js
git commit -m "feat: ElevenLabs streaming TTS for Mission Control, isSpeaking flag, remove raspy settings"
```

---

## Task 3: Speech gate in tutorialTick + slow rocks

**Files:**
- Modify: `src/tutorial.js`
- Modify: `src/main.js` (spawnScriptedRock)

- [ ] **Step 1: Add isSpeaking guard to tutorialTick**

In `src/tutorial.js`, find `tutorialTick`:

```js
export function tutorialTick(dt) {
  if (!activeSequence || currentStep < 0 || currentStep >= activeSequence.length) return;
  tutorialClock += dt;
  const step = activeSequence[currentStep];
  if (step.waitFor && step.waitFor()) advanceStep();
}
```

Replace with:

```js
export function tutorialTick(dt) {
  if (!activeSequence || currentStep < 0 || currentStep >= activeSequence.length) return;
  tutorialClock += dt;
  if (missionControl.isSpeaking) return;
  const step = activeSequence[currentStep];
  if (step.waitFor && step.waitFor()) advanceStep();
}
```

- [ ] **Step 2: Add `slow` parameter to spawnScriptedRock in main.js**

Find `spawnScriptedRock` in `src/main.js` (line 83). Replace:

```js
export function spawnScriptedRock(type, angleOverride) {
  const far = Math.max(state.w, state.h) * 0.68 + state.earth.r;
  const angle = angleOverride !== undefined ? angleOverride : Math.random() * Math.PI * 2;
  const pos = {
    x: state.earth.x + Math.cos(angle) * far,
    y: state.earth.y + Math.sin(angle) * far,
  };
  const targetAngle = Math.atan2(state.earth.y - pos.y, state.earth.x - pos.x);
  const speed = type === "comet" ? 96 : 64;
  const r = type === "comet" ? 8 : type === "healing" ? 14 : type === "magnetic" ? 19 : 15;
```

With:

```js
export function spawnScriptedRock(type, angleOverride, slow = false) {
  const far = Math.max(state.w, state.h) * 0.68 + state.earth.r;
  const angle = angleOverride !== undefined ? angleOverride : Math.random() * Math.PI * 2;
  const pos = {
    x: state.earth.x + Math.cos(angle) * far,
    y: state.earth.y + Math.sin(angle) * far,
  };
  const targetAngle = Math.atan2(state.earth.y - pos.y, state.earth.x - pos.x);
  const speedMult = slow ? 0.45 : 1;
  const speed = (type === "comet" ? 96 : 64) * speedMult;
  const r = type === "comet" ? 8 : type === "healing" ? 14 : type === "magnetic" ? 19 : 15;
```

- [ ] **Step 3: Pass `true` for slow in all COMBAT_STEPS spawn calls**

In `src/tutorial.js`, update all `spawnScriptedRock` calls in `COMBAT_STEPS` to pass `true` as the third argument:

```js
spawnScriptedRock("normal", Math.PI * 0.75, true);   // step 1
spawnScriptedRock("normal", Math.PI * 0.25, true);   // step 2
spawnScriptedRock("magnetic", Math.PI * 1.5, true);  // step 3
// step 5 (4 rocks):
[Math.PI * 0.1, Math.PI * 0.6, Math.PI * 1.1, Math.PI * 1.7].forEach(a => spawnScriptedRock("normal", a, true));
```

- [ ] **Step 4: Pass `true` for slow in all ROCK_TYPE_STEPS spawn calls**

In `src/tutorial.js`, update every `spawnScriptedRock` call inside `ROCK_TYPE_STEPS`:

```js
spawnScriptedRock("normal",      Math.PI * 0.75, true);
spawnScriptedRock("comet",       Math.PI * 0.5,  true);
spawnScriptedRock("armored",     Math.PI * 1.25, true);
spawnScriptedRock("magnetic",    Math.PI * 1.0,  true);
spawnScriptedRock("healing",     Math.PI * 0.9,  true);
// catastrophe uses spawnBoss() — no change
```

- [ ] **Step 5: Commit**

```bash
git add src/tutorial.js src/main.js
git commit -m "feat: isSpeaking gate in tutorialTick, slow rocks in tutorial (0.45x speed)"
```

---

## Task 4: Keyboard weapon lock fix + X button silences MC

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add tutLocked guards to keydown handler**

Find the keydown listener in `src/main.js` (line 392):

```js
window.addEventListener("keydown", (event) => {
  if (event.key === "1" || event.code === "Numpad1") { selectWeapon("deflector"); autoAttack("deflector"); }
  if (event.key === "2" || event.code === "Numpad2") { selectWeapon("blaster");   autoAttack("blaster"); }
  if (event.key === "3" || event.key.toLowerCase() === "s" || event.code === "Numpad3") useStarnet();
  if (event.key === "=" || event.key === "+") cycleSpeed();
  if (event.key.toLowerCase() === "p" || event.key === "Escape") { event.preventDefault(); togglePause(); }
  if (event.code === "Space") { event.preventDefault(); if (state.running) useStarnet(); else resetGame(); }
});
```

Replace with:

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
```

- [ ] **Step 2: Add missionControl.silence() to all close/exit actions**

Import `missionControl` at the top of `src/main.js`. Find the existing import from `tutorial.js`:

```js
import { tutorialTick, startCombat, startRockTypes, tutEndStartMission, tutEndBackToTutorials } from "./tutorial.js";
```

Add a separate import for missionControl:

```js
import { missionControl } from "./mission-control.js";
```

Then update these event listeners in `src/main.js`:

**exitBtn** (line 317):
```js
els.exitBtn.addEventListener("click", () => {
  missionControl.silence();
  if (state.running) endGame("Mission abandoned.");
});
```

**tutSelCloseBtn** (line 335):
```js
els.tutSelCloseBtn.addEventListener("click", () => {
  missionControl.silence();
  els.tutorialSelectOverlay.classList.remove("show");
  els.overlay.classList.add("show");
});
```

**tutSelBackBtn** (line 339):
```js
els.tutSelBackBtn.addEventListener("click", () => {
  missionControl.silence();
  els.tutorialSelectOverlay.classList.remove("show");
  els.overlay.classList.add("show");
});
```

**tutEndBackBtn** (line 353):
```js
els.tutEndBackBtn.addEventListener("click", () => {
  missionControl.silence();
  tutEndBackToTutorials();
});
```

**rockEntryCloseBtn** (line 360):
```js
els.rockEntryCloseBtn.addEventListener("click", () => {
  missionControl.silence();
  els.rockEntryScreen.classList.remove("show");
  els.overlay.classList.add("show");
});
```

**rockEntryBackBtn** (line 364):
```js
els.rockEntryBackBtn.addEventListener("click", () => {
  missionControl.silence();
  els.rockEntryScreen.classList.remove("show");
  els.tutorialSelectOverlay.classList.add("show");
});
```

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "fix: keyboard weapon lock respects tutLocked, X/back buttons silence MC"
```

---

## Task 5: ElevenLabs API key in Preferences

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/state.js`
- Modify: `src/main.js`

- [ ] **Step 1: Add API key input + music mute to Preferences in index.html**

In `index.html`, find the `<div class="prefs-list">` block (line 291). Insert these two rows BEFORE the closing `</div>` of `.prefs-list` (before line 314):

```html
              <div class="pref-row pref-row-block">
                <span class="pref-label">MC Voice (ElevenLabs)</span>
                <div class="pref-voice-row">
                  <input id="elApiKeyInput" class="pref-input" type="password" placeholder="Paste API key" autocomplete="off"/>
                  <button id="elApiKeySaveBtn" class="setting-btn" type="button">Save</button>
                </div>
              </div>
              <div class="pref-row">
                <span class="pref-label">Music</span>
                <button id="musicMuteBtn" class="setting-btn toggle" type="button">
                  <small id="musicMuteLabel">On</small>
                </button>
              </div>
```

- [ ] **Step 2: Add CSS for pref-input and pref-voice-row to styles.css**

Append to `styles.css`:

```css
/* ── Prefs voice row ── */
.pref-voice-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}
.pref-input {
  flex: 1;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  font-size: 0.82em;
  padding: 5px 10px;
  outline: none;
}
.pref-input:focus {
  border-color: rgba(114,230,255,0.5);
}
```

- [ ] **Step 3: Add new els entries to state.js**

In `src/state.js`, add to the `els` object after `rockEntryBackBtn`:

```js
  elApiKeyInput:   document.getElementById("elApiKeyInput"),
  elApiKeySaveBtn: document.getElementById("elApiKeySaveBtn"),
  musicMuteBtn:    document.getElementById("musicMuteBtn"),
  musicMuteLabel:  document.getElementById("musicMuteLabel"),
```

- [ ] **Step 4: Wire Save button + load saved key in main.js**

In `src/main.js`, add after the existing prefs listeners (after line 376):

```js
// ElevenLabs API key save
els.elApiKeySaveBtn.addEventListener("click", () => {
  const key = els.elApiKeyInput.value.trim();
  if (key) {
    localStorage.setItem("mc_el_key", key);
    els.elApiKeyInput.value = "";
    els.elApiKeyInput.placeholder = "Key saved ✓";
    setTimeout(() => { els.elApiKeyInput.placeholder = "Paste API key"; }, 2000);
  }
});
// Show masked hint if key already saved
if (localStorage.getItem("mc_el_key")) {
  els.elApiKeyInput.placeholder = "Key saved ✓";
}
```

- [ ] **Step 5: Verify in browser**

Open Preferences → see "MC Voice" row with password input and Save button. Paste a dummy value, click Save. Reload — placeholder should show "Key saved ✓".

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css src/state.js src/main.js
git commit -m "feat: ElevenLabs API key input in Preferences, music mute toggle HTML"
```

---

## Task 6: Tutorial 2 — rock type announce steps

**Files:**
- Modify: `src/tutorial.js`

Each rock type in `ROCK_TYPE_STEPS` gets a two-step sequence: an announce step (MC names the rock, waits for speech to end) then the existing explain+spawn step.

- [ ] **Step 1: Replace ROCK_TYPE_STEPS in tutorial.js**

Find the entire `const ROCK_TYPE_STEPS = { ... };` block and replace it with:

```js
const ROCK_TYPE_STEPS = {
  normal: [
    {
      enter() { missionControl.speak("Normal Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("normal", Math.PI * 0.75, true);
        missionControl.speak("Standard debris. Small ones go down in one hit. Level 3 to 5 splits on impact — one hit becomes two rocks.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 30; },
    },
  ],
  comet: [
    {
      enter() { missionControl.speak("Comet inbound."); },
      waitFor() { return !missionControl.isSpeaking; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("comet", Math.PI * 0.5, true);
        missionControl.speak("Three times normal speed. Fragile — one hit drops it. Worth 150 bonus points.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 30; },
    },
  ],
  armored: [
    {
      enter() { missionControl.speak("Armored Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("armored", Math.PI * 1.25, true);
        missionControl.speak("There's a sequence. Learn it or waste shots. Two deflector hits redirect uncracked armor. Or blast to crack it, then one more deflect. Two blasts destroy it entirely.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 40; },
    },
  ],
  magnetic: [
    {
      enter() { missionControl.speak("Magnetic Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        spawnScriptedRock("magnetic", Math.PI * 1.0, true);
        missionControl.speak("That dotted ring is a gravity well. Pulling other rocks toward it. You cannot deflect it — blast it or use Starnet. Kill the source — pull stops instantly.");
      },
      waitFor() { return state.hitsCleared > prevHitsCleared || tutorialClock > 35; },
    },
  ],
  healing: [
    {
      enter() { missionControl.speak("Healing Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking; },
    },
    {
      enter() {
        spawnScriptedRock("healing", Math.PI * 0.9, true);
        missionControl.speak("This one's different. Don't shoot it. Figure out how to bring it in safely.");
      },
      waitFor() {
        return !state.rocks.some(r => !r.cleared && r.rockType === "healing") || tutorialClock > 20;
      },
    },
  ],
  catastrophe: [
    {
      enter() { missionControl.speak("Catastrophe Rock inbound."); },
      waitFor() { return !missionControl.isSpeaking; },
    },
    {
      enter() {
        prevHitsCleared = state.hitsCleared;
        state.bossActive = true;
        spawnBoss();
        missionControl.speak("Boss-class. Three orbiting companions. Crack the shell first — two hits. One more ends it. Starnet on uncracked armor bounces back. You've been warned.");
      },
      waitFor() {
        return !state.rocks.some(r => !r.cleared && r.rockType === "boss") || tutorialClock > 60;
      },
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/tutorial.js
git commit -m "feat: Tutorial 2 announces each rock type before spawning"
```

---

## Task 7: Procedural ambient music engine

**Files:**
- Create: `src/music.js`

- [ ] **Step 1: Create src/music.js**

```js
let ctx = null;
let masterGain = null;
let started = false;
let muted = false;
let bassInterval = null;

function buildImpulseResponse(duration, decay) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const ir = ctx.createBuffer(2, length, sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return ir;
}

function makeOsc(freq, type, detuneC, gainVal) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detuneC;
  gain.gain.value = gainVal;
  osc.connect(gain);
  osc.start();
  return gain;
}

export const music = {
  start() {
    if (started) return;
    started = true;

    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.1, ctx.currentTime + 5);

    // Reverb
    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulseResponse(3.5, 2);
    const dryGain  = ctx.createGain();
    const wetGain  = ctx.createGain();
    dryGain.gain.value = 0.6;
    wetGain.gain.value = 0.4;

    masterGain.connect(dryGain);
    masterGain.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(ctx.destination);
    wetGain.connect(ctx.destination);

    // Organ drone: 4 oscillators
    const oscMix = ctx.createGain();
    oscMix.gain.value = 1;
    [
      makeOsc(55,  "sine",     0,    0.6),
      makeOsc(110, "sine",     1.5,  0.35),
      makeOsc(165, "triangle", -2,   0.18),
      makeOsc(220, "sine",     0.8,  0.12),
    ].forEach(g => g.connect(oscMix));

    // Filter with LFO
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    filter.Q.value = 1.2;
    oscMix.connect(filter);
    filter.connect(masterGain);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.04;
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // Bass pulse every 2.5 seconds
    bassInterval = setInterval(() => {
      if (!ctx || muted) return;
      const bassOsc  = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = "sine";
      bassOsc.frequency.value = 27.5;
      bassGain.gain.setValueAtTime(0, ctx.currentTime);
      bassGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.12);
      bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
      bassOsc.connect(bassGain);
      bassGain.connect(masterGain);
      bassOsc.start();
      bassOsc.stop(ctx.currentTime + 1.5);
    }, 2500);
  },

  stop() {
    if (bassInterval) { clearInterval(bassInterval); bassInterval = null; }
    if (masterGain) masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  },

  setVolume(v) {
    if (masterGain) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
  },

  toggle() {
    muted = !muted;
    this.setVolume(muted ? 0 : 0.1);
    localStorage.setItem("mc_music_muted", muted ? "1" : "0");
    return muted;
  },

  loadPref() {
    muted = localStorage.getItem("mc_music_muted") === "1";
    return muted;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/music.js
git commit -m "feat: procedural ambient music engine — organ drone, bass pulse, reverb"
```

---

## Task 8: Wire music into the game

**Files:**
- Modify: `src/main.js`
- Modify: `src/state.js` (already done in Task 5 — musicMuteBtn added)

- [ ] **Step 1: Import music in main.js**

At the top of `src/main.js`, add:

```js
import { music } from "./music.js";
```

- [ ] **Step 2: Start music on first pointer interaction**

In `src/main.js`, find the existing `shell.addEventListener("pointerdown", ...)` listener (line 313):

```js
shell.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button") || els.overlay.classList.contains("show")) return;
  shoot(event.clientX, event.clientY);
});
```

Replace with:

```js
let musicStarted = false;
shell.addEventListener("pointerdown", (event) => {
  if (!musicStarted) { music.start(); musicStarted = true; }
  if (event.target.closest("button") || els.overlay.classList.contains("show")) return;
  shoot(event.clientX, event.clientY);
});
```

Also add: start music on any button click on the main overlay (so it starts even before game begins):

After the `els.startBtn.addEventListener` line (line 329), add:

```js
// Start music on first interaction anywhere
document.addEventListener("pointerdown", () => {
  if (!musicStarted) { music.start(); musicStarted = true; }
}, { once: true });
```

- [ ] **Step 3: Wire music mute toggle**

After the existing prefs listeners in `src/main.js`, add:

```js
// Music mute toggle
music.loadPref();
els.musicMuteBtn.addEventListener("click", () => {
  const muted = music.toggle();
  els.musicMuteLabel.textContent = muted ? "Off" : "On";
  els.musicMuteBtn.classList.toggle("off", muted);
});
if (music.loadPref()) {
  els.musicMuteLabel.textContent = "Off";
  els.musicMuteBtn.classList.add("off");
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: wire ambient music — starts on first interaction, mute toggle in Preferences"
```

---

## Task 9: Run check-tutorial.js + verify

- [ ] **Step 1: Run check**

```bash
node check-tutorial.js
```

Expected output: `PASS  Tutorial covers all features.`

- [ ] **Step 2: If PASS, commit check result note**

```bash
git commit --allow-empty -m "chore: confirm check-tutorial passes on tutorial-polish branch"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| New branch `tutorial-polish` | Task 1 |
| Remove raspy voice (pitch/rate) | Task 2 |
| ElevenLabs streaming TTS | Task 2 |
| `isSpeaking` flag | Task 2 |
| Speech gate in tutorialTick | Task 3 |
| Slow rocks (0.45x) | Task 3 |
| Keyboard tutLocked guards | Task 4 |
| X button + overlays silence MC | Task 4 |
| API key in Preferences (localStorage) | Task 5 |
| Music mute toggle in Preferences HTML | Task 5 |
| Tutorial 2 announce steps | Task 6 |
| Procedural music engine | Task 7 |
| Music wired + starts on first interaction | Task 8 |
| check-tutorial.js PASS | Task 9 |

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:** `spawnScriptedRock(type, angle, slow)` defined in Task 3 main.js, called with `slow=true` in Task 3 tutorial.js and Task 6. `missionControl.isSpeaking` set in Task 2, read in Task 3 tutorialTick and Task 6 waitFor. `music.start()` / `music.toggle()` / `music.loadPref()` defined in Task 7, called in Task 8. All consistent.
