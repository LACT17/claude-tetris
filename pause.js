// Menú de pausa: Reanudar, Reiniciar (botón #restart-btn de game.js),
// Ver controles y Nivel inicial. Depende de game.js (togglePause, paused, restartBtn).
const startLevelSel = document.getElementById('start-level');
const resumeBtn = document.getElementById('resume-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');

for (let i = 1; i <= 15; i++) startLevelSel.add(new Option(i, i));

try {
  const saved = parseInt(localStorage.getItem('startLevel'), 10);
  if (saved >= 1 && saved <= 15) startLevelSel.value = saved;
} catch (e) { /* almacenamiento no disponible */ }
window.startLevel = parseInt(startLevelSel.value, 10) || 1; // se aplica en la próxima init()

startLevelSel.addEventListener('change', () => {
  window.startLevel = parseInt(startLevelSel.value, 10) || 1;
  try { localStorage.setItem('startLevel', String(window.startLevel)); } catch (e) { /* ignorar */ }
  startLevelSel.blur(); // evita que las flechas lo cambien al volver al juego
});

resumeBtn.addEventListener('click', () => {
  resumeBtn.blur(); // evita que Space/Enter reactiven el botón
  if (paused) togglePause();
});

controlsBtn.addEventListener('click', () => {
  const show = controlsList.hidden;
  controlsList.hidden = !show;
  controlsBtn.setAttribute('aria-expanded', String(show));
  controlsBtn.blur();
});

// Reiniciar usa el listener de game.js (init); aquí solo quitamos el foco
// y cerramos el panel de controles.
restartBtn.addEventListener('click', () => {
  restartBtn.blur();
  controlsList.hidden = true;
  controlsBtn.setAttribute('aria-expanded', 'false');
});
