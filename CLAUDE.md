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
- `game.js` — board is a `ROWS × COLS` matrix of `0` or a color index (1–7). Pieces are square matrices rotated by `rotateCW` (transpose + reverse); `tryRotate` applies wall kicks of ±1/±2 columns. Loop is `requestAnimationFrame`-based (`loop`), accumulating `dropAccum` against `dropInterval`. Drop speed is `max(100, 1000 − (level−1)·90)` ms; level rises every 10 lines; scoring uses `LINE_SCORES × level`, +1/cell soft drop, +2/cell hard drop.
- `style.css` — dark/retro styling.

Constraint: `COLS × BLOCK` and `ROWS × BLOCK` must match the `width`/`height` attributes of `<canvas id="board">` in `index.html` — change both together.
