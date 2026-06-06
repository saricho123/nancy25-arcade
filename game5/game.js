'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const CW = 480, CH = 460;
canvas.width = CW;
canvas.height = CH;

// Rack layout: 3 rows × 4 cols
const COLS = 4, ROWS = 3;
const SLOT_W = 100, SLOT_H = 90;
const RACK_X = 28;   // centered: (480 - 4*100 - 3*8 - 2*10) / 2 + 10
const RACK_Y = 35;
const GAP_X = 8, GAP_Y = 10;
const TOTAL_SLOTS = COLS * ROWS;

// Rack outer frame
const FRAME_PAD = 10;
const FRAME_X = RACK_X - FRAME_PAD;
const FRAME_Y = RACK_Y - FRAME_PAD;
const FRAME_W = COLS * SLOT_W + (COLS - 1) * GAP_X + FRAME_PAD * 2;
const FRAME_H = ROWS * SLOT_H + (ROWS - 1) * GAP_Y + FRAME_PAD * 2;

const SHOE_SRCS = Array.from({length: 12}, (_, i) =>
  `assets/shoe_${String(i + 1).padStart(2, '0')}.png`
);

const imgs = [];
let imgsLoaded = 0;

const MEMORIZE_SECS = 5;
const PLAY_SECS = 20;

const state = {
  phase: 'loading',
  target: Array.from({length: TOTAL_SLOTS}, (_, i) => i),
  current: Array.from({length: TOTAL_SLOTS}, (_, i) => i),
  drag: { active: false, fromSlot: -1, x: 0, y: 0 },
  timeLeft: PLAY_SECS,
  memorizeLeft: MEMORIZE_SECS,
  lastNow: 0,
  score: 0,
  flashSlots: null,
  flashStart: 0,
};

function slotRect(idx) {
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  return {
    x: RACK_X + col * (SLOT_W + GAP_X),
    y: RACK_Y + row * (SLOT_H + GAP_Y),
    w: SLOT_W,
    h: SLOT_H,
  };
}

function slotAt(px, py) {
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const r = slotRect(i);
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
  }
  return -1;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function drawShoeInRect(imgIdx, rx, ry, rw, rh, alpha) {
  const img = imgs[imgIdx];
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = alpha ?? 1;
  const scale = Math.min(rw / img.naturalWidth, rh / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rx + (rw - dw) / 2;
  const dy = ry + (rh - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawBg() {
  const grad = ctx.createLinearGradient(0, 0, 0, CH);
  grad.addColorStop(0, '#18060e');
  grad.addColorStop(1, '#0a020a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, CH);
}

function drawRack(arrangement) {
  // Outer frame
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, FRAME_X, FRAME_Y, FRAME_W, FRAME_H, 8);
  ctx.fillStyle = '#100808';
  ctx.fill();
  ctx.strokeStyle = '#3a1020';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Shelf planks (one per row, at bottom of each row)
  for (let row = 0; row < ROWS; row++) {
    const plankY = RACK_Y + row * (SLOT_H + GAP_Y) + SLOT_H - 4;
    const plankX = FRAME_X + 4;
    const plankW = FRAME_W - 8;
    const plankH = 10;

    const woodGrad = ctx.createLinearGradient(0, plankY, 0, plankY + plankH);
    woodGrad.addColorStop(0, '#5a3520');
    woodGrad.addColorStop(0.4, '#3d2414');
    woodGrad.addColorStop(1, '#1a0e08');
    ctx.fillStyle = woodGrad;
    ctx.beginPath();
    roundRect(ctx, plankX, plankY, plankW, plankH, 3);
    ctx.fill();

    ctx.strokeStyle = '#7a4a2a';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Slot backgrounds
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const r = slotRect(i);
    ctx.fillStyle = '#18080c';
    ctx.beginPath();
    roundRect(ctx, r.x, r.y, r.w, r.h, 4);
    ctx.fill();
    ctx.strokeStyle = '#2a1020';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Shoes
  const dragging = state.drag.active;
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    if (dragging && state.drag.fromSlot === i) continue;
    const r = slotRect(i);
    drawShoeInRect(arrangement[i], r.x + 2, r.y + 2, r.w - 4, r.h - 12, 1);
  }
}

function drawDragging() {
  if (!state.drag.active) return;
  const shoeIdx = state.current[state.drag.fromSlot];
  const dw = SLOT_W * 1.12, dh = SLOT_H * 1.12;
  const img = imgs[shoeIdx];
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = 0.88;
  const scale = Math.min(dw / img.naturalWidth, dh / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  ctx.drawImage(img, state.drag.x - sw / 2, state.drag.y - sh / 2, sw, sh);
  ctx.restore();
}

function drawFlashOverlay(t) {
  if (!state.flashSlots) return;
  const alpha = Math.max(0, 1 - t * 3);
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const correct = state.flashSlots[i];
    const r = slotRect(i);
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = correct ? '#00ff88' : '#ff2244';
    ctx.beginPath();
    roundRect(ctx, r.x, r.y, r.w, r.h, 4);
    ctx.fill();
    ctx.restore();
  }
}

function drawMemorizeOverlay(secsLeft) {
  // Text goes below the rack — rack stays fully visible
  const textTop = FRAME_Y + FRAME_H + 10;
  ctx.save();

  // subtle dark band only in the text area below the rack
  ctx.fillStyle = 'rgba(14, 2, 10, 0.78)';
  ctx.fillRect(0, textTop - 2, CW, CH - textTop + 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.font = '11px "Press Start 2P", monospace';
  ctx.fillStyle = '#ff55bb';
  ctx.shadowColor = '#ff55bb';
  ctx.shadowBlur = 12;
  ctx.fillText('MEMORIZE!', CW / 2, textTop + 6);

  ctx.font = 'bold 38px "Press Start 2P", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ff55bb';
  ctx.shadowBlur = 24;
  ctx.fillText(Math.ceil(secsLeft), CW / 2, textTop + 30);

  ctx.restore();
}

function drawHUD() {
  ctx.save();
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';
  ctx.shadowBlur = 0;

  const phase = state.phase;

  // Phase label (top-left)
  ctx.fillStyle = '#ff55bb';
  ctx.textAlign = 'left';
  if (phase === 'play') {
    ctx.fillStyle = '#ffaadd';
    ctx.fillText('DRAG TO SORT', 10, 10);
  } else if (phase === 'flash') {
    ctx.fillStyle = '#ffd700';
    ctx.fillText('CHECKING...', 10, 10);
  }

  // Timer (top-right)
  if (phase === 'play') {
    const t = Math.ceil(state.timeLeft);
    ctx.fillStyle = t <= 5 ? '#ff4444' : '#ff55bb';
    ctx.textAlign = 'right';
    ctx.fillText('TIME: ' + t, CW - 10, 10);
  }

  ctx.restore();
}

function drawScreen() {
  const now = performance.now();
  drawBg();

  if (state.phase === 'memorize') {
    drawRack(state.target);
    drawMemorizeOverlay(state.memorizeLeft);
  } else if (state.phase === 'play') {
    drawRack(state.current);
    drawDragging();
  } else if (state.phase === 'flash') {
    drawRack(state.current);
    const elapsed = (now - state.flashStart) / 1000;
    drawFlashOverlay(elapsed);
  }

  drawHUD();
}

let rafId = null;

function loop(now) {
  const dt = Math.min((now - state.lastNow) / 1000, 0.1);
  state.lastNow = now;

  if (state.phase === 'memorize') {
    state.memorizeLeft -= dt;
    if (state.memorizeLeft <= 0) startPlayPhase();
  } else if (state.phase === 'play') {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      triggerValidate();
    }
  } else if (state.phase === 'flash') {
    const elapsed = (now - state.flashStart) / 1000;
    if (elapsed > 0.9) showEndOverlay();
  }

  drawScreen();
  rafId = requestAnimationFrame(loop);
}

function startMemorizePhase() {
  state.phase = 'memorize';
  state.memorizeLeft = MEMORIZE_SECS;
}

function startPlayPhase() {
  // Scramble current from target
  state.current = [...state.target];
  shuffle(state.current);
  // Make sure it's actually scrambled (re-shuffle if accidentally same)
  let same = state.current.every((v, i) => v === state.target[i]);
  while (same) {
    shuffle(state.current);
    same = state.current.every((v, i) => v === state.target[i]);
  }
  state.phase = 'play';
  state.timeLeft = PLAY_SECS;
  state.drag.active = false;
}

function triggerValidate() {
  const results = state.current.map((v, i) => v === state.target[i]);
  const correct = results.filter(Boolean).length;
  state.score = correct;
  state.flashSlots = results;
  state.flashStart = performance.now();
  state.phase = 'flash';
  state.drag.active = false;
}

function showEndOverlay() {
  cancelAnimationFrame(rafId);
  const won = state.score === TOTAL_SLOTS;
  document.getElementById('end-icon').textContent = won ? '🏆' : '👟';
  document.getElementById('end-title').textContent = won ? 'PERFECT!' : "TIME'S UP!";
  document.getElementById('end-score').textContent =
    `${state.score}/${TOTAL_SLOTS} CORRECT!`;
  document.getElementById('end-msg').textContent = won
    ? 'Nanky knows her own shoes! 👠✨'
    : `So close! ${TOTAL_SLOTS - state.score} shoes out of place.`;
  document.getElementById('end-overlay').classList.remove('hidden');
}

function startGame() {
  document.getElementById('start-overlay').classList.add('hidden');
  document.getElementById('end-overlay').classList.add('hidden');

  // Canonical target: 0–11 in order
  for (let i = 0; i < TOTAL_SLOTS; i++) state.target[i] = i;
  state.drag.active = false;
  state.flashSlots = null;
  state.lastNow = performance.now();

  startMemorizePhase();

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function resetGame() {
  cancelAnimationFrame(rafId);
  document.getElementById('end-overlay').classList.add('hidden');
  startGame();
}

// --- Pointer events ---

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (CW / rect.width),
    y: (e.clientY - rect.top) * (CH / rect.height),
  };
}

canvas.addEventListener('pointerdown', e => {
  if (state.phase !== 'play') return;
  const {x, y} = canvasCoords(e);
  const slot = slotAt(x, y);
  if (slot < 0) return;
  state.drag.active = true;
  state.drag.fromSlot = slot;
  state.drag.x = x;
  state.drag.y = y;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', e => {
  if (!state.drag.active) return;
  const {x, y} = canvasCoords(e);
  state.drag.x = x;
  state.drag.y = y;
});

canvas.addEventListener('pointerup', e => {
  if (!state.drag.active) return;
  const {x, y} = canvasCoords(e);
  const toSlot = slotAt(x, y);
  if (toSlot >= 0 && toSlot !== state.drag.fromSlot) {
    const tmp = state.current[state.drag.fromSlot];
    state.current[state.drag.fromSlot] = state.current[toSlot];
    state.current[toSlot] = tmp;
  }
  state.drag.active = false;
  canvas.classList.remove('dragging');
});

canvas.addEventListener('pointercancel', () => {
  state.drag.active = false;
  canvas.classList.remove('dragging');
});

// --- Buttons ---

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('replay-btn').addEventListener('click', resetGame);
document.getElementById('done-btn').addEventListener('click', () => {
  if (state.phase === 'play') triggerValidate();
});
document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = '../index.html';
});
document.getElementById('back-btn2').addEventListener('click', () => {
  window.location.href = '../index.html';
});
document.getElementById('menu-btn').addEventListener('click', () => {
  window.location.href = '../index.html';
});

// --- Canvas roundRect polyfill ---
function roundRect(c, x, y, w, h, r) {
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
}

// --- Load images ---
function loadImages() {
  drawBg();
  ctx.fillStyle = '#ff55bb';
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LOADING...', CW / 2, CH / 2);

  SHOE_SRCS.forEach((src, i) => {
    const img = new Image();
    img.onload = () => {
      imgsLoaded++;
      if (imgsLoaded === SHOE_SRCS.length) {
        state.phase = 'start';
        drawBg();
        drawRack(state.target);
        drawScreen();
        if (window.self !== window.top) startGame();
      }
    };
    img.onerror = () => { imgsLoaded++; };
    img.src = src;
    imgs[i] = img;
  });
}

loadImages();
