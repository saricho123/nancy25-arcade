const DIRS = {
  NE: { dx:  Math.SQRT1_2, dy: -Math.SQRT1_2 },
  SE: { dx:  Math.SQRT1_2, dy:  Math.SQRT1_2 },
  SW: { dx: -Math.SQRT1_2, dy:  Math.SQRT1_2 },
  NW: { dx: -Math.SQRT1_2, dy: -Math.SQRT1_2 }
}
const DIR_KEYS = Object.keys(DIRS)

const DIR_ANGLE = {
  NE: -Math.PI / 4,
  SE:  Math.PI / 4,
  SW:  3 * Math.PI / 4,
  NW: -3 * Math.PI / 4
}

const R            = 22   // sheep radius (px) — smaller = denser
const TIMER_SECS   = 30
const SCURRY_SPEED = 9

const state = {
  sheep:       [],
  phase:       'start',   // 'start' | 'playing' | 'win' | 'timeout'
  moves:       0,
  pendingWin:  false,
  timeEnd:     0,         // Date.now() timestamp when time runs out
  history:     [],        // stack of sheep IDs for undo (oldest first)
  grassBlades: []
}

let canvas, ctx

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  canvas = document.getElementById('canvas')
  ctx    = canvas.getContext('2d')

  resize()
  window.addEventListener('resize', () => { resize(); generateGrass() })

  canvas.addEventListener('pointerdown', onPointerDown)

  document.getElementById('play-btn').addEventListener('click', startGame)
  document.getElementById('replay-btn').addEventListener('click', startGame)
  document.getElementById('retry-btn').addEventListener('click', startGame)
  document.getElementById('hub-btn').addEventListener('click',         () => { window.location.href = '../index.html' })
  document.getElementById('hub-btn-timeout').addEventListener('click', () => { window.location.href = '../index.html' })
  document.getElementById('undo-btn').addEventListener('click', undoMove)
  document.getElementById('addtime-btn').addEventListener('click', addTime)

  generateGrass()
  requestAnimationFrame(loop)
}

function resize() {
  canvas.width  = Math.min(window.innerWidth  - 16, 440)
  canvas.height = Math.min(window.innerHeight - 160, 640)
}

// ── Grass ─────────────────────────────────────────────────────────────────────

function generateGrass() {
  state.grassBlades = []
  const count = Math.floor((canvas.width * canvas.height) / 1800)
  for (let i = 0; i < count; i++) {
    state.grassBlades.push({
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      h:    6 + Math.random() * 11,
      lean: (Math.random() - 0.5) * 8,
      dark: Math.random() > 0.45
    })
  }
}

// ── Game flow ─────────────────────────────────────────────────────────────────

function startGame() {
  state.moves      = 0
  state.pendingWin = false
  state.history    = []
  state.timeEnd    = Date.now() + TIMER_SECS * 1000
  state.phase      = 'playing'

  document.getElementById('moves-display').textContent = 'MOVES: 0'
  document.getElementById('start-overlay').classList.add('hidden')
  document.getElementById('win-overlay').classList.add('hidden')
  document.getElementById('timeout-overlay').classList.add('hidden')
  updateUndoBtn()

  let ok = false
  while (!ok) ok = generateSolvableLevel()

  generateGrass()
}

// ── Level generation (guaranteed solvable — reverse simulation) ───────────────

function generateSolvableLevel() {
  const margin  = R * 1.4
  const minDist = R * 1.75   // tightly packed
  const N       = 45

  const positions = []
  let tries = 0
  while (positions.length < N && tries < N * 400) {
    tries++
    const x = margin + Math.random() * (canvas.width  - margin * 2)
    const y = margin + Math.random() * (canvas.height - margin * 2)
    if (positions.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < minDist * minDist)) continue
    positions.push({ x, y })
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    const order = shuffle(positions.map((p, i) => ({
      id:    i,
      x:     p.x,  y:     p.y,
      origX: p.x,  origY: p.y,
      dir:   null,
      state: 'active'
    })))
    let success = true

    for (let i = 0; i < order.length; i++) {
      const sheep   = order[i]
      const onField = order.slice(i + 1)

      const validDirs = DIR_KEYS.filter(dir => {
        const { dx, dy } = DIRS[dir]
        const ox = sheep.x + dx * R * 1.15
        const oy = sheep.y + dy * R * 1.15
        return !onField.some(o => rayHitsCircle(ox, oy, dx, dy, o.x, o.y, R))
      })

      if (!validDirs.length) { success = false; break }
      sheep.dir = validDirs[Math.floor(Math.random() * validDirs.length)]
    }

    if (success) {
      state.sheep = order
      return true
    }
  }

  return false
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Removability ──────────────────────────────────────────────────────────────

function isRemovable(sheep) {
  const { dx, dy } = DIRS[sheep.dir]
  const ox = sheep.x + dx * R * 1.15
  const oy = sheep.y + dy * R * 1.15
  return !state.sheep.some(other => {
    if (other.id === sheep.id || other.state !== 'active') return false
    return rayHitsCircle(ox, oy, dx, dy, other.x, other.y, R)
  })
}

function rayHitsCircle(ox, oy, dx, dy, cx, cy, r) {
  const vx = cx - ox, vy = cy - oy
  const t  = vx * dx + vy * dy
  if (t < 0) return false
  const clx = ox + t * dx, cly = oy + t * dy
  return (cx - clx) ** 2 + (cy - cly) ** 2 < r * r
}

// ── Input ─────────────────────────────────────────────────────────────────────

function onPointerDown(e) {
  if (state.phase !== 'playing') return
  e.preventDefault()

  const rect   = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  const px     = (e.clientX - rect.left) * scaleX
  const py     = (e.clientY - rect.top)  * scaleY
  const tapR   = R * 1.3

  let hit = null
  for (let i = state.sheep.length - 1; i >= 0; i--) {
    const s = state.sheep[i]
    if (s.state === 'active' && (s.x - px) ** 2 + (s.y - py) ** 2 < tapR * tapR) {
      hit = s; break
    }
  }

  if (!hit || !isRemovable(hit)) return

  state.history.push(hit.id)
  hit.state = 'scurrying'
  state.moves++
  document.getElementById('moves-display').textContent = `MOVES: ${state.moves}`
  updateUndoBtn()

  if (!state.sheep.some(s => s.state === 'active')) state.pendingWin = true
}

// ── Undo ──────────────────────────────────────────────────────────────────────

function undoMove() {
  if (!state.history.length || state.phase !== 'playing') return
  const id    = state.history.pop()
  const sheep = state.sheep.find(s => s.id === id)
  if (!sheep) return

  sheep.x     = sheep.origX
  sheep.y     = sheep.origY
  sheep.state = 'active'
  state.moves = Math.max(0, state.moves - 1)
  state.pendingWin = false

  document.getElementById('moves-display').textContent = `MOVES: ${state.moves}`
  updateUndoBtn()
}

function updateUndoBtn() {
  document.getElementById('undo-btn').disabled = state.history.length === 0
}

// ── Add time ──────────────────────────────────────────────────────────────────

function addTime() {
  if (state.phase !== 'playing') return
  state.timeEnd += 10_000
  const btn = document.getElementById('addtime-btn')
  btn.classList.remove('flash')
  void btn.offsetWidth  // force reflow to restart animation
  btn.classList.add('flash')
}

// ── Update ────────────────────────────────────────────────────────────────────

function update() {
  // Scurry movement
  for (const s of state.sheep) {
    if (s.state !== 'scurrying') continue
    const { dx, dy } = DIRS[s.dir]
    s.x += dx * SCURRY_SPEED
    s.y += dy * SCURRY_SPEED
    if (s.x < -R * 3 || s.x > canvas.width  + R * 3 ||
        s.y < -R * 3 || s.y > canvas.height + R * 3) {
      s.state = 'removed'
    }
  }

  // Win check
  if (state.pendingWin && state.sheep.every(s => s.state === 'removed')) {
    state.pendingWin = false
    state.phase = 'win'
    document.getElementById('move-count').textContent =
      `Cleared in ${state.moves} move${state.moves !== 1 ? 's' : ''}!`
    document.getElementById('win-overlay').classList.remove('hidden')
    return
  }

  // Timer
  if (state.phase === 'playing') {
    const remaining = Math.max(0, state.timeEnd - Date.now())
    const totalSecs = Math.ceil(remaining / 1000)
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    const el   = document.getElementById('timer-display')
    el.textContent = `${mins}:${String(secs).padStart(2, '0')}`
    el.className = totalSecs <= 5 ? 'urgent' : totalSecs <= 10 ? 'warning' : ''

    if (remaining <= 0) {
      state.phase = 'timeout'
      document.getElementById('timeout-overlay').classList.remove('hidden')
    }
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawField()
  if (state.phase === 'start') return
  const t = Date.now()
  for (const s of state.sheep) {
    if (s.state === 'active') {
      drawSheep(s.x, s.y, R, s.dir, 0)
    } else if (s.state === 'scurrying') {
      drawSheep(s.x, s.y, R, s.dir, Math.sin(t / 70 + s.id * 1.9) * 0.2)
    }
  }
}

// ── Field ─────────────────────────────────────────────────────────────────────

function drawField() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0,    '#72c257')
  grad.addColorStop(0.45, '#5aaa3f')
  grad.addColorStop(1,    '#3d8a2a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.lineCap = 'round'
  for (const b of state.grassBlades) {
    ctx.strokeStyle = b.dark ? '#3a7a28' : '#82d468'
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.quadraticCurveTo(b.x + b.lean * 0.5, b.y - b.h * 0.55, b.x + b.lean, b.y - b.h)
    ctx.stroke()
  }
}

// ── Sheep — no legs, compact body ─────────────────────────────────────────────

function drawSheep(cx, cy, r, dir, wobble) {
  const angle = DIR_ANGLE[dir] + wobble
  const bw    = r * 0.78
  const bh    = r * 0.52

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)

  // Wool body
  ctx.fillStyle = '#f0efe7'
  ctx.beginPath()
  ctx.ellipse(-bw * 0.06, 0, bw, bh, 0, 0, Math.PI * 2)
  ctx.fill()

  // Puff bumps
  ctx.fillStyle = '#e2e1d8'
  ctx.beginPath(); ctx.arc(-bw * 0.38, -bh * 0.72, bh * 0.54, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc( bw * 0.05, -bh * 0.80, bh * 0.50, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(-bw * 0.70, -bh * 0.18, bh * 0.44, 0, Math.PI * 2); ctx.fill()

  // Subtle outline
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.ellipse(-bw * 0.06, 0, bw, bh, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Head
  ctx.fillStyle = '#5c3d28'
  ctx.beginPath()
  ctx.arc(bw * 0.9, r * 0.04, bh * 0.44, 0, Math.PI * 2)
  ctx.fill()

  // Ear
  ctx.fillStyle = '#3e2616'
  ctx.beginPath()
  ctx.ellipse(bw * 0.84, -bh * 0.44, bh * 0.13, bh * 0.23, -0.35, 0, Math.PI * 2)
  ctx.fill()

  // Eye
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(bw * 0.96, -bh * 0.06, bh * 0.13, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a1209'
  ctx.beginPath()
  ctx.arc(bw * 0.975, -bh * 0.07, bh * 0.065, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

window.addEventListener('DOMContentLoaded', init)
