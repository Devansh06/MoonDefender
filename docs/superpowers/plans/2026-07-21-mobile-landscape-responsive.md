# Mobile Landscape Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three specific rendering problems that make Moon Defender broken on landscape mobile: earth distortion, too-large earth radius (no arena space), and HUD elements that don't scale down.

**Architecture:** Three independent, targeted fixes — no structural changes. (1) Lock canvas CSS size to `window.innerWidth/Height` in JS so it never mismatches the pixel buffer. (2) Remove the 96px earth-radius floor in `world.js` so small screens get a smaller earth and more arena space. (3) Add a `max-height: 480px` landscape CSS breakpoint that compresses HUD panels, gaps, and fonts.

**Tech Stack:** Vanilla JS ES modules, CSS, HTML5 canvas. No build step. Test by serving with `python -m http.server` and opening on a phone or DevTools device emulation.

---

## Files

| File | Change |
|------|--------|
| `index.html` | Viewport meta — add `user-scalable=no, viewport-fit=cover` |
| `src/world.js` | `resize()` — fix canvas CSS size + earth radius formula |
| `styles.css` | Add `@media (max-height: 480px) and (orientation: landscape)` block |

---

### Task 1: Viewport meta — prevent accidental zoom and handle notches

**Files:**
- Modify: `index.html` line 5

- [ ] **Step 1: Update the viewport meta tag**

Find this line in `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```
Replace with:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
```

`user-scalable=no` stops accidental pinch-to-zoom during gameplay. `viewport-fit=cover` makes the canvas fill behind notches/home-bar on iPhones.

- [ ] **Step 2: Verify**

Open `index.html` in DevTools → toggle device toolbar → pick iPhone 14 Pro in landscape. The page should not zoom when two-finger-pinching on the canvas.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: viewport meta — disable user zoom, cover notch for mobile"
```

---

### Task 2: Fix canvas distortion in world.js

**Files:**
- Modify: `src/world.js` — `resize()` function, lines 9–51

**Root cause:** The canvas CSS `width`/`height` come from `100%` of `.game-shell` which is `100vw × 100vh`. On mobile, `window.innerHeight` ≠ `100vh` when the browser chrome (address bar) is visible — the canvas pixel buffer is sized to `innerHeight` but the CSS stretches it to `100vh`. Earth draws as an oval.

- [ ] **Step 1: Explicitly set canvas CSS dimensions in `resize()`**

In `src/world.js`, after the line `ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);` (line 15), add:

```js
canvas.style.width  = state.w + 'px';
canvas.style.height = state.h + 'px';
```

Full updated block (lines 9–16):
```js
export function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width  = Math.floor(state.w * state.dpr);
  canvas.height = Math.floor(state.h * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  canvas.style.width  = state.w + 'px';
  canvas.style.height = state.h + 'px';
```

- [ ] **Step 2: Verify**

DevTools → iPhone 14 Pro landscape → reload. Earth should be a perfect circle, not an oval. Toggle the DevTools address bar on/off (simulate scroll) — earth stays round.

- [ ] **Step 3: Commit**

```bash
git add src/world.js
git commit -m "fix: lock canvas CSS size to window.innerWidth/Height to prevent earth distortion"
```

---

### Task 3: Fix earth radius — remove the 96px floor

**Files:**
- Modify: `src/world.js` — `resize()` function, `state.earth` block (lines 17–22)

**Root cause:** `clamp(shortSide * 0.21, 96, 190)`. On a 390px phone, `390 * 0.21 = 81.9` — clamped UP to 96. Moon orbit = `96 * 1.82 = 175px`. On a 390px-tall landscape screen that leaves only `390 - 350 = 40px` of vertical arena. Removing the 96px floor and using `Math.min(shortSide * 0.17, 190)` gives earth.r ≈ 66px on a 390px screen, moon orbit ≈ 120px, ~150px of vertical arena.

- [ ] **Step 1: Update earth radius formula**

In `src/world.js`, find:
```js
  state.earth = {
    x: state.w * 0.5,
    y: state.h * 0.52,
    r: clamp(shortSide * 0.21, 96, 190),
  };
```
Replace with:
```js
  state.earth = {
    x: state.w * 0.5,
    y: state.h * 0.52,
    r: Math.min(shortSide * 0.17, 190),
  };
```

The `clamp` import from `./utils.js` is still used elsewhere in the file — do not remove the import.

- [ ] **Step 2: Verify sizes across devices**

Open DevTools, check these device presets and confirm earth + moon orbit fit comfortably with visible arena space:

| Device | shortSide | earth.r | moon orbit | arena (approx) |
|--------|-----------|---------|------------|----------------|
| iPhone SE landscape | 375 | 63 | 115 | 145px tall |
| iPhone 14 Pro landscape | 390 | 66 | 120 | 150px tall |
| iPad mini landscape | 744 | 126 | 229 | 286px tall |
| Desktop 1080p | 1080 | 183 | 333 | 414px tall |

Earth should look appropriately sized — not tiny, not overwhelming. The moon orbit ring should be fully visible on screen.

- [ ] **Step 3: Commit**

```bash
git add src/world.js
git commit -m "fix: earth radius scales down for small screens — removes 96px minimum that ate arena space"
```

---

### Task 4: CSS — landscape phone HUD scaling

**Files:**
- Modify: `styles.css` — add new media query block after the existing `@media (max-width: 680px)` block (currently ends around line 894)

**Current problem:** The existing `@media (max-width: 680px)` breakpoint is for portrait phones. In landscape, the phone width is ~844px (breakpoint not triggered) but height is only 390px. The weapon panel at 4 × 52px + gaps = 228px is fine, but at the default sizing it pushes into the game area. Add a landscape-height breakpoint that compresses everything.

- [ ] **Step 1: Add landscape breakpoint to `styles.css`**

Append this block at the end of `styles.css`:

```css
/* ── Landscape phone / short screen ── */
@media (max-height: 480px) and (orientation: landscape) {
  .top-hud {
    gap: 4px;
  }

  .metric {
    min-height: 34px;
    padding: 4px 8px;
  }

  .metric strong {
    font-size: 16px;
  }

  .weapon-panel {
    gap: 4px;
  }

  .weapon {
    min-height: 36px;
    min-width: 90px;
    padding: 5px 8px;
    column-gap: 6px;
  }

  .weapon .icon {
    width: 22px;
    height: 22px;
    font-size: 14px;
  }

  .weapon small,
  .weapon span:not(.icon) {
    font-size: 10px;
  }

  .hud-btn {
    width: 36px;
    height: 36px;
    min-height: 36px;
    font-size: 15px;
  }

  .exit-btn {
    min-height: 32px;
    font-size: 13px;
  }

  .mc-bubble {
    top: clamp(36px, 6vh, 50px);
    padding: 7px 12px 7px 10px;
    gap: 8px;
  }

  .mc-text {
    font-size: clamp(0.68rem, 1.6vw, 0.78rem);
  }
}
```

- [ ] **Step 2: Also add `100dvh` fallback to `.game-shell` for mobile browsers that support it**

Find in `styles.css`:
```css
.game-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  touch-action: none;
}
```
Replace with:
```css
.game-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  touch-action: none;
}
```

(`100dvh` = dynamic viewport height; tracks the visible area as browser chrome shows/hides. Older browsers ignore it and fall back to `100vh`. Task 2's JS fix handles the pixel-buffer sync regardless.)

- [ ] **Step 3: Verify**

DevTools → iPhone 14 Pro → Landscape → reload.
- All 4 weapon buttons should be visible without scrolling
- Metrics (Level/Time/Score + HP bar) should fit on the left side
- Earth + moon orbit visible in the center with clear space around them
- Mission Control bubble should not overlap the weapon panel

Also test portrait on same device — the `max-width: 680px` breakpoint still handles it separately, no regression.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "fix: landscape phone HUD — compact metrics and weapon panel for short screens"
```

---

### Task 5: Smoke-test on real devices / emulation

- [ ] **Step 1: Start dev server**

```bash
cd e:/MoonDefender
python -m http.server 8080
```

- [ ] **Step 2: Test landscape phone**

Open DevTools → device toolbar → iPhone 14 Pro → Landscape (390×844 rotated → 844×390).

Check:
- [ ] Earth is a circle, not oval
- [ ] Earth + moon orbit fully visible with space around them
- [ ] All HUD panels (Level/Time/Score + 4 weapon buttons) visible without overlap
- [ ] Tap on earth triggers Starnet (touch target correct)
- [ ] Tap off-center fires deflector toward that point
- [ ] Mission Control bubble appears at top, doesn't cover game area badly

- [ ] **Step 3: Test landscape tablet**

DevTools → iPad Air → Landscape (1180×820).

Check:
- [ ] HUD at normal size (landscape breakpoint should NOT fire — height 820 > 480px)
- [ ] Earth radius ≈ `Math.min(820 * 0.17, 190) = 139px` — visually appropriate
- [ ] Overlays (Start, End screen) fit and scroll if needed

- [ ] **Step 4: Test portrait phone (regression)**

DevTools → iPhone 14 Pro → Portrait (390×844).

Check:
- [ ] `max-width: 680px` breakpoint fires — top metrics in 3-col grid
- [ ] Weapon panel on right at existing compact size
- [ ] No regression from landscape-only changes

- [ ] **Step 5: Final commit if any tweaks made**

```bash
git add -p   # stage only intentional changes
git commit -m "fix: mobile landscape smoke-test tweaks"
```
