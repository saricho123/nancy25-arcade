const HAPPY_MSGS  = ['nanky is BRAVE.', 'jello theory jello theory!!']
const SCARED_MSGS = ["saricho i'm scared!", 'HOLD MY HAND!']

const PLANE_X  = 82   // fixed x of plane center
const PLANE_RX = 36   // fuselage half-length
const PLANE_RY = 12   // fuselage half-height

const state = {
  planeY:       0,
  targetY:      0,
  obstacles:    [],
  bgClouds:     [],
  enemyPlanes:  [],
  rainStreaks:  [],             // pre-generated full-canvas rain streaks
  rainTimer:    0,             // frames of active screen-rain remaining
  rainNextIn:   480,           // frames until next rain event
  enemyNextIn:  280,           // frames until first enemy plane
  chat:         { text: '', timer: 0, scared: false },
  shake:        0,
  phase:        'start',
  score:        0,
  lives:        3,
  speed:        2.8,
  spawnIn:      65,
  frame:        0
}

let canvas, ctx

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  canvas = document.getElementById('canvas')
  ctx    = canvas.getContext('2d')

  resize()
  window.addEventListener('resize', resize)

  canvas.addEventListener('pointermove', onPointer)
  canvas.addEventListener('pointerdown', onPointer)

  document.getElementById('play-btn').addEventListener('click',   startGame)
  document.getElementById('replay-btn').addEventListener('click', startGame)
  document.getElementById('back-btn').addEventListener('click',   () => { window.location.href = '../index.html' })
  document.getElementById('hub-btn-go').addEventListener('click', () => { window.location.href = '../index.html' })

  state.planeY = state.targetY = 180
  generateBgClouds()
  requestAnimationFrame(loop)
}

function resize() {
  canvas.width  = Math.min(window.innerWidth  - 106, 520)
  canvas.height = Math.min(window.innerHeight - 340, 560)
  state.planeY  = state.targetY = canvas.height / 2
  generateBgClouds()
  generateRainStreaks()
}

// ── Background clouds (decorative, no collision) ──────────────────────────────

function generateBgClouds() {
  state.bgClouds = []
  for (let i = 0; i < 7; i++) {
    state.bgClouds.push({
      x:     Math.random() * canvas.width,
      y:     10 + Math.random() * (canvas.height - 20),
      w:     50 + Math.random() * 70,
      speed: 0.15 + Math.random() * 0.25
    })
  }
}

// ── Game flow ─────────────────────────────────────────────────────────────────

function startGame() {
  state.planeY      = state.targetY = canvas.height / 2
  state.obstacles   = []
  state.enemyPlanes = []
  state.chat        = { text: '', timer: 0, scared: false }
  state.shake       = 0
  state.phase       = 'playing'
  state.score       = 0
  state.lives       = 3
  state.speed       = 2.8
  state.spawnIn     = 65
  state.frame       = 0
  state.rainTimer   = 0
  state.rainNextIn  = 420 + Math.floor(Math.random() * 200)
  state.enemyNextIn = 240 + Math.floor(Math.random() * 120)

  document.getElementById('start-overlay').classList.add('hidden')
  document.getElementById('gameover-overlay').classList.add('hidden')
  updateHUD()
  generateBgClouds()
  generateRainStreaks()
}

function onPointer(e) {
  if (state.phase !== 'playing') return
  e.preventDefault()
  const rect = canvas.getBoundingClientRect()
  state.targetY = (e.clientY - rect.top) * (canvas.height / rect.height)
}

// ── Update ────────────────────────────────────────────────────────────────────

function loop() { update(); draw(); requestAnimationFrame(loop) }

function update() {
  if (state.phase !== 'playing') return

  state.frame++
  state.score++
  state.speed = Math.min(9, 2.8 + state.score / 380)

  // Rain overlay countdown
  if (state.rainTimer > 0) {
    state.rainTimer--
  } else if (--state.rainNextIn <= 0) {
    state.rainTimer  = 210 + Math.floor(Math.random() * 90)  // 3.5–5 s
    state.rainNextIn = 380 + Math.floor(Math.random() * 260)
  }

  // Enemy plane spawn
  if (--state.enemyNextIn <= 0) {
    spawnEnemyPlane()
    state.enemyNextIn = Math.max(140, 300 - Math.floor(state.score / 120)) + Math.floor(Math.random() * 80)
  }

  // Move enemy planes + collision
  for (const ep of state.enemyPlanes) {
    ep.x -= ep.vx
    ep.y += ep.vy
    if (ep.y < 10 || ep.y > canvas.height - 10) ep.vy *= -1  // bounce vertically
    if (!ep.hit &&
        PLANE_X + PLANE_RX - 8 > ep.x         &&
        PLANE_X - PLANE_RX + 8 < ep.x + ep.w  &&
        state.planeY + PLANE_RY - 3 > ep.y - ep.h / 2 &&
        state.planeY - PLANE_RY + 3 < ep.y + ep.h / 2) {
      ep.hit = true
      triggerHit()
    }
  }
  state.enemyPlanes = state.enemyPlanes.filter(ep => ep.x + ep.w > -60)

  // Smooth plane follow
  const cy = Math.max(PLANE_RY + 5, Math.min(canvas.height - PLANE_RY - 5, state.targetY))
  state.planeY += (cy - state.planeY) * 0.13

  // Move bg clouds
  for (const c of state.bgClouds) {
    c.x -= c.speed
    if (c.x + c.w < 0) { c.x = canvas.width + 50; c.y = 10 + Math.random() * (canvas.height - 20) }
  }

  // Spawn obstacles
  if (--state.spawnIn <= 0) {
    spawnPair()
    const base = Math.max(36, 78 - Math.floor(state.score / 160))
    state.spawnIn = base + Math.floor(Math.random() * 20)
  }

  // Move and test obstacles
  for (const o of state.obstacles) {
    o.x -= state.speed

    // Dodged (passed the plane)
    if (!o.passed && o.x + o.w < PLANE_X - PLANE_RX - 6) {
      o.passed = true
      if (!o.dodgeDone) {
        o.dodgeDone = true
        if (o.twin) o.twin.dodgeDone = true
        triggerHappy()
      }
    }

    // Collision
    if (!o.passed && !o.hit) {
      if (PLANE_X + PLANE_RX - 10 > o.x        &&
          PLANE_X - PLANE_RX + 10 < o.x + o.w  &&
          state.planeY + PLANE_RY - 4  > o.y    &&
          state.planeY - PLANE_RY + 4  < o.y + o.h) {
        o.hit = true
        if (o.twin) o.twin.hit = true
        triggerHit()
      }
    }
  }

  state.obstacles = state.obstacles.filter(o => o.x + o.w > -80)
  if (state.chat.timer > 0) state.chat.timer--
  if (state.shake > 0)      state.shake--
  if (state.frame % 6 === 0) updateHUD()
}

function spawnPair() {
  const TYPES = ['cloud', 'cloud', 'rain', 'wind']
  const type  = TYPES[Math.floor(Math.random() * TYPES.length)]
  const obsW  = 48 + Math.random() * 34
  const gap   = Math.max(62, 105 - Math.floor(state.score / 240))
  const gapY  = 14 + Math.random() * (canvas.height - gap - 28)
  const botY  = gapY + gap
  const x     = canvas.width + 16
  const hBot  = canvas.height - botY

  const top = { x, y: 0,    w: obsW, h: gapY, type, gapEdge:'bottom',
    bumps:     makeBumps(obsW),
    streaks:   type === 'rain'  ? makeStreaks(obsW, gapY)  : null,
    windLines: type === 'wind'  ? makeWindLines(obsW, gapY): null,
    passed:false, hit:false, dodgeDone:false, twin:null }
  const bot = { x, y: botY, w: obsW, h: hBot,  type, gapEdge:'top',
    bumps:     makeBumps(obsW),
    streaks:   type === 'rain'  ? makeStreaks(obsW, hBot)  : null,
    windLines: type === 'wind'  ? makeWindLines(obsW, hBot): null,
    passed:false, hit:false, dodgeDone:false, twin:null }
  top.twin = bot; bot.twin = top
  state.obstacles.push(top, bot)
}

function makeBumps(w) {
  const n = Math.max(2, Math.ceil(w / 20))
  return Array.from({length: n}, (_, i) => ({
    tx: (i + 0.5) * (w / n) + (Math.random() - 0.5) * 5,
    r:  11 + Math.random() * 6
  }))
}

function makeStreaks(w, h) {
  const count = Math.max(6, Math.floor(w * h / 42))
  return Array.from({length: count}, () => ({
    x:   Math.random() * (w + 8) - 4,
    y:   Math.random() * h,
    len: 9 + Math.random() * 11
  }))
}

function makeWindLines(w, h) {
  const n = Math.max(2, Math.floor(h / 18))
  return Array.from({length: n}, (_, i) => ({
    y:     (i + 0.5) * (h / n) + (Math.random() - 0.5) * 6,
    amp:   3 + Math.random() * 5,
    freq:  0.06 + Math.random() * 0.05,
    phase: Math.random() * Math.PI * 2,
    len:   w
  }))
}

function triggerHappy() {
  state.chat = { text: HAPPY_MSGS[Math.floor(Math.random() * HAPPY_MSGS.length)], timer: 85, scared: false }
}

function triggerHit() {
  state.chat = { text: SCARED_MSGS[Math.floor(Math.random() * SCARED_MSGS.length)], timer: 105, scared: true }
  state.shake = 32
  state.lives = Math.max(0, state.lives - 1)
  if (state.lives === 0) {
    state.phase = 'gameover'
    document.getElementById('final-score').textContent =
      `You flew ${Math.floor(state.score / 10)} miles and dodged ${Math.floor(state.score / 55)} clouds!`
    document.getElementById('gameover-overlay').classList.remove('hidden')
  }
}

function updateHUD() {
  document.getElementById('lives-display').textContent = state.lives > 0 ? '✈'.repeat(state.lives) : '💨'
  document.getElementById('score-display').textContent = `${Math.floor(state.score / 10)} mi`
}

// ── Enemy planes ──────────────────────────────────────────────────────────────

function spawnEnemyPlane() {
  const y  = 20 + Math.random() * (canvas.height - 40)
  const vy = (Math.random() - 0.5) * 0.8   // gentle vertical drift
  state.enemyPlanes.push({
    x:  canvas.width + 40,
    y,
    vx: state.speed + 1.8 + Math.random() * 1.4,
    vy,
    w:  60, h: 26,
    hit: false
  })
}

function drawEnemyPlanes() {
  for (const ep of state.enemyPlanes) {
    if (ep.hit) continue
    drawEnemyPlane(ep.x + ep.w / 2, ep.y)
  }
}

function drawEnemyPlane(cx, cy) {
  const ew = 30, eh = 10   // half-dimensions

  ctx.save()
  ctx.translate(cx, cy)

  // Tail fin (right side — plane faces left)
  ctx.fillStyle = '#c0392b'
  ctx.beginPath()
  ctx.moveTo(ew, 0)
  ctx.lineTo(ew - 8, 0)
  ctx.lineTo(ew - 13, -eh - 9)
  ctx.lineTo(ew + 1,  -eh - 7)
  ctx.closePath(); ctx.fill()

  // Wing (swept back, above)
  ctx.fillStyle = '#9aa0b0'
  ctx.beginPath()
  ctx.moveTo(6,  -eh + 2)
  ctx.lineTo(-10, -eh + 2)
  ctx.lineTo(-16, -eh - 20)
  ctx.lineTo(6,   -eh - 17)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#808898'; ctx.lineWidth = 0.8; ctx.stroke()

  // Fuselage
  ctx.fillStyle = '#eceff4'
  ctx.beginPath()
  ctx.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2); ctx.fill()

  // Red stripe (clipped)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = '#c0392b'
  ctx.fillRect(-ew, -2.5, ew * 2, 5)
  ctx.restore()

  // Fuselage outline
  ctx.strokeStyle = '#c0c8d4'; ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2); ctx.stroke()

  // Nose (pointing LEFT)
  ctx.fillStyle = '#888898'
  ctx.beginPath()
  ctx.moveTo(-ew + 3, -eh + 4)
  ctx.quadraticCurveTo(-ew - 12, 0, -ew + 3, eh - 4)
  ctx.closePath(); ctx.fill()

  // Windows
  ctx.fillStyle = '#b8d8f0'
  for (const wx of [-12, 2, 14]) {
    ctx.beginPath()
    ctx.ellipse(wx, -1.5, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill()
  }

  ctx.restore()
}

// ── Full-screen rain overlay (obstructs view) ─────────────────────────────────

function generateRainStreaks() {
  state.rainStreaks = Array.from({length: 130}, () => ({
    x:   Math.random() * (canvas.width  + 30) - 15,
    y:   Math.random() * (canvas.height + 30) - 15,
    len: 12 + Math.random() * 18
  }))
}

function drawRainOverlay() {
  if (state.rainTimer <= 0) return

  // Fade in first 30 frames, fade out last 30 frames
  const elapsed = (state.rainTimer <= 30) ? state.rainTimer / 30
                : (state.rainTimer >= 180) ? (210 - state.rainTimer) / 30
                : 1
  const alpha = Math.min(1, elapsed)

  ctx.save()
  ctx.globalAlpha = alpha

  // Darkening wash
  ctx.fillStyle = 'rgba(8,18,38,0.52)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Rain streaks
  ctx.strokeStyle = 'rgba(148,186,255,0.58)'
  ctx.lineWidth = 1; ctx.lineCap = 'round'
  const sinA = Math.sin(Math.PI / 5.5)
  const cosA = Math.cos(Math.PI / 5.5)
  for (const s of state.rainStreaks) {
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(s.x + sinA * s.len, s.y + cosA * s.len)
    ctx.stroke()
  }

  // Warning flash: brief white edge at onset
  if (state.rainTimer > 195) {
    ctx.globalAlpha = alpha * 0.35
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.restore()
}

// ── Render ────────────────────────────────────────────────────────────────────

function draw() {
  const shX = state.shake > 0 ? (Math.random() - 0.5) * 9 : 0
  const shY = state.shake > 0 ? (Math.random() - 0.5) * 9 : 0
  ctx.save()
  if (state.shake > 0) ctx.translate(shX, shY)
  drawSky()
  if (state.phase !== 'start') {
    drawBgClouds()
    drawObstacles()
    drawEnemyPlanes()
    drawPlane(PLANE_X, state.planeY)
    drawRainOverlay()
    if (state.chat.timer > 0) drawChat()
  }
  ctx.restore()
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
  g.addColorStop(0,   '#1255a0')
  g.addColorStop(0.5, '#3a9ed8')
  g.addColorStop(1,   '#a8dff2')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawBgClouds() {
  ctx.save()
  ctx.globalAlpha = 0.22
  for (const c of state.bgClouds) puffCloud(c.x, c.y, c.w)
  ctx.restore()
}

function puffCloud(x, y, w) {
  ctx.fillStyle = '#fff'
  for (const [dx, dy, r] of [[0.5,0.2,0.42],[0.25,-0.1,0.35],[0.72,-0.05,0.30],[0.16,0.25,0.28],[0.76,0.25,0.27]]) {
    ctx.beginPath(); ctx.arc(x + dx*w, y + dy*w*0.45, r*w*0.5, 0, Math.PI*2); ctx.fill()
  }
}

function drawObstacles() {
  for (const o of state.obstacles) {
    if      (o.type === 'rain') drawRainObs(o)
    else if (o.type === 'wind') drawWindObs(o)
    else                        drawCloudObs(o)
  }
}

// ── Fluffy cloud bank ─────────────────────────────────────────────
function drawCloudObs(o) {
  const edgeY = o.gapEdge === 'bottom' ? o.y + o.h : o.y

  // Cloud body — soft blue-gray fill
  ctx.fillStyle = 'rgba(212,220,238,0.95)'
  ctx.fillRect(o.x, o.y, o.w, o.h)

  // Interior depth puffs (mid-body texture)
  ctx.fillStyle = 'rgba(235,240,252,0.6)'
  const midY = o.gapEdge === 'bottom' ? o.y + o.h * 0.38 : o.y + o.h * 0.62
  for (const b of o.bumps) {
    ctx.beginPath(); ctx.arc(o.x + b.tx, midY, b.r * 0.65, 0, Math.PI*2); ctx.fill()
  }

  // Bright fluffy bumps on the gap-facing edge
  ctx.fillStyle = 'rgba(250,253,255,0.98)'
  for (const b of o.bumps) {
    ctx.beginPath(); ctx.arc(o.x + b.tx, edgeY, b.r, 0, Math.PI*2); ctx.fill()
  }
}

// ── Dark rain storm cell ──────────────────────────────────────────
function drawRainObs(o) {
  const edgeY = o.gapEdge === 'bottom' ? o.y + o.h : o.y

  // Dark storm body
  const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h)
  grad.addColorStop(0, 'rgba(18,26,46,0.97)')
  grad.addColorStop(1, 'rgba(30,44,68,0.93)')
  ctx.fillStyle = grad
  ctx.fillRect(o.x, o.y, o.w, o.h)

  // Clipped rain streaks (diagonal, ~33° slant)
  ctx.save()
  ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip()
  ctx.strokeStyle = 'rgba(160,198,255,0.52)'
  ctx.lineWidth = 1; ctx.lineCap = 'round'
  const sinA = Math.sin(Math.PI / 5.5)
  const cosA = Math.cos(Math.PI / 5.5)
  for (const s of o.streaks) {
    ctx.beginPath()
    ctx.moveTo(o.x + s.x, o.y + s.y)
    ctx.lineTo(o.x + s.x + sinA * s.len, o.y + s.y + cosA * s.len)
    ctx.stroke()
  }
  ctx.restore()

  // Dark cloud bumps on gap-facing edge
  ctx.fillStyle = 'rgba(35,50,75,0.97)'
  for (const b of o.bumps) {
    ctx.beginPath(); ctx.arc(o.x + b.tx, edgeY, b.r, 0, Math.PI*2); ctx.fill()
  }
}

// ── Wind shear zone ───────────────────────────────────────────────
function drawWindObs(o) {
  const edgeY = o.gapEdge === 'bottom' ? o.y + o.h : o.y

  // Translucent turbulent air (barely visible — the danger is hidden)
  ctx.fillStyle = 'rgba(190,218,255,0.18)'
  ctx.fillRect(o.x, o.y, o.w, o.h)

  // Wavy horizontal wind current lines with arrowheads
  ctx.save()
  ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip()
  ctx.lineWidth = 1.5; ctx.lineCap = 'round'
  for (const wl of o.windLines) {
    const baseY = o.y + wl.y
    ctx.strokeStyle = 'rgba(210,235,255,0.65)'
    ctx.beginPath()
    ctx.moveTo(o.x, baseY)
    for (let dx = 0; dx <= wl.len; dx += 2) {
      ctx.lineTo(o.x + dx, baseY + Math.sin(dx * wl.freq + wl.phase) * wl.amp)
    }
    ctx.stroke()

    // Arrow tip at right end
    const ex  = o.x + wl.len - 5
    const ey2 = baseY + Math.sin((wl.len - 5) * wl.freq + wl.phase) * wl.amp
    ctx.fillStyle = 'rgba(210,235,255,0.8)'
    ctx.beginPath()
    ctx.moveTo(ex + 7, ey2)
    ctx.lineTo(ex, ey2 - 3)
    ctx.lineTo(ex, ey2 + 3)
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()

  // Soft hazy bumps on gap edge (barely there — wind is sneaky)
  ctx.fillStyle = 'rgba(200,220,248,0.38)'
  for (const b of o.bumps) {
    ctx.beginPath(); ctx.arc(o.x + b.tx, edgeY, b.r, 0, Math.PI*2); ctx.fill()
  }
}

// ── Plane + Nancy ─────────────────────────────────────────────────────────────

function drawPlane(cx, cy) {
  ctx.save()
  ctx.translate(cx, cy)

  // Tail fin
  ctx.fillStyle = '#1255a0'
  ctx.beginPath()
  ctx.moveTo(-PLANE_RX,      0)
  ctx.lineTo(-PLANE_RX + 10, 0)
  ctx.lineTo(-PLANE_RX + 15, -PLANE_RY - 11)
  ctx.lineTo(-PLANE_RX - 2,  -PLANE_RY - 9)
  ctx.closePath(); ctx.fill()

  // Wing
  ctx.fillStyle = '#c8d4e8'
  ctx.beginPath()
  ctx.moveTo(-10, -PLANE_RY + 2)
  ctx.lineTo(12,  -PLANE_RY + 2)
  ctx.lineTo(18,  -PLANE_RY - 26)
  ctx.lineTo(-10, -PLANE_RY - 22)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#a8b8cc'; ctx.lineWidth = 0.8; ctx.stroke()

  // Fuselage
  ctx.fillStyle = '#f2f4fa'
  ctx.beginPath()
  ctx.ellipse(0, 0, PLANE_RX, PLANE_RY, 0, 0, Math.PI*2); ctx.fill()

  // Blue stripe (clipped to fuselage)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, 0, PLANE_RX, PLANE_RY, 0, 0, Math.PI*2)
  ctx.clip()
  ctx.fillStyle = '#1255a0'
  ctx.fillRect(-PLANE_RX, -3, PLANE_RX*2, 6)
  ctx.restore()

  // Fuselage outline
  ctx.strokeStyle = '#c0ccd8'; ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(0, 0, PLANE_RX, PLANE_RY, 0, 0, Math.PI*2); ctx.stroke()

  // Nose cone
  ctx.fillStyle = '#1255a0'
  ctx.beginPath()
  ctx.moveTo(PLANE_RX - 4, -PLANE_RY + 5)
  ctx.quadraticCurveTo(PLANE_RX + 14, 0, PLANE_RX - 4, PLANE_RY - 5)
  ctx.closePath(); ctx.fill()

  // Windows (3)
  for (const wx of [-16, 0, 16]) {
    ctx.fillStyle = '#88c8f0'
    ctx.beginPath()
    ctx.ellipse(wx, -2, 4.5, 5.5, 0, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = '#b8ddf8'; ctx.lineWidth = 0.7; ctx.stroke()
  }

  // Nancy in middle window
  drawNancy(0, -2)

  ctx.restore()
}

function drawNancy(wx, wy) {
  const scared = state.chat.scared && state.chat.timer > 0

  // Face (skin)
  ctx.fillStyle = '#f5c88a'
  ctx.beginPath()
  ctx.ellipse(wx, wy, 3.2, 3.8, 0, 0, Math.PI*2); ctx.fill()

  // Hair
  ctx.fillStyle = '#2e1a08'
  ctx.beginPath()
  ctx.ellipse(wx, wy - 2, 3.2, 2.2, 0, Math.PI, 0, true); ctx.fill()

  if (scared) {
    // Wide circle eyes
    ctx.fillStyle = '#111'
    ctx.beginPath(); ctx.arc(wx-1.2, wy-0.4, 0.85, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(wx+1.2, wy-0.4, 0.85, 0, Math.PI*2); ctx.fill()
    // Sweat drop
    ctx.fillStyle = '#88ccff'
    ctx.beginPath(); ctx.arc(wx + 3.5, wy - 1, 0.9, 0, Math.PI*2); ctx.fill()
    // Open mouth
    ctx.strokeStyle = '#700'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.ellipse(wx, wy + 1.4, 1.1, 0.85, 0, 0, Math.PI*2); ctx.stroke()
  } else {
    // Happy curved eyes
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.75; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(wx-1.2, wy-0.5, 0.85, Math.PI*1.1, Math.PI*1.9); ctx.stroke()
    ctx.beginPath(); ctx.arc(wx+1.2, wy-0.5, 0.85, Math.PI*1.1, Math.PI*1.9); ctx.stroke()
    // Smile
    ctx.beginPath(); ctx.arc(wx, wy+0.9, 1.3, 0.2, Math.PI-0.2); ctx.stroke()
  }
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function drawChat() {
  const { text, timer, scared } = state.chat
  const alpha = Math.min(1, timer / 14)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = 'bold 8.5px Courier New'

  const tw  = ctx.measureText(text).width
  const pad = 7
  const bw  = Math.min(tw + pad * 2, canvas.width - PLANE_X - 20)
  const bh  = 20
  const bx  = PLANE_X + PLANE_RX + 6
  const by  = Math.max(2, Math.min(canvas.height - bh - 2, state.planeY - bh - 10))

  // Bubble
  ctx.fillStyle   = scared ? '#fff1f0' : '#f0fff4'
  ctx.strokeStyle = scared ? '#e53935' : '#2e7d32'
  ctx.lineWidth   = 1.5
  roundRect(bx, by, bw, bh, 4); ctx.fill(); ctx.stroke()

  // Tail toward Nancy
  ctx.fillStyle = scared ? '#fff1f0' : '#f0fff4'
  ctx.beginPath()
  ctx.moveTo(bx, by + bh * 0.38)
  ctx.lineTo(bx - 7, by + bh * 0.58)
  ctx.lineTo(bx, by + bh * 0.78)
  ctx.closePath(); ctx.fill()

  // Text
  ctx.fillStyle    = scared ? '#b71c1c' : '#1b5e20'
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + pad, by + bh / 2, bw - pad * 2)

  ctx.restore()
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r)
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r)
  ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r)
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r)
  ctx.closePath()
}

window.addEventListener('DOMContentLoaded', init)
