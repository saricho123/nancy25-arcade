// ─────────────────────────────────────────────────────────────────────────────
// PHOTOS  — fill this in once photos are uploaded.
// Each entry: { src, year, label }
// They must be listed in CHRONOLOGICAL ORDER (index 0 = oldest).
// The game derives correct rung assignments from this order automatically.
// ─────────────────────────────────────────────────────────────────────────────
// Listed oldest → newest. align: 'top'|'center'|'bottom' controls crop.
const PHOTOS = [
  { src: 'assets/IMG_9079.jpeg',                            month: 'Sep', year: '2018', label: 'HARBOR CRUISE' },
  { src: 'assets/IMG_4408.JPEG',                            month: 'Oct', year: '2021', label: 'SAM + NATE',          align: 'top' },
  { src: 'assets/IMG_2727.jpeg',                            month: 'Oct', year: '2021', label: 'TAMPONS' },
  { src: 'assets/IMG_5807.jpeg',                            month: 'Jun', year: '2022', label: 'NANKY BDAY' },
  { src: 'assets/IMG_6352.jpeg',                            month: 'Jun', year: '2022', label: 'REVERE BEACH' },
  { src: 'assets/IMG_8256.jpeg',                            month: 'Jun', year: '2022', label: 'MYSTIC DAY' },
  { src: 'assets/IMG_0484.JPG',                             month: 'Jul', year: '2022', label: 'NYC SUMMA',           align: 'bottom' },
  { src: 'assets/IMG_9035.jpeg',                            month: 'Sep', year: '2022', label: 'NANKY BEDROOM' },
  { src: 'assets/IMG_0264.JPG',                             month: 'Oct', year: '2022', label: 'DOUBLE CHIN TAPPED' },
  { src: 'assets/IMG_3130.JPG',                             month: 'Oct', year: '2022', label: 'APPLE PICKING' },
  { src: 'assets/IMG_0539.JPG',                             month: 'Oct', year: '2022', label: 'DORA DA WHORA' },
  { src: 'assets/IMG_1085.jpeg',                            month: 'Sep', year: '2023', label: 'CURSED' },
  { src: 'assets/55652274-FCA9-4E27-9D84-BA77DE6534DD.jpg', month: 'Feb', year: '2024', label: 'CUDDLE PUDDLE' },
  { src: 'assets/IMG_3239.jpeg',                            month: 'Apr', year: '2025', label: 'TANDEM' },
  { src: 'assets/IMG_2451.JPG',                             month: 'Apr', year: '2025', label: 'PR' },
  { src: 'assets/IMG_9743.jpeg',                            month: 'May', year: '2025', label: 'WONAJE HUG' },
  { src: 'assets/IMG_0526.jpeg',                            month: 'Oct', year: '2025', label: 'DADDYNANU' },
  { src: 'assets/gold_digga.jpeg',                          month: 'Dec', year: '2025', label: 'GOLD DIGGA' },
  { src: 'assets/IMG_2865.jpeg',                            month: 'Dec', year: '2025', label: 'COUPLES CHRISTMAS' },
  { src: 'assets/IMG_1686.jpeg',                            month: 'Feb', year: '2026', label: 'COLONIZATION' },
]

const TOTAL = 20      // total rungs on the ladder
const RUNG_COUNT = TOTAL

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const state = {
  phase:      'start',    // 'start' | 'playing' | 'wrong' | 'win'
  deck:       [],         // shuffled indices into PHOTOS, presented one at a time
  deckPos:    0,          // which card in the deck we're currently showing
  placed:     [],         // placed[rungIndex] = photoIndex, or null
  streak:     0,          // correct placements this run (for display)
  bestStreak: 0,
  flashTimer: 0,          // frames for correct/wrong flash
  flashType:  '',         // 'correct' | 'wrong'
  hoverRung:  -1,         // which rung the pointer is over
  images:     [],         // preloaded Image objects, parallel to PHOTOS
  imagesLoaded: 0,
  shakeTimer: 0,
  wrongRung:  -1          // rung that was just tapped wrong (for red highlight)
}

let canvas, ctx
let LAYOUT = {}   // computed in resize()

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('canvas')
  ctx    = canvas.getContext('2d')

  resize()
  window.addEventListener('resize', resize)

  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerleave', () => { state.hoverRung = -1 })

  document.getElementById('play-btn').addEventListener('click',    startGame)
  document.getElementById('replay-btn').addEventListener('click',  startGame)
  document.getElementById('restart-btn').addEventListener('click', startGame)
  document.getElementById('hub-btn').addEventListener('click',     () => { window.location.href = '../index.html' })
  document.getElementById('back-btn').addEventListener('click',    () => { window.location.href = '../index.html' })

  preloadImages()
  requestAnimationFrame(loop)
}

function resize() {
  canvas.width  = Math.min(window.innerWidth  - 106, 900)
  canvas.height = Math.min(window.innerHeight - 360, 900)
  computeLayout()
}

function computeLayout() {
  const W = canvas.width, H = canvas.height
  // Bigger polaroid card on the left, ladder on the right
  const polPad  = 7    // polaroid side/top border
  const polBase = 40   // polaroid bottom label strip
  const cardW   = Math.floor(W * 0.56)
  const cardH   = Math.min(Math.floor(H * 0.90), Math.floor(cardW * 1.35))
  const cardX   = 4
  const cardY   = Math.floor((H - cardH) / 2)

  const ladderX     = cardX + cardW + 8
  const ladderW     = W - ladderX - 4
  const ladderTop   = 8
  const ladderBot   = H - 8
  const rungSpacing = (ladderBot - ladderTop) / (RUNG_COUNT - 1)

  LAYOUT = { W, H, ladderX, ladderW, ladderTop, ladderBot, rungSpacing,
             cardW, cardH, cardX, cardY, polPad, polBase }
  generateBricks()
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE PRELOAD
// ─────────────────────────────────────────────────────────────────────────────
function preloadImages() {
  if (PHOTOS.length === 0) return
  PHOTOS.forEach((p, i) => {
    const img = new Image()
    img.onload = () => { state.imagesLoaded++; state.images[i] = img }
    img.onerror = () => { state.images[i] = null; state.imagesLoaded++ }
    img.src = p.src
    state.images[i] = img
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────────────────────────────────────
function startGame() {
  state.deck    = shuffle(PHOTOS.map((_, i) => i))
  state.deckPos = 0
  state.placed  = Array(RUNG_COUNT).fill(null)
  state.streak  = 0
  state.phase   = 'playing'
  state.flashTimer = 0
  state.hoverRung  = -1
  state.shakeTimer = 0
  state.wrongRung  = -1

  document.getElementById('start-overlay').classList.add('hidden')
  document.getElementById('win-overlay').classList.add('hidden')
  document.getElementById('restart-btn').disabled = false
  updateHUD()
}

function resetRound() {
  // Wrong answer — reshuffle and start over
  state.deck    = shuffle(PHOTOS.map((_, i) => i))
  state.deckPos = 0
  state.placed  = Array(RUNG_COUNT).fill(null)
  state.streak  = 0
  state.phase   = 'playing'
  state.flashTimer = 0
  state.hoverRung  = -1
  updateHUD()
}

function currentPhotoIndex() {
  return state.deck[state.deckPos]
}

// Correct rung for a photo is its index in PHOTOS (0 = oldest = rung 0 = top)
function correctRungFor(photoIndex) {
  return photoIndex   // PHOTOS is already in chronological order
}

function onPointerMove(e) {
  if (state.phase !== 'playing') return
  const { row } = canvasCoords(e)
  state.hoverRung = rungAtRow(row)
}

function onPointerDown(e) {
  if (state.phase !== 'playing') return
  e.preventDefault()
  const { row } = canvasCoords(e)
  const rung = rungAtRow(row)
  if (rung < 0 || rung >= RUNG_COUNT) return
  if (state.placed[rung] !== null) return   // rung already occupied

  const photoIdx = currentPhotoIndex()
  const correct  = correctRungFor(photoIdx)

  if (rung === correct) {
    // ✓ Correct
    state.placed[rung] = photoIdx
    state.streak++
    if (state.streak > state.bestStreak) state.bestStreak = state.streak
    state.flashType  = 'correct'
    state.flashTimer = 40
    state.deckPos++

    if (state.deckPos >= PHOTOS.length) {
      state.phase = 'win'
      document.getElementById('win-overlay').classList.remove('hidden')
    }
  } else {
    // ✗ Wrong — flash red then reset
    state.wrongRung  = rung
    state.flashType  = 'wrong'
    state.flashTimer = 60
    state.shakeTimer = 40
    state.phase      = 'wrong'
    setTimeout(resetRound, 1100)
  }

  updateHUD()
}

function canvasCoords(e) {
  const rect  = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
    row: ((e.clientY - rect.top) * scaleY)
  }
}

function rungAtRow(y) {
  const { ladderTop, rungSpacing } = LAYOUT
  const idx = Math.round((y - ladderTop) / rungSpacing)
  return idx
}

function updateHUD() {
  document.getElementById('progress-display').textContent =
    `PHOTO ${state.deckPos} / ${PHOTOS.length || TOTAL}`
  document.getElementById('streak-display').textContent =
    `STREAK: ${state.streak}`
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────────────────────────────────────
function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}

function update() {
  if (state.flashTimer > 0) state.flashTimer--
  if (state.shakeTimer > 0) state.shakeTimer--
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────────────────
function draw() {
  const shX = state.shakeTimer > 0 ? (Math.random() - 0.5) * 7 : 0
  const shY = state.shakeTimer > 0 ? (Math.random() - 0.5) * 7 : 0

  ctx.save()
  if (state.shakeTimer > 0) ctx.translate(shX, shY)

  drawBrickWall()

  if (state.phase !== 'start') {
    drawLadder()
    drawCurrentPhoto()
    drawFlash()
  }

  ctx.restore()
}

// Pre-generate brick data so colours don't flicker each frame
function generateBricks() {
  const bW = 40, bH = 17, gap = 3
  // Realistic brick palette — warm reds, terracotta, some variation
  const palette = [
    '#c85230','#d45c38','#c44a2a','#d06038','#be4828',
    '#cc5635','#d86840','#c04e30','#ba4628','#d05a35',
    '#c25030','#d46040','#c85838','#be5030','#cc5a36',
  ]
  const bricks = []
  for (let row = 0; row * (bH + gap) < LAYOUT.H + bH + 20; row++) {
    const offset = (row % 2) * ((bW + gap) / 2)
    for (let col = -1; col * (bW + gap) - offset < LAYOUT.W + bW; col++) {
      // Deterministic colour using row/col hash so it's stable
      const ci = Math.abs((row * 11 + col * 7 + row * col * 3)) % palette.length
      bricks.push({
        x: col * (bW + gap) - offset,
        y: row * (bH + gap),
        w: bW, h: bH,
        color: palette[ci],
        // slight brightness variation per brick
        bright: ((row * 17 + col * 13) % 5) * 0.018 - 0.036
      })
    }
  }
  LAYOUT.bricks = bricks
  LAYOUT.brickW = bW; LAYOUT.brickH = bH; LAYOUT.brickGap = gap
}

// ── Brick wall background ──────────────────────────────────────────────────
function drawBrickWall() {
  // Mortar base (warm cream-gray, brighter than before)
  ctx.fillStyle = '#c4a882'
  ctx.fillRect(0, 0, LAYOUT.W, LAYOUT.H)

  // Individual bricks with colour variation
  for (const b of (LAYOUT.bricks || [])) {
    ctx.fillStyle = b.color
    ctx.fillRect(b.x, b.y, b.w, b.h)

    // Top-edge highlight (light catching top face of brick)
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    ctx.fillRect(b.x, b.y, b.w, 2)

    // Bottom-edge shadow (depth)
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.fillRect(b.x, b.y + b.h - 2, b.w, 2)

    // Very faint left shadow on alternating bricks for texture
    if ((Math.abs(b.x + b.y) % 3) === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.fillRect(b.x, b.y, 3, b.h)
    }
  }
}

// ── Fire escape ladder ────────────────────────────────────────────────────
// Modelled on a real NYC/Boston iron fire escape:
//  • Heavy channel-iron vertical stringers
//  • Wide flat steel rungs (step bars)
//  • Wall standoff brackets bolted into the brick every ~5 rungs
//  • Diagonal cross-brace between bracket levels
//  • Cast shadow on the wall behind the structure
function drawLadder() {
  const { ladderX, ladderW, ladderTop, ladderBot, rungSpacing } = LAYOUT

  const railL  = ladderX + 10
  const railR  = ladderX + ladderW - 6
  const railW  = 9    // channel-iron width
  const rungH  = 7    // rung bar height
  const span   = railR - railL + railW   // horizontal span including rail widths

  // ── Cast shadow on the wall (the whole structure sits a few inches out) ──
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(railL + 5, ladderTop - 2, span + 4, ladderBot - ladderTop + 4)

  // ── Wall standoff brackets ─────────────────────────────────────────────
  // Brackets every ~5 rungs and at top/bottom
  const bracketRungs = [0, 4, 9, 14, 19]
  for (const bi of bracketRungs) {
    const by = ladderTop + bi * rungSpacing
    drawStandoffBracket(railL, by, railR, railW)
  }

  // ── Diagonal cross-bracing between bracket levels ──────────────────────
  for (let b = 0; b < bracketRungs.length - 1; b++) {
    const y1 = ladderTop + bracketRungs[b]     * rungSpacing
    const y2 = ladderTop + bracketRungs[b + 1] * rungSpacing
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.lineCap = 'butt'
    // One diagonal (top-left to bottom-right)
    ctx.beginPath()
    ctx.moveTo(railL + railW / 2, y1)
    ctx.lineTo(railR + railW / 2, y2)
    ctx.stroke()
    // Opposite diagonal
    ctx.beginPath()
    ctx.moveTo(railR + railW / 2, y1)
    ctx.lineTo(railL + railW / 2, y2)
    ctx.stroke()
  }

  // ── Vertical stringers (channel iron) ─────────────────────────────────
  for (const rx of [railL, railR]) {
    // Main body
    const rg = ctx.createLinearGradient(rx, 0, rx + railW, 0)
    rg.addColorStop(0,    '#454545')
    rg.addColorStop(0.12, '#666')      // outer face highlight
    rg.addColorStop(0.35, '#303030')
    rg.addColorStop(0.75, '#252525')
    rg.addColorStop(1,    '#111')
    ctx.fillStyle = rg
    ctx.fillRect(rx, ladderTop, railW, ladderBot - ladderTop)

    // Outer bright edge (light catching the front face of the channel)
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    ctx.fillRect(rx, ladderTop, 2, ladderBot - ladderTop)

    // Inner dark return edge
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(rx + railW - 2, ladderTop, 2, ladderBot - ladderTop)

    // Rust hints — small irregular patches at a few positions
    ctx.fillStyle = 'rgba(160,60,20,0.25)'
    for (const ry of [ladderTop + 40, ladderTop + 140, ladderTop + 260, ladderBot - 80]) {
      ctx.fillRect(rx + 1, ry, railW - 2, 6)
    }
  }

  // ── Rungs (wide flat step bars) ────────────────────────────────────────
  for (let i = 0; i < RUNG_COUNT; i++) {
    const ry      = ladderTop + i * rungSpacing
    const isHover  = state.hoverRung === i && state.phase === 'playing' && state.placed[i] === null
    const isPlaced = state.placed[i] !== null
    const isWrong  = state.wrongRung === i && state.flashType === 'wrong' && state.flashTimer > 0
    const photo    = PHOTOS[i]

    // Under-rung shadow (gives depth / 3-D bar feel)
    ctx.fillStyle = 'rgba(0,0,0,0.30)'
    ctx.fillRect(railL - 3, ry + rungH / 2, span + 6, 3)

    // Rung bar gradient
    const rg2 = ctx.createLinearGradient(railL, ry - rungH / 2, railL, ry + rungH / 2)
    if (isWrong) {
      rg2.addColorStop(0, '#ff6655'); rg2.addColorStop(1, '#991111')
    } else if (isHover) {
      rg2.addColorStop(0, '#ffe577'); rg2.addColorStop(0.5, '#f4d03f'); rg2.addColorStop(1, '#b89010')
    } else {
      rg2.addColorStop(0, '#525252')
      rg2.addColorStop(0.3, '#3a3a3a')
      rg2.addColorStop(1,   '#1c1c1c')
    }
    ctx.fillStyle = rg2
    ctx.fillRect(railL - 3, ry - rungH / 2, span + 6, rungH)

    // Non-slip tread lines (subtle ridges across rung surface)
    if (!isPlaced) {
      ctx.fillStyle = 'rgba(0,0,0,0.14)'
      for (let tx = railL + 2; tx < railR + railW - 4; tx += 5) {
        ctx.fillRect(tx, ry - rungH / 2 + 2, 2, rungH - 4)
      }
    }

    // Top-face highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(railL - 3, ry - rungH / 2, span + 6, 2)

    // Hover glow ring
    if (isHover) {
      ctx.strokeStyle = 'rgba(244,208,63,0.7)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(railL - 4, ry - rungH / 2 - 1, span + 8, rungH + 2)
    }

    // Labels — number (bold) + month/year (small) to left of left rail
    const isTop = i === 0, isBot = i === RUNG_COUNT - 1
    ctx.textAlign    = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = isHover ? '#f4d03f' : isWrong ? '#ff8866' : 'rgba(255,255,240,0.75)'
    ctx.font         = `bold 11px Courier New`
    ctx.fillText(`${i + 1}`, railL - 6, ry - 2)
    ctx.fillStyle    = isHover ? '#f4d03f' : 'rgba(255,255,220,0.40)'
    ctx.font         = `6.5px Courier New`
    if (photo) ctx.fillText(`${photo.month} ${photo.year}`, railL - 6, ry + 7)

    // Oldest / Newest tag
    if (isTop || isBot) {
      ctx.fillStyle = isHover ? '#f4d03f' : 'rgba(255,230,150,0.55)'
      ctx.font = '6px Courier New'
      ctx.fillText(isTop ? '← OLDEST' : '← NEWEST', railL - 6, ry + (isTop ? -10 : 16))
    }

    // Placed photo thumbnail on rung
    if (isPlaced) {
      const th = Math.max(12, Math.floor(rungSpacing * 0.80))
      drawPhotoOnRung(state.placed[i], railL + railW + 2, ry - th / 2, railR - railL - railW - 3, th)
    }
  }
}

// Wall standoff bracket: a flat plate bolted to the wall with a
// protruding arm that holds the rail away from the surface.
function drawStandoffBracket(railL, by, railR, railW) {
  const plateW = 16, plateH = 10

  for (const rx of [railL, railR]) {
    // Wall plate (behind / to the left of the rail)
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(rx - plateW, by - plateH / 2, plateW, plateH)

    // Plate highlight
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.fillRect(rx - plateW, by - plateH / 2, plateW, 2)

    // Arm (horizontal bar from plate to rail)
    ctx.fillStyle = '#282828'
    ctx.fillRect(rx - 4, by - 3, railW + 4, 6)

    // Two bolt heads on the wall plate
    for (const bx of [rx - plateW + 4, rx - 5]) {
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, 4)
      bg.addColorStop(0, '#666'); bg.addColorStop(1, '#222')
      ctx.fillStyle = bg
      ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2); ctx.fill()
      // Slot on bolt head
      ctx.strokeStyle = '#111'; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx + 2, by); ctx.stroke()
    }
  }
}

// ── Current photo card — polaroid style ────────────────────────────────────
const STICKERS   = ['⭐','🌸','💖','🌟','✨','🎀','🦋','🌈','💅','🍓','🌺','🫶']
const LBL_COLORS = ['#e91e8c','#9c27b0','#1976d2','#d32f2f','#00796b','#f57c00','#7b1fa2','#c2185b']

function drawCurrentPhoto() {
  if (state.phase === 'win' || state.deckPos >= PHOTOS.length) return
  const { cardX, cardY, cardW, cardH, polPad, polBase } = LAYOUT

  const photoIdx = currentPhotoIndex()
  const photo    = PHOTOS[photoIdx]
  const align    = photo ? (photo.align || 'center') : 'center'

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  roundRect(ctx, cardX + 5, cardY + 5, cardW, cardH, 5)
  ctx.fill()

  // Polaroid body — warm white
  ctx.fillStyle = '#faf8f2'
  roundRect(ctx, cardX, cardY, cardW, cardH, 5)
  ctx.fill()

  // Photo image area
  const imgX = cardX + polPad
  const imgY = cardY + polPad
  const imgW = cardW - polPad * 2
  const imgH = cardH - polPad - polBase

  if (photo && state.images[photoIdx] && state.images[photoIdx].complete) {
    drawImageFit(state.images[photoIdx], imgX, imgY, imgW, imgH, align)
  } else {
    ctx.fillStyle = '#ddd8cc'
    roundRect(ctx, imgX, imgY, imgW, imgH, 2); ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('📷', imgX + imgW / 2, imgY + imgH / 2)
  }

  // Photo inset border
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1
  roundRect(ctx, imgX, imgY, imgW, imgH, 2); ctx.stroke()

  // Bottom label strip label — big, bold, girlie color
  const labelColor = LBL_COLORS[photoIdx % LBL_COLORS.length]
  const labelTxt   = photo ? photo.label : `PHOTO ${photoIdx + 1}`
  const maxLabelW  = cardW - polPad * 2 - 8
  let   fontSize   = 15
  ctx.font = `bold ${fontSize}px Courier New`
  while (ctx.measureText(labelTxt).width > maxLabelW && fontSize > 9) {
    fontSize--; ctx.font = `bold ${fontSize}px Courier New`
  }
  ctx.fillStyle    = labelColor
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(labelTxt, cardX + cardW / 2, cardY + cardH - polBase / 2)

  // Corner stickers (overlapping photo corners slightly)
  const s1 = STICKERS[photoIdx % STICKERS.length]
  const s2 = STICKERS[(photoIdx + 3) % STICKERS.length]
  const s3 = STICKERS[(photoIdx + 6) % STICKERS.length]
  const s4 = STICKERS[(photoIdx + 9) % STICKERS.length]
  ctx.font = '16px serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left';  ctx.fillText(s1, imgX - 2,          imgY + 10)   // top-left
  ctx.textAlign = 'right'; ctx.fillText(s2, imgX + imgW + 2,   imgY + 10)   // top-right
  ctx.textAlign = 'left';  ctx.fillText(s3, imgX - 2,          imgY + imgH - 10)  // bottom-left
  ctx.textAlign = 'right'; ctx.fillText(s4, imgX + imgW + 2,   imgY + imgH - 10)  // bottom-right

  // Instruction nudge
  ctx.fillStyle = '#f4d03f'
  ctx.font = 'bold 8px Courier New'
  ctx.textAlign = 'center'
  ctx.fillText('← TAP A RUNG', cardX + cardW / 2, cardY + cardH + 11)

  // Counter
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '8px Courier New'; ctx.textAlign = 'left'
  ctx.fillText(`${state.deckPos + 1} / ${PHOTOS.length}`, cardX + 2, cardY - 9)
}

function drawPhotoOnRung(photoIdx, rx, ry, rw, rh) {
  const img   = state.images[photoIdx]
  const photo = PHOTOS[photoIdx]
  if (img && img.complete) {
    drawImageFit(img, rx, ry, rw, rh, photo ? (photo.align || 'center') : 'center')
  } else {
    ctx.fillStyle = '#555'
    ctx.fillRect(rx, ry, rw, rh)
  }
}

function drawImageFit(img, x, y, w, h, align) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = img.width  * scale
  const sh = img.height * scale
  const sx = x + (w - sw) / 2
  let   sy
  if (align === 'top')    sy = y
  else if (align === 'bottom') sy = y + h - sh
  else                    sy = y + (h - sh) / 2
  ctx.save()
  roundRect(ctx, x, y, w, h, 3)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh)
  ctx.restore()
}

// ── Flash overlay ──────────────────────────────────────────────────────────
function drawFlash() {
  if (state.flashTimer <= 0) return
  const t = state.flashTimer
  if (state.flashType === 'correct') {
    ctx.fillStyle = `rgba(80,220,80,${(t / 40) * 0.25})`
    ctx.fillRect(0, 0, LAYOUT.W, LAYOUT.H)
  } else {
    ctx.fillStyle = `rgba(255,50,50,${(t / 60) * 0.30})`
    ctx.fillRect(0, 0, LAYOUT.W, LAYOUT.H)
    if (t > 40) {
      ctx.fillStyle = `rgba(255,255,255,${(t - 40) / 20 * 0.4})`
      ctx.fillRect(0, 0, LAYOUT.W, LAYOUT.H)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
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
