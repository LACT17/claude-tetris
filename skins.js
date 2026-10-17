'use strict';

(function () {

// Skins visuales: cada una define su paleta (índices 1–9, igual que COLORS) y su función de dibujo.
// game.js delega en window.SkinDraw desde drawBlock; devuelve false para usar el dibujo Retro original.

const SKIN_NAMES = ['retro', 'neon', 'pastel', 'pixel'];

const NEON_COLORS = [
  null,
  '#00f0ff', '#ffee00', '#d400ff', '#39ff14', '#ff1744', '#4d9bff', '#ff9100',
  '#e0e0ff', // tuerca
  '#7c8aa5', // basura / fijos
];

const PASTEL_COLORS = [
  null,
  '#8fd8e4', '#ffe082', '#cfa8ec', '#a5deac', '#f4a9a9', '#a6cbf5', '#f9c58a',
  '#c3ced5', // tuerca
  '#9aabb6', // basura / fijos
];

const PIXEL_COLORS = [
  null,
  '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ff9800',
  '#90a4ae', // tuerca
  '#546e7a', // basura / fijos
];

// Rectángulo con esquinas redondeadas (path manual, sin depender de roundRect)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawNeonBlock(context, x, y, colorIndex, size) {
  const color = NEON_COLORS[colorIndex];
  const px = x * size + 2, py = y * size + 2, s = size - 4;
  context.save();
  context.shadowColor = color;
  context.shadowBlur = size * 0.45;
  context.fillStyle = color + '55';
  context.fillRect(px, py, s, s);
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.strokeRect(px, py, s, s);
  context.restore();
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
}

function drawPastelBlock(context, x, y, colorIndex, size) {
  const color = PASTEL_COLORS[colorIndex];
  const px = x * size + 1.5, py = y * size + 1.5, s = size - 3;
  const r = Math.max(2, size * 0.28);
  roundedRectPath(context, px, py, s, s, r);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.75)';
  context.lineWidth = Math.max(1, size * 0.07);
  context.stroke();
  // brillo suave superior
  roundedRectPath(context, px + s * 0.15, py + s * 0.12, s * 0.7, s * 0.22, r * 0.5);
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fill();
}

function drawPixelBlock(context, x, y, colorIndex, size) {
  const color = PIXEL_COLORS[colorIndex];
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  // textura: cuadrícula de 4x4 "píxeles" con tablero de ajedrez claro/oscuro
  const n = 4, cell = s / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i + j) % 2) continue;
      context.fillStyle = 'rgba(0,0,0,0.14)';
      context.fillRect(px + i * cell, py + j * cell, cell, cell);
    }
  }
  // bisel: luz arriba/izquierda, sombra abajo/derecha
  const b = Math.max(2, Math.round(size / 8));
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fillRect(px, py, s, b);
  context.fillRect(px, py, b, s);
  context.fillStyle = 'rgba(0,0,0,0.4)';
  context.fillRect(px, py + s - b, s, b);
  context.fillRect(px + s - b, py, b, s);
}

const SKIN_DRAWERS = { neon: drawNeonBlock, pastel: drawPastelBlock, pixel: drawPixelBlock };
let activeSkin = 'retro';

// Llamado por drawBlock en game.js. Devuelve true si la skin dibujó el bloque.
window.SkinDraw = function (context, x, y, colorIndex, size, alpha) {
  const fn = SKIN_DRAWERS[activeSkin];
  if (!fn) return false;
  context.save();
  // el fantasma (alpha bajo) se ve poco sobre fondos extremos: alpha mínimo en las skins
  context.globalAlpha = alpha === undefined ? 1 : Math.max(alpha, 0.45);
  fn(context, x, y, colorIndex, size);
  context.restore();
  return true;
};

function redrawAll() {
  if (typeof current === 'undefined' || !current) return;
  draw();
  drawNext();
  drawHold();
  drawPreview();
}

function applySkin(name) {
  if (!SKIN_NAMES.includes(name)) name = 'retro';
  activeSkin = name;
  document.documentElement.dataset.skin = name;
  // el color de la cuadrícula depende de --grid, que cambia con la skin
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  const sel = document.getElementById('skin-select');
  if (sel) sel.value = name;
  redrawAll();
}

const skinSelect = document.getElementById('skin-select');
skinSelect.addEventListener('change', () => {
  try { localStorage.setItem('skin', skinSelect.value); } catch (e) { /* almacenamiento no disponible */ }
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas cambien de skin a mitad de partida
});

let savedSkin = 'retro';
try { savedSkin = localStorage.getItem('skin') || 'retro'; } catch (e) { /* sin almacenamiento */ }
applySkin(savedSkin);
})();
