// Same 20 photos as game3, oldest → newest
const PHOTOS = [
  { src: '../game3/assets/IMG_9079.jpeg',                            month:'Sep', year:'2018', label:'HARBOR CRUISE' },
  { src: '../game3/assets/IMG_4408.JPEG',                            month:'Oct', year:'2021', label:'SAM + NATE',          align:'top' },
  { src: '../game3/assets/IMG_2727.jpeg',                            month:'Oct', year:'2021', label:'TAMPONS' },
  { src: '../game3/assets/IMG_5807.jpeg',                            month:'Jun', year:'2022', label:'NANKY BDAY' },
  { src: '../game3/assets/IMG_6352.jpeg',                            month:'Jun', year:'2022', label:'REVERE BEACH' },
  { src: '../game3/assets/IMG_8256.jpeg',                            month:'Jun', year:'2022', label:'MYSTIC DAY' },
  { src: '../game3/assets/IMG_0484.JPG',                             month:'Jul', year:'2022', label:'NYC SUMMA',           align:'bottom' },
  { src: '../game3/assets/IMG_9035.jpeg',                            month:'Sep', year:'2022', label:'NANKY BEDROOM' },
  { src: '../game3/assets/IMG_0264.JPG',                             month:'Oct', year:'2022', label:'DOUBLE CHIN TAPPED' },
  { src: '../game3/assets/IMG_3130.JPG',                             month:'Oct', year:'2022', label:'APPLE PICKING' },
  { src: '../game3/assets/IMG_0539.JPG',                             month:'Oct', year:'2022', label:'DORA DA WHORA' },
  { src: '../game3/assets/IMG_1085.jpeg',                            month:'Sep', year:'2023', label:'CURSED' },
  { src: '../game3/assets/55652274-FCA9-4E27-9D84-BA77DE6534DD.jpg', month:'Feb', year:'2024', label:'CUDDLE PUDDLE' },
  { src: '../game3/assets/IMG_3239.jpeg',                            month:'Apr', year:'2025', label:'TANDEM' },
  { src: '../game3/assets/IMG_2451.JPG',                             month:'Apr', year:'2025', label:'PR' },
  { src: '../game3/assets/IMG_9743.jpeg',                            month:'May', year:'2025', label:'WONAJE HUG' },
  { src: '../game3/assets/IMG_0526.jpeg',                            month:'Oct', year:'2025', label:'DADDYNANU' },
  { src: '../game3/assets/gold_digga.jpeg',                          month:'Dec', year:'2025', label:'GOLD DIGGA' },
  { src: '../game3/assets/IMG_2865.jpeg',                            month:'Dec', year:'2025', label:'COUPLES CHRISTMAS' },
  { src: '../game3/assets/IMG_1686.jpeg',                            month:'Feb', year:'2026', label:'COLONIZATION' },
]

// Square 1 = bottom-left = oldest. Square 20 = top = newest.
// correctSquare(photoIndex) = photoIndex + 1

const LADDERS = [  // { from, to } — climbing UP (to > from)
  { from: 4,  to: 14 },  // big early climb
  { from: 8,  to: 16 },  // mid boost
  { from: 6,  to: 15 },  // cross boost
]

const CHUTES  = [  // { from, to } — sliding DOWN (to < from)
  { from: 11, to: 4  },
  { from: 17, to: 9  },
  { from: 13, to: 7  },
]

// Square background colours (classic C&L board palette)
const SQ_COLORS = [
  '#fff9e0','#e6f4ff','#ffe6f0','#e8ffe8','#f4e6ff',
  '#ffe8d0','#ddf4ff','#ffdde8','#e0f0e0','#f0e0ff',
  '#fffbe6','#e8f0ff','#ffe0ec','#e4fce4','#f8e4ff',
  '#fef3d4','#ddeeff','#ffdce8','#dff0df','#efe0ff',
]

const STICKERS   = ['⭐','🌸','💖','🌟','✨','🎀','🦋','🌈','💅','🍓','🌺','🫶']
const LBL_COLORS = ['#e91e8c','#9c27b0','#1976d2','#d32f2f','#00796b','#f57c00','#7b1fa2','#c2185b']

const state = {
  deck:       [],
  deckPos:    0,
  placed:     new Array(21).fill(null),  // [squareNum] = photoIndex (1-indexed)
  tokenPos:   0,       // 0 = off board, 1-20 = current square
  phase:      'start',
  misses:     0,
  hoverSq:    0,
  wrongSq:    0,
  flashTimer: 0,
  flashType:  '',
  shakeTimer: 0,
  bonusTimer: 0,    // frames to show ladder/chute animation
  bonusType:  '',   // 'ladder'|'chute'
  bonusFrom:  0,
  bonusTo:    0,
  images:     [],
}

let canvas, ctx, B = {}   // B = board layout metrics

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  canvas = document.getElementById('canvas')
  ctx    = canvas.getContext('2d')

  resize()
  window.addEventListener('resize', resize)

  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerdown', onTap)
  canvas.addEventListener('pointerleave', () => { state.hoverSq = 0 })

  document.getElementById('play-btn').addEventListener('click',    startGame)
  document.getElementById('replay-btn').addEventListener('click',  startGame)
  document.getElementById('restart-btn').addEventListener('click', startGame)
  document.getElementById('back-btn').addEventListener('click',    () => { window.location.href = '../index.html' })
  document.getElementById('hub-btn').addEventListener('click',     () => { window.location.href = '../index.html' })

  preload()
  requestAnimationFrame(loop)
}

function resize() {
  canvas.width  = Math.min(window.innerWidth  - 106, 350)
  canvas.height = Math.min(window.innerHeight - 360, 390)
  computeBoard()
}

function computeBoard() {
  const W = canvas.width, H = canvas.height
  const photoH  = Math.floor(H * 0.38)
  const boardH  = H - photoH - 6
  const sqW     = Math.floor(W / 5)
  const sqH     = Math.floor(boardH / 4)
  B = { W, H, photoH, boardH, boardTop: photoH + 4, sqW, sqH }
}

function preload() {
  PHOTOS.forEach((p, i) => {
    const img = new Image()
    img.onload  = () => { state.images[i] = img }
    img.onerror = () => { state.images[i] = null }
    img.src = p.src
    state.images[i] = img
  })
}

// ── Helpers: square ↔ grid ─────────────────────────────────────────────────

// squareToGrid: square 1-20 → {col 0-4, row 0-3 from top}
// Board snake: row3(bottom)=1-5 L→R, row2=6-10 R→L, row1=11-15 L→R, row0(top)=16-20 R→L
function squareToGrid(n) {
  const idx        = n - 1
  const fromBottom = Math.floor(idx / 5)
  const rowFromTop = 3 - fromBottom
  const colInRow   = idx % 5
  const col        = fromBottom % 2 === 0 ? colInRow : 4 - colInRow
  return { col, row: rowFromTop }
}

function squareCenter(n) {
  const { col, row } = squareToGrid(n)
  return { x: col * B.sqW + B.sqW / 2, y: B.boardTop + row * B.sqH + B.sqH / 2 }
}

function squareAt(px, py) {
  if (py < B.boardTop) return 0
  const col = Math.floor(px / B.sqW)
  const row = Math.floor((py - B.boardTop) / B.sqH)
  if (col < 0 || col > 4 || row < 0 || row > 3) return 0
  const fromBottom = 3 - row
  const colInRow   = fromBottom % 2 === 0 ? col : 4 - col
  return fromBottom * 5 + colInRow + 1
}

function ladderAt(sq)  { return LADDERS.find(l => l.from === sq) || null }
function chuteAt(sq)   { return CHUTES.find(c => c.from === sq)  || null }

// ── Game flow ─────────────────────────────────────────────────────────────────

function startGame() {
  state.deck       = shuffle(PHOTOS.map((_, i) => i))
  state.deckPos    = 0
  state.placed     = new Array(21).fill(null)
  state.tokenPos   = 0
  state.misses     = 0
  state.phase      = 'playing'
  state.flashTimer = 0
  state.shakeTimer = 0
  state.bonusTimer = 0
  state.hoverSq    = 0
  state.wrongSq    = 0

  document.getElementById('start-overlay').classList.add('hidden')
  document.getElementById('win-overlay').classList.add('hidden')
  document.getElementById('restart-btn').disabled = false
  updateHUD()
}

function currentPhotoIdx() { return state.deck[state.deckPos] }
function correctSquare(photoIdx) { return photoIdx + 1 }

function onMove(e) {
  if (state.phase !== 'playing') return
  const rect = canvas.getBoundingClientRect()
  const px = (e.clientX - rect.left) * (canvas.width  / rect.width)
  const py = (e.clientY - rect.top)  * (canvas.height / rect.height)
  state.hoverSq = squareAt(px, py)
}

function onTap(e) {
  if (state.phase !== 'playing') return
  e.preventDefault()
  const rect  = canvas.getBoundingClientRect()
  const px = (e.clientX - rect.left) * (canvas.width  / rect.width)
  const py = (e.clientY - rect.top)  * (canvas.height / rect.height)
  const sq = squareAt(px, py)
  if (sq <= 0) return
  if (state.placed[sq] !== null) return   // already occupied

  const photoIdx = currentPhotoIdx()
  const correct  = correctSquare(photoIdx)

  if (sq === correct) {
    // ✓ Correct placement
    state.placed[sq] = photoIdx
    state.flashType  = 'correct'
    state.flashTimer = 38
    state.tokenPos   = sq

    // Check for ladder
    const ladder = ladderAt(sq)
    if (ladder) {
      state.bonusType  = 'ladder'
      state.bonusFrom  = sq
      state.bonusTo    = ladder.to
      state.bonusTimer = 90
      state.tokenPos   = ladder.to
    }

    state.deckPos++
    updateHUD()

    if (state.deckPos >= PHOTOS.length) {
      setTimeout(() => {
        state.phase = 'win'
        document.getElementById('win-msg').textContent =
          `${PHOTOS.length} memories placed in ${state.misses} miss${state.misses !== 1 ? 'es' : ''}!`
        document.getElementById('win-overlay').classList.remove('hidden')
      }, ladder ? 1200 : 400)
    }

  } else {
    // ✗ Wrong
    state.misses++
    state.wrongSq    = sq
    state.flashType  = 'wrong'
    state.flashTimer = 55
    state.shakeTimer = 35

    // Check for chute at current token position
    const chute = chuteAt(state.tokenPos)
    if (chute && state.tokenPos > 0) {
      state.bonusType  = 'chute'
      state.bonusFrom  = state.tokenPos
      state.bonusTo    = chute.to
      state.bonusTimer = 90
      state.tokenPos   = chute.to
    }

    updateHUD()
  }
}

function updateHUD() {
  document.getElementById('progress-display').textContent =
    `${state.deckPos} / ${PHOTOS.length}`
  document.getElementById('miss-display').textContent =
    `MISSES: ${state.misses}`
}

// ── Loop ──────────────────────────────────────────────────────────────────────

function loop() { update(); draw(); requestAnimationFrame(loop) }

function update() {
  if (state.flashTimer > 0) state.flashTimer--
  if (state.shakeTimer > 0) state.shakeTimer--
  if (state.bonusTimer > 0) state.bonusTimer--
  if (state.flashTimer === 0) state.wrongSq = 0
}

// ── Draw ──────────────────────────────────────────────────────────────────────

function draw() {
  const shX = state.shakeTimer > 0 ? (Math.random() - 0.5) * 6 : 0
  const shY = state.shakeTimer > 0 ? (Math.random() - 0.5) * 6 : 0
  ctx.save()
  if (state.shakeTimer > 0) ctx.translate(shX, shY)

  // Parchment background
  ctx.fillStyle = '#f5edd8'
  ctx.fillRect(0, 0, B.W, B.H)

  if (state.phase !== 'start') {
    drawChutesAndLadders()
    drawSquares()
    drawToken()
    drawCurrentPhoto()
    drawBonusBanner()
    drawFlash()
  }

  ctx.restore()
}

// ── Board elements ────────────────────────────────────────────────────────────

function drawChutesAndLadders() {
  // Draw behind squares

  // Ladders — green, multi-rung
  for (const ld of LADDERS) {
    const c1 = squareCenter(ld.from)
    const c2 = squareCenter(ld.to)
    const dx = c2.x - c1.x, dy = c2.y - c1.y
    const len = Math.hypot(dx, dy)
    const nx = -dy / len * 5, ny = dx / len * 5  // perpendicular

    ctx.strokeStyle = '#2a7a20'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    // Left rail
    ctx.beginPath(); ctx.moveTo(c1.x + nx, c1.y + ny); ctx.lineTo(c2.x + nx, c2.y + ny); ctx.stroke()
    // Right rail
    ctx.beginPath(); ctx.moveTo(c1.x - nx, c1.y - ny); ctx.lineTo(c2.x - nx, c2.y - ny); ctx.stroke()
    // Rungs
    const steps = Math.max(3, Math.floor(len / 16))
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const rx = c1.x + dx * t, ry = c1.y + dy * t
      ctx.beginPath(); ctx.moveTo(rx + nx, ry + ny); ctx.lineTo(rx - nx, ry - ny); ctx.stroke()
    }
    // Star at top
    ctx.fillStyle = '#2a7a20'; ctx.font = '14px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('⭐', c2.x, c2.y)
  }

  // Chutes — red curved slide
  for (const ch of CHUTES) {
    const c1 = squareCenter(ch.from)   // top of chute
    const c2 = squareCenter(ch.to)    // bottom
    const cpx = c1.x + (c2.x - c1.x) * 0.6 + 25
    const cpy = c1.y + (c2.y - c1.y) * 0.35

    ctx.strokeStyle = '#cc2200'; ctx.lineWidth = 6; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(c1.x, c1.y)
    ctx.quadraticCurveTo(cpx, cpy, c2.x, c2.y)
    ctx.stroke()
    // Inner highlight
    ctx.strokeStyle = 'rgba(255,120,80,0.5)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.quadraticCurveTo(cpx, cpy, c2.x, c2.y); ctx.stroke()

    // Arrow at bottom
    ctx.fillStyle = '#cc2200'; ctx.font = '12px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🐍', c2.x, c2.y)
  }
}

function drawSquares() {
  for (let n = 1; n <= 20; n++) {
    const { col, row } = squareToGrid(n)
    const sx  = col * B.sqW
    const sy  = B.boardTop + row * B.sqH
    const isHover  = state.hoverSq === n && state.phase === 'playing'
    const isWrong  = state.wrongSq === n && state.flashTimer > 0
    const isPlaced = state.placed[n] !== null
    const hasLadder = !!ladderAt(n)
    const hasChute  = !!chuteAt(n)

    // Square background
    ctx.fillStyle = isWrong  ? '#ffbbbb'
                  : isHover  ? '#ffffc0'
                  : isPlaced ? SQ_COLORS[(n - 1) % SQ_COLORS.length]
                  : SQ_COLORS[(n - 1) % SQ_COLORS.length]
    ctx.fillRect(sx, sy, B.sqW, B.sqH)

    // Border
    ctx.strokeStyle = isHover ? '#f4d03f' : isWrong ? '#cc2200' : 'rgba(120,90,50,0.35)'
    ctx.lineWidth   = isHover || isWrong ? 2 : 1
    ctx.strokeRect(sx + 0.5, sy + 0.5, B.sqW - 1, B.sqH - 1)

    if (isPlaced) {
      // Photo thumbnail
      const photoIdx = state.placed[n]
      const img = state.images[photoIdx]
      const photo = PHOTOS[photoIdx]
      if (img && img.complete) {
        drawImageFit(img, sx + 2, sy + 11, B.sqW - 4, B.sqH - 13, photo.align || 'center')
      }
      // Number (small, top-left)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = 'bold 7px Courier New'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(n, sx + 2, sy + 1)
    } else {
      // Square number
      ctx.fillStyle = isHover ? '#aa6600' : 'rgba(80,55,20,0.6)'
      ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(n, sx + 3, sy + 2)

      // Date hint in center
      const p = PHOTOS[n - 1]
      if (p) {
        ctx.fillStyle = isHover ? '#884400' : 'rgba(100,70,30,0.55)'
        ctx.font = '6.5px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(`${p.month} '${p.year.slice(2)}`, sx + B.sqW / 2, sy + B.sqH / 2)
      }

      // Ladder/chute tiny icon
      if (hasLadder) { ctx.font = '9px serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('🪜', sx + B.sqW - 2, sy + 1) }
      if (hasChute)  { ctx.font = '9px serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('🐍', sx + B.sqW - 2, sy + 1) }
    }
  }

  // "START" label below square 1 and "FINISH" above square 20
  ctx.fillStyle = 'rgba(80,50,20,0.5)'
  ctx.font = '6px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  const s1 = squareToGrid(1),  p1 = squareCenter(1)
  const s20 = squareToGrid(20), p20 = squareCenter(20)
  ctx.fillText('START ↑', p1.x,  B.boardTop + 3 * B.sqH + B.sqH - 7)
  ctx.fillText('↑ FINISH', p20.x, B.boardTop + 2)
}

function drawToken() {
  if (state.tokenPos <= 0 || state.phase === 'start') return
  const { x, y } = squareCenter(state.tokenPos)

  // Glow
  ctx.fillStyle = 'rgba(244,192,63,0.3)'
  ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill()

  // Coin body
  const cg = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10)
  cg.addColorStop(0, '#f8e870')
  cg.addColorStop(0.5, '#c89010')
  cg.addColorStop(1, '#7a5000')
  ctx.fillStyle = cg
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#a07010'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke()

  // "N" for Nancy
  ctx.fillStyle = '#4a2e00'
  ctx.font = 'bold 10px Courier New'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('N', x, y + 1)
}

// ── Current photo display ─────────────────────────────────────────────────────

const LBL_COLS = ['#e91e8c','#9c27b0','#1976d2','#d32f2f','#00796b','#f57c00']
const STKS     = ['⭐','🌸','💖','🌟','✨','🎀']

function drawCurrentPhoto() {
  if (state.deckPos >= PHOTOS.length) return
  const pIdx  = currentPhotoIdx()
  const photo = PHOTOS[pIdx]
  const img   = state.images[pIdx]

  // Polaroid card — top strip
  const cW = Math.floor(B.W * 0.46)
  const cH = B.photoH - 8
  const cX = 4
  const cY = 4
  const iPad = 5, iBase = 26

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  roundRect(ctx, cX + 4, cY + 4, cW, cH, 4); ctx.fill()

  // Polaroid white body
  ctx.fillStyle = '#faf8f2'
  roundRect(ctx, cX, cY, cW, cH, 4); ctx.fill()

  // Photo
  const iX = cX + iPad, iY = cY + iPad
  const iW = cW - iPad * 2, iH = cH - iPad - iBase
  if (img && img.complete) {
    drawImageFit(img, iX, iY, iW, iH, photo.align || 'center')
  } else {
    ctx.fillStyle = '#ddd'
    roundRect(ctx, iX, iY, iW, iH, 2); ctx.fill()
  }

  // Photo inset border
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1
  roundRect(ctx, iX, iY, iW, iH, 2); ctx.stroke()

  // Label
  const lColor = LBL_COLS[pIdx % LBL_COLS.length]
  const lTxt   = photo.label
  let   fSize  = 12
  ctx.font = `bold ${fSize}px Courier New`
  while (ctx.measureText(lTxt).width > cW - 12 && fSize > 7) { fSize--; ctx.font = `bold ${fSize}px Courier New` }
  ctx.fillStyle = lColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(lTxt, cX + cW / 2, cY + cH - iBase / 2)

  // Stickers
  ctx.font = '11px serif'
  ctx.textAlign = 'left';  ctx.textBaseline = 'middle'
  ctx.fillText(STKS[pIdx % STKS.length], iX - 1, iY + 8)
  ctx.textAlign = 'right'
  ctx.fillText(STKS[(pIdx + 3) % STKS.length], iX + iW + 1, iY + 8)

  // Side panel: instruction + counter
  const pX = cX + cW + 8
  const pY = cY
  const pW = B.W - pX - 4
  const pH = B.photoH - 8

  // Instruction panel
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  roundRect(ctx, pX + 2, pY + 2, pW, pH, 4); ctx.fill()
  ctx.fillStyle = '#1a1205'
  roundRect(ctx, pX, pY, pW, pH, 4); ctx.fill()
  ctx.strokeStyle = 'rgba(244,208,63,0.3)'; ctx.lineWidth = 1
  roundRect(ctx, pX, pY, pW, pH, 4); ctx.stroke()

  ctx.fillStyle = '#f4d03f'
  ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const lines = ['TAP', 'THE', 'RIGHT', 'SQUARE', '↓']
  const lineH = pH / (lines.length + 1)
  lines.forEach((line, i) => ctx.fillText(line, pX + pW / 2, pY + lineH * (i + 1)))

  // Counter badge
  ctx.fillStyle = '#f4d03f'
  ctx.font = 'bold 8px Courier New'; ctx.textAlign = 'center'
  ctx.fillText(`${state.deckPos + 1}/${PHOTOS.length}`, pX + pW / 2, pY + pH - 8)
}

// ── Bonus banner (ladder/chute notification) ──────────────────────────────────

function drawBonusBanner() {
  if (state.bonusTimer <= 0) return
  const t     = state.bonusTimer / 90
  const alpha = Math.min(1, t * 3)
  const isL   = state.bonusType === 'ladder'

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle   = isL ? 'rgba(20,120,20,0.88)' : 'rgba(180,20,20,0.88)'
  roundRect(ctx, 10, B.photoH / 2 - 16, B.W - 20, 32, 6)
  ctx.fill()

  ctx.fillStyle    = '#fff'
  ctx.font         = 'bold 13px Courier New'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    isL ? `🪜 LADDER! JUMP TO ${state.bonusTo}!` : `🐍 CHUTE! SLIDE TO ${state.bonusTo}!`,
    B.W / 2, B.photoH / 2
  )
  ctx.restore()
}

// ── Flash overlay ─────────────────────────────────────────────────────────────

function drawFlash() {
  if (state.flashTimer <= 0) return
  const t = state.flashTimer
  if (state.flashType === 'correct') {
    ctx.fillStyle = `rgba(60,200,60,${(t/38)*0.22})`; ctx.fillRect(0, 0, B.W, B.H)
  } else {
    ctx.fillStyle = `rgba(220,30,30,${(t/55)*0.25})`; ctx.fillRect(0, 0, B.W, B.H)
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function drawImageFit(img, x, y, w, h, align) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = img.width * scale, sh = img.height * scale
  const sx = x + (w - sw) / 2
  const sy = align === 'top' ? y : align === 'bottom' ? y + h - sh : y + (h - sh) / 2
  ctx.save()
  roundRect(ctx, x, y, w, h, 2); ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh)
  ctx.restore()
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r)
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r)
  ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r)
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r)
  ctx.closePath()
}

window.addEventListener('DOMContentLoaded', init)
