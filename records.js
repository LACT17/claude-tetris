// Tabla de records local: top 5 + mejor combo + máximo de líneas.
// Usa los globales de game.js (score, lines, maxCombo). localStorage siempre en try/catch.
const REC_KEY = 'tetris.records';
const REC_TOP = 5;
const REC_NAME_MAX = 12;
const REC_DEFAULT_NAME = 'JUGADOR';

const recListEls = [document.getElementById('records-list'), document.getElementById('records-list-over')];
const recStatsEl = document.getElementById('records-stats');
const recResetBtn = document.getElementById('records-reset');
const recOver = document.getElementById('records-over');
const recNewEl = document.getElementById('records-new');
const recForm = document.getElementById('records-form');
const recNameInput = document.getElementById('records-name');

let recData = { top: [], bestCombo: 0, maxLines: 0 };
let recMine = null; // entrada de la partida actual (para resaltarla y renombrarla)

function loadRecords() {
  try {
    const d = JSON.parse(localStorage.getItem(REC_KEY));
    if (d && Array.isArray(d.top)) {
      recData = {
        top: d.top.filter(e => e && Number.isFinite(e.score)).slice(0, REC_TOP)
          .map(e => ({ name: String(e.name || REC_DEFAULT_NAME).slice(0, REC_NAME_MAX), score: e.score })),
        bestCombo: Number(d.bestCombo) || 0,
        maxLines: Number(d.maxLines) || 0,
      };
    }
  } catch (e) { /* sin almacenamiento o datos corruptos: se usa la copia en memoria */ }
}

function saveRecords() {
  try { localStorage.setItem(REC_KEY, JSON.stringify(recData)); } catch (e) { /* almacenamiento no disponible */ }
}

function renderRecords() {
  recListEls.forEach(ul => {
    if (!ul) return;
    ul.textContent = '';
    for (let i = 0; i < REC_TOP; i++) {
      const e = recData.top[i];
      const li = document.createElement('li');
      const n = document.createElement('span');
      const s = document.createElement('span');
      n.className = 'rn';
      if (e) {
        n.textContent = `${i + 1}. ${e.name}`;
        s.textContent = e.score.toLocaleString();
        if (e === recMine) li.classList.add('mine');
      } else {
        n.textContent = `${i + 1}. ---`;
        s.textContent = '0';
        li.classList.add('empty');
      }
      li.append(n, s);
      ul.appendChild(li);
    }
  });
  if (recStatsEl) {
    const bc = recData.bestCombo >= 1 ? `x${recData.bestCombo + 1}` : '-';
    recStatsEl.textContent = `Mejor combo: ${bc}\nMáx. líneas: ${recData.maxLines}`;
  }
}

// Llamado desde endGame() (game.js); solo se invoca una vez por partida.
function onGameOverRecords() {
  loadRecords(); // otra pestaña pudo haber guardado records entre tanto
  recData.maxLines = Math.max(recData.maxLines, lines);
  recData.bestCombo = Math.max(recData.bestCombo, maxCombo);
  recMine = null;
  const last = recData.top[REC_TOP - 1];
  const qualifies = score > 0 && (recData.top.length < REC_TOP || score > last.score);
  if (qualifies) {
    recMine = { name: REC_DEFAULT_NAME, score };
    // en empate, la puntuación nueva queda por debajo de las existentes iguales
    let idx = recData.top.findIndex(e => score > e.score);
    if (idx === -1) idx = recData.top.length;
    recData.top.splice(idx, 0, recMine);
    recData.top.length = Math.min(recData.top.length, REC_TOP);
  }
  saveRecords();
  renderRecords();
  recOver.hidden = false;
  recNewEl.hidden = !qualifies;
  recForm.hidden = !qualifies;
  if (qualifies) {
    recNameInput.value = REC_DEFAULT_NAME;
    recNameInput.focus();
    recNameInput.select();
  }
}

// Escribir el nombre no debe mover la pieza: el keydown del juego está en document.
recNameInput.addEventListener('keydown', e => e.stopPropagation());

recForm.addEventListener('submit', e => {
  e.preventDefault();
  if (recMine) {
    recMine.name = recNameInput.value.trim().slice(0, REC_NAME_MAX) || REC_DEFAULT_NAME;
    saveRecords();
    renderRecords();
  }
  recForm.hidden = true;
  recNameInput.blur();
});

recResetBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) { recResetBtn.blur(); return; }
  recData = { top: [], bestCombo: 0, maxLines: 0 };
  recMine = null;
  recNewEl.hidden = true; // el aviso de nuevo récord ya no aplica
  recForm.hidden = true;
  saveRecords();
  renderRecords();
  recResetBtn.blur(); // evita que Space/Enter reactiven el botón
});

// El overlay también sirve para la pausa: ocultar la tabla cuando se cierra.
new MutationObserver(() => {
  if (overlay.classList.contains('hidden')) recOver.hidden = true;
}).observe(overlay, { attributes: true, attributeFilter: ['class'] });

loadRecords();
renderRecords();
