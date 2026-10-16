# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla JavaScript Tetris (HTML5 Canvas + CSS). No `package.json`, no build, no tests, no linter. The README is in Spanish; code comments and docs follow that language.

## Running

- Open `index.html` directly, or serve statically: `npx serve .` / `python3 -m http.server 8000`.
- Docker (optional): `docker compose up` serves the repo on host port `8767` (override with `TETRIS_PORT`; container port via `CONTAINER_PORT`, default 3000). The repo is bind-mounted at `/workspace`, so edits show up without rebuilding. `restart: "no"` is intentional — it never autostarts. `.devcontainer/` reuses the same compose service.

## Architecture

Three files, all logic in `game.js` (~300 lines, global scope, no modules):

- `index.html` — `<canvas id="board">` (300×600), a `next-canvas` preview, HUD elements (`score`, `lines`, `level`), and an `overlay` for pause/game over.
- `game.js` — board is a `ROWS × COLS` matrix of `0` or a color index (1–8). Pieces are square matrices (index 8 is the 3×3 "tuerca" with an empty center, spawned with probability `NUT_CHANCE`) rotated by `rotateCW` (transpose + reverse); `tryRotate` applies wall kicks of ±1/±2 columns. Loop is `requestAnimationFrame`-based (`loop`), accumulating `dropAccum` against `dropInterval`. Drop speed is `max(100, 1000 − (level−1)·90)` ms; level rises every 10 lines; scoring uses `LINE_SCORES × level`, +1/cell soft drop, +2/cell hard drop. `clearLines(tspin)` also applies combo multiplier (x2…x8, `combo` = -1 when idle), T-spin scoring (`isTSpin`, 3-corner rule, needs `lastMoveWasRotation`), B2B ×1.5 for Tetris/T-spin (`b2b`) and Perfect Clear bonus. Effects: `emitFX(name, data)` calls optional `window.GameFX[name]` hooks (`lineClear`, `combo`, `tSpin`, `backToBack`, `perfectClear`, `gameOver`) for engine integration, and `showBanner` shows the `#fx-banner` text.
  Challenge mode: `MODES` defines each level (goal: `goalLines` / `timeLimit` / `surviveTime`; modifiers: `garbageEvery`, `preRows`, `invisible`, `reverseFromLevel`), chosen via `#mode-select` and read in `init()`. `loop` advances `elapsed`/`garbageAccum`; `checkObjective()` ends the run through `endGame(title, won)`; `addGarbageRow`, `fillPreBlocks` and `reverseRotation` implement the mechanics; `updateObjective` renders the `#objective` HUD text. Garbage/fixed blocks use color index 9.
  Abilities: the upcoming pieces live in `queue` (always `PREVIEW_COUNT` long; `next` = `queue[0]`, drawn only via `takeNext()`). `energy` (0–`ENERGY_MAX`) grows in `clearLines` (`ENERGY_PER_CLEAR`); `useAbility(name)` (keys 1–5 / `C`, or click in the left panel) charges `ABILITIES[name].cost` and runs `previewLeft` (show 5), `swapPiece`, `slowLeft` (gravity ×`SLOW_FACTOR` for 10 s), `undoPlacement` (one-level snapshot taken in `lockPiece` via `saveUndo`) or `holdPiece` (once per piece, `canHold`). Nothing is charged if the ability can't be applied.
- `style.css` — dark/retro styling.

Constraint: `COLS × BLOCK` and `ROWS × BLOCK` must match the `width`/`height` attributes of `<canvas id="board">` in `index.html` — change both together.
