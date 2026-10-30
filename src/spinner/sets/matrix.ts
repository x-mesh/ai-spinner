import { TAU, clamp01, hash, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Brightness 0..1 of the cell at column x, row y on an n×n grid. */
type Field = (x: number, y: number) => number

interface Grid {
  n: number
  t: number
}

const IDLE_ALPHA = 0.09

/** Cell position in [-1, 1] with y pointing up. */
function centered(n: number, x: number, y: number) {
  const c = (n - 1) / 2
  return { u: (x - c) / c, w: (c - y) / c }
}

const spirals = new Map<number, Map<string, number>>()

function spiral(n: number) {
  let cached = spirals.get(n)
  if (!cached) {
    const order: string[] = []
    let [top, left, bottom, right] = [0, 0, n - 1, n - 1]
    while (top <= bottom && left <= right) {
      for (let x = left; x <= right; x++) order.push(`${x},${top}`)
      for (let y = top + 1; y <= bottom; y++) order.push(`${right},${y}`)
      for (let x = right - 1; x >= left && bottom > top; x--) order.push(`${x},${bottom}`)
      for (let y = bottom - 1; y > top && left < right; y--) order.push(`${left},${y}`)
      top++
      left++
      bottom--
      right--
    }
    cached = new Map(order.map((key, i) => [key, i]))
    spirals.set(n, cached)
  }
  return cached
}

function working({ n, t }: Grid): Field {
  const index = spiral(n)
  const length = index.size
  const head = (t * n * 2.2) % length
  const tail = n * 1.4
  return (x, y) => {
    const behind = (head - (index.get(`${x},${y}`) ?? 0) + length) % length
    return behind < tail ? 1 - behind / tail : 0
  }
}

function searching({ n, t }: Grid): Field {
  const beam = t * 2.4
  const round = Math.floor(beam / TAU)
  const target = { x: Math.floor(hash(round, 1) * n), y: Math.floor(hash(round, 2) * n) }
  return (x, y) => {
    const { u, w } = centered(n, x, y)
    const r = Math.hypot(u, w)
    if (r > 1.08) return 0
    if (r < 0.01) return 0.7
    const lag = (((beam - Math.atan2(w, u)) % TAU) + TAU) % TAU
    const sweep = Math.exp(-lag * 1.8)
    const found = x === target.x && y === target.y ? 0.5 + 0.5 * Math.cos(lag) : 0
    return Math.max(sweep * 0.85, found)
  }
}

const SOLVE_CYCLE = 3

function solving({ t }: Grid): Field {
  const cycle = Math.floor(t / SOLVE_CYCLE)
  const phase = (t % SOLVE_CYCLE) / SOLVE_CYCLE
  const flicker = Math.floor(t / 0.11)
  return (x, y) => {
    const solved = (x + y) % 2 === 0 ? 1 : 0.05
    const settleAt = 0.2 + 0.5 * hash(x, y, cycle)
    if (phase >= settleAt) return solved
    return hash(x, y, flicker) > 0.55 ? 0.9 : 0.05
  }
}

function listening({ n, t }: Grid): Field {
  const c = (n - 1) / 2
  const heights = Array.from({ length: n }, (_, x) => {
    const voice = Math.abs(Math.sin(t * 3.1 + x * 0.9) * Math.sin(t * 1.3 + x * 0.45))
    return 0.5 + voice * c
  })
  return (x, y) => clamp01(heights[x] - Math.abs(y - c) + 0.5)
}

const CONNECT_CYCLE = 2.6

function connecting({ n, t }: Grid): Field {
  const cycle = Math.floor(t / CONNECT_CYCLE)
  const phase = (t % CONNECT_CYCLE) / CONNECT_CYCLE
  const pick = (salt: number, range: number) => Math.floor(hash(cycle, salt) * range)
  const from = { x: pick(1, n), y: pick(2, n) }
  const gap = n - 3
  const to = { x: (from.x + 2 + pick(3, gap)) % n, y: (from.y + 2 + pick(4, gap)) % n }
  const path: string[] = []
  const stepX = Math.sign(to.x - from.x)
  for (let x = from.x; x !== to.x; x += stepX) path.push(`${x},${from.y}`)
  const stepY = Math.sign(to.y - from.y)
  for (let y = from.y; y !== to.y; y += stepY) path.push(`${to.x},${y}`)
  path.push(`${to.x},${to.y}`)
  const drawn = smooth(phase / 0.55) * path.length
  const fade = 1 - smooth((phase - 0.82) / 0.18)
  const pulse = 0.6 + 0.4 * Math.cos(t * 9)
  return (x, y) => {
    const isEnd = (x === from.x && y === from.y) || (x === to.x && y === to.y)
    if (isEnd) return pulse * Math.max(fade, 0.3)
    const i = path.indexOf(`${x},${y}`)
    return i >= 0 ? clamp01(drawn - i) * 0.8 * fade : 0
  }
}

function weaving({ n, t }: Grid): Field {
  return (x, y) => {
    const a = smooth((Math.sin((x + y) * 1.25 - t * 2.6) - 0.15) / 0.7)
    const b = smooth((Math.sin((x - y) * 1.25 + t * 2.6) - 0.15) / 0.7)
    const aOnTop = Math.floor((x - y + n) / 2) % 2 === 0
    return aOnTop ? Math.max(a, b * 0.35) : Math.max(b, a * 0.35)
  }
}

const COMPOSE_CYCLE = 4.2

function composing({ n, t }: Grid): Field {
  const cycle = Math.floor(t / COMPOSE_CYCLE)
  const phase = (t % COMPOSE_CYCLE) / COMPOSE_CYCLE
  const rows = Array.from({ length: Math.floor(n / 2) }, (_, i) => 1 + i * 2)
  const width = n - 2
  const lengths = rows.map((_, i) =>
    i === rows.length - 1 ? Math.ceil(width / 2) : width - Math.floor(hash(cycle, i) * 2.5),
  )
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, len) => sum + len, 0))
  const total = lengths.reduce((sum, len) => sum + len, 0)
  const typed = smooth(phase / 0.7) * total
  const cursor = Math.floor(typed)
  const fade = 1 - smooth((phase - 0.85) / 0.15)
  const cursorOn = Math.floor(t * 3) % 2 === 0
  return (x, y) => {
    const row = rows.indexOf(y)
    const col = x - 1
    if (row < 0 || col < 0 || col >= lengths[row]) return 0
    const at = starts[row] + col
    if (at < cursor) return 0.85 * fade
    return at === cursor && cursorOn ? fade : 0
  }
}

function breathing({ n, t }: Grid): Field {
  const reach = 0.3 + 0.75 * (0.5 - 0.5 * Math.cos(t * 1.2))
  return (x, y) => {
    const { u, w } = centered(n, x, y)
    const r = Math.hypot(u, w)
    const ring = 1 - smooth(Math.abs(r - reach) / 0.38)
    const core = r < 0.01 ? 0.5 : 0
    return Math.max(ring, core)
  }
}

type Sdf = (u: number, w: number) => number

const SHAPES: Sdf[] = [
  (u, w) => Math.hypot(u, w) - 0.8,
  (u, w) => {
    const lifted = w + 0.18
    return Math.max(Math.abs(u) * 0.866 + lifted * 0.5, -lifted) - 0.48
  },
  (u, w) => Math.max(Math.abs(u), Math.abs(w)) - 0.68,
]
const SHAPE_HOLD = 1.1
const SHAPE_MORPH = 0.7

function shaping({ n, t }: Grid): Field {
  const step = SHAPE_HOLD + SHAPE_MORPH
  const index = Math.floor(t / step)
  const from = SHAPES[index % SHAPES.length]
  const to = SHAPES[(index + 1) % SHAPES.length]
  const blend = smooth((t - index * step - SHAPE_HOLD) / SHAPE_MORPH)
  const edge = 1.6 / n
  return (x, y) => {
    const { u, w } = centered(n, x, y)
    const d = from(u, w) * (1 - blend) + to(u, w) * blend
    return 1 - smooth((d + edge * 0.3) / edge)
  }
}

const FIELDS: Record<SpinnerState, (g: Grid) => Field> = {
  working,
  searching,
  solving,
  listening,
  connecting,
  weaving,
  composing,
  breathing,
  shaping,
}

function drawGrid(f: Frame, n: number, field: Field) {
  const inset = f.size * 0.06
  const pitch = (f.size - inset * 2) / n
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = clamp01(field(x, y))
      const side = pitch * (0.5 + 0.28 * v)
      const cx = inset + (x + 0.5) * pitch
      const cy = inset + (y + 0.5) * pitch
      f.ctx.globalAlpha = IDLE_ALPHA + (1 - IDLE_ALPHA) * v
      f.ctx.beginPath()
      f.ctx.roundRect(cx - side / 2, cy - side / 2, side, side, side * 0.28)
      f.ctx.fill()
    }
  }
}

export const matrix: SpinnerSet = {
  id: 'matrix',
  label: 'Matrix',
  icon: { state: 'breathing', t: 2.9 },
  blurbs: {
    working: 'a comet spirals in through the grid',
    searching: 'a radar beam sweeps for a blip',
    solving: 'cells flicker, then settle into a checkerboard',
    listening: 'equalizer bars bounce to a voice',
    connecting: 'a route draws itself between two cells',
    weaving: 'two diagonal threads pass over and under',
    composing: 'lines type out, then clear',
    breathing: 'a ring of light swells and settles',
    shaping: 'circle, triangle, square',
  },
  draw(state, f) {
    const n = f.compact ? 5 : 9
    drawGrid(f, n, FIELDS[state]({ n, t: f.t }))
  },
}
