'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#89cff0', // J - baby blue
  '#ffb74d', // L - orange
  '#b0bec5', // Tuerca - gris acero
  '#607d8b', // Basura / bloques fijos - gris pizarra
];
const GARBAGE = 9;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (3x3, hueco central)
];

const NUT_TYPE = 8;
const NUT_CHANCE = 1 / 12; // probabilidad de que la siguiente pieza sea la tuerca

const LINE_SCORES = [0, 100, 300, 500, 800];

// --- Combos, T-spin, B2B y Perfect Clear ---
const T_TYPE = 3;
const TSPIN_SCORES = [400, 800, 1200, 1600];        // por líneas limpiadas (0-3) × nivel
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]; // bonus plano × nivel
const B2B_MULT = 1.5;      // Tetris / T-spin consecutivos
const COMBO_MAX_MULT = 8;  // tope del multiplicador de combo (x2, x3, ... x8)

// --- Modo desafío ---
// Cada modo combina un objetivo (goalLines / surviveTime / timeLimit, en segundos)
// con modificadores (garbageEvery, preRows, invisible, reverseFromLevel).
const MODES = {
  classic:   { name: 'Clásico', desc: 'Sin objetivo' },
  sprint:    { name: 'Sprint', desc: 'Limpia 40 líneas en 2:00', goalLines: 40, timeLimit: 120 },
  garbage:   { name: 'Basura ascendente', desc: 'Sobrevive 90 s', surviveTime: 90, garbageEvery: 10 },
  fixed:     { name: 'Bloques fijos', desc: 'Limpia 15 líneas', goalLines: 15, preRows: 5, preDensity: 0.45 },
  invisible: { name: 'Invisibles', desc: 'Limpia 10 líneas', goalLines: 10, invisible: true },
  reverse:   { name: 'Rotación inversa', desc: 'Limpia 30 líneas (inversa desde nivel 3)', goalLines: 30, reverseFromLevel: 3 },
};

// Puntos de enganche para el motor: define window.GameFX con cualquiera de
// estos métodos para disparar efectos visuales/sonido propios. Cada uno recibe
// un objeto con los datos del evento. Ejemplo:
//   window.GameFX = { combo: ({ combo, multiplier }) => sfx.play('combo' + combo) };
// Eventos: lineClear, combo, tSpin, backToBack, perfectClear, garbage, gameOver
// (gameOver recibe { score, won } — won es true al superar un reto).
function emitFX(name, data) {
  const hook = window.GameFX && window.GameFX[name];
  if (typeof hook === 'function') hook(data);
}

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const fxBanner = document.getElementById('fx-banner');
const modeSelect = document.getElementById('mode-select');
const objectiveEl = document.getElementById('objective');

let gridColor;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, b2b, lastMoveWasRotation;
let mode, elapsed, garbageAccum; // elapsed y garbageAccum en ms

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.random() < NUT_CHANCE ? NUT_TYPE : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function reverseRotation() {
  return !!mode.reverseFromLevel && level >= mode.reverseFromLevel;
}

function tryRotate() {
  const cw = rotateCW(current.shape);
  // anti-horario = 3 giros horarios
  const rotated = reverseRotation() ? rotateCW(rotateCW(cw)) : cw;
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveWasRotation = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// T-spin (regla de 3 esquinas): pieza T, último movimiento fue una rotación y
// al menos 3 de las 4 esquinas alrededor del centro están ocupadas (o son pared).
// Debe llamarse ANTES de merge().
function isTSpin() {
  if (current.type !== T_TYPE || !lastMoveWasRotation) return false;
  const cx = current.x + 1, cy = current.y + 1; // el centro de la T 3×3 no cambia al rotar
  let corners = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx])) corners++;
  }
  return corners >= 3;
}

function clearLines(tspin) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }

  if (!cleared) {
    combo = -1; // sin limpieza se rompe el combo (B2B se conserva)
    if (tspin) {
      score += TSPIN_SCORES[0] * level;
      emitFX('tSpin', { lines: 0 });
      showBanner(['T-SPIN']);
      updateHUD();
    }
    return;
  }

  const labels = [];
  const difficult = tspin || cleared === 4;
  let gained = (tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared]) * level;

  if (tspin) {
    labels.push(cleared === 1 ? 'T-SPIN SINGLE' : cleared === 2 ? 'T-SPIN DOUBLE' : 'T-SPIN TRIPLE');
    emitFX('tSpin', { lines: cleared });
  } else if (cleared === 4) {
    labels.push('TETRIS');
  }

  if (difficult && b2b) {
    gained = Math.floor(gained * B2B_MULT);
    labels.push('BACK-TO-BACK');
    emitFX('backToBack', { lines: cleared });
  }
  b2b = difficult;

  combo++;
  const multiplier = Math.min(combo + 1, COMBO_MAX_MULT);
  gained *= multiplier;
  if (combo >= 1) {
    labels.push(`COMBO x${multiplier}`);
    emitFX('combo', { combo, multiplier });
  }

  if (board.every(row => row.every(v => v === 0))) {
    gained += (PERFECT_CLEAR_SCORES[cleared] || 0) * level;
    labels.push('PERFECT CLEAR');
    emitFX('perfectClear', { lines: cleared });
  }

  emitFX('lineClear', { lines: cleared, tspin, gained, combo, b2b });
  score += gained;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  showBanner(labels);
  updateHUD();
}

// Efecto visual: texto flotante sobre el tablero (vacío = no muestra nada)
function showBanner(labels) {
  if (!fxBanner || !labels.length) return;
  fxBanner.textContent = labels.join('\n');
  fxBanner.classList.remove('show');
  void fxBanner.offsetWidth; // reinicia la animación CSS
  fxBanner.classList.add('show');
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveWasRotation = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = isTSpin();
  merge();
  clearLines(tspin);
  if (checkObjective()) return;
  spawn();
}

// --- Mecánicas de desafío ---
function fillPreBlocks() {
  for (let r = ROWS - mode.preRows; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++)
      board[r][c] = Math.random() < mode.preDensity ? GARBAGE : 0;
    board[r][Math.floor(Math.random() * COLS)] = 0; // nunca una fila completa
  }
}

function addGarbageRow() {
  const topRowFilled = board[0].some(v => v !== 0);
  board.shift();
  const row = new Array(COLS).fill(GARBAGE);
  row[Math.floor(Math.random() * COLS)] = 0;
  board.push(row);
  emitFX('garbage', {});
  if (topRowFilled) { endGame('GAME OVER'); return; }
  // la pieza activa sube si la fila nueva la invade
  if (collide(current.shape, current.x, current.y)) {
    current.y--;
    if (collide(current.shape, current.x, current.y)) endGame('GAME OVER');
  }
}

// Devuelve true si el reto terminó (victoria o derrota)
function checkObjective() {
  if (gameOver) return true;
  if (mode.goalLines && lines >= mode.goalLines) { endGame('¡RETO SUPERADO!', true); return true; }
  if (mode.timeLimit && elapsed >= mode.timeLimit * 1000) { endGame('TIEMPO AGOTADO'); return true; }
  if (mode.surviveTime && elapsed >= mode.surviveTime * 1000) { endGame('¡SOBREVIVISTE!', true); return true; }
  return false;
}

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateObjective() {
  const parts = [mode.desc];
  if (mode.goalLines) parts.push(`Líneas ${Math.min(lines, mode.goalLines)}/${mode.goalLines}`);
  if (mode.timeLimit) parts.push(`Tiempo ${formatTime(mode.timeLimit * 1000 - elapsed)}`);
  if (mode.surviveTime) parts.push(`Tiempo ${formatTime(mode.surviveTime * 1000 - elapsed)}`);
  if (mode.garbageEvery) parts.push(`Basura en ${formatTime(mode.garbageEvery * 1000 - garbageAccum)}`);
  if (reverseRotation()) parts.push('¡ROTACIÓN INVERSA!');
  const text = parts.join('\n');
  if (objectiveEl.textContent !== text) objectiveEl.textContent = text;
}

function spawn() {
  lastMoveWasRotation = false;
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board (en modo "invisibles" las piezas desaparecen al asentarse; la basura no)
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!mode.invisible || board[r][c] === GARBAGE)
        drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame(title = 'GAME OVER', won = false) {
  if (gameOver) return; // el primer final (victoria o derrota) es el que cuenta
  gameOver = true;
  cancelAnimationFrame(animId);
  emitFX('gameOver', { score, won });
  overlayTitle.textContent = title;
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  if (current) draw();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;

  // temporizadores del reto (con tope para que una pestaña oculta no los dispare)
  const step = Math.min(dt, 250);
  elapsed += step;
  if (mode.garbageEvery) {
    garbageAccum += step;
    if (garbageAccum >= mode.garbageEvery * 1000) {
      garbageAccum = 0;
      addGarbageRow();
    }
  }
  checkObjective();
  updateObjective();
  if (gameOver) { draw(); return; }

  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveWasRotation = false;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() (vía lockPiece → spawn) cancela el frame, pero aquí se
  // reprogramaría de nuevo y las piezas seguirían apareciendo.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  mode = MODES[modeSelect.value] || MODES.classic;
  elapsed = 0;
  garbageAccum = 0;
  if (mode.preRows) fillPreBlocks();
  combo = -1;
  b2b = false;
  lastMoveWasRotation = false;
  if (fxBanner) fxBanner.classList.remove('show');
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  updateObjective();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveWasRotation = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveWasRotation = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

modeSelect.addEventListener('change', () => {
  init();
  modeSelect.blur(); // evita que las flechas cambien de modo a mitad de partida
});

function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  themeBtn.textContent = light ? '☾ Modo oscuro' : '☀ Modo claro';
  themeBtn.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  themeBtn.setAttribute('aria-pressed', String(light));
  if (current) draw(); // en pausa o game over el loop no redibuja
}

themeBtn.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', theme); } catch (e) { /* almacenamiento no disponible */ }
  applyTheme(theme);
  themeBtn.blur(); // evita que Space/Enter reactiven el botón
});

applyTheme(document.documentElement.dataset.theme || 'dark');

init();
