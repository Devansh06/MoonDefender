# Moon Defender — Claude Instructions

## After every feature change to game.js

Run the tutorial sync check:

```
node check-tutorial.js
```

If it fails, update `index.html` (the `#tutorialOverlay` section) so every listed item passes, then re-run until it shows **PASS**.

## When adding a new feature

1. Implement it in `game.js`
2. Add its display name to the correct category in `check-tutorial.js` FEATURES manifest
3. Add a tutorial entry in `index.html` inside `#tutorialOverlay`
4. Run `node check-tutorial.js` — must pass before the task is complete

## Feature manifest categories

| Category | What counts as an entry |
|---|---|
| Rock Types | Any `rockType` value that has distinct player-facing behaviour |
| Hazard Events | Any `activateHazardEvent` type |
| Weapons | Any selectable weapon button |
| Controls | Any keyboard shortcut or tap mechanic |

## Files

| File | Purpose |
|---|---|
| `game.js` | All game logic |
| `index.html` | Shell + tutorial overlay |
| `styles.css` | All styles |
| `check-tutorial.js` | Tutorial sync checker — run after every feature change |
