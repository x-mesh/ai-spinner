import { TAU, breath, cycle, hash, lerp, level, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Cell 0 is the center; cells 1–6 run clockwise from the top. Returns [scale, alpha]. */
type Cell = (i: number) => [scale: number, alpha: number]

interface Layout {
  cell: Cell
  /** Multiplies the distance between the center and the ring. */
  spread?: number
}

const SQRT3 = Math.sqrt(3)

const SHAPE_MASKS = [
  [1, 2, 3, 4, 5, 6],
  [0, 1, 3, 5],
  [0, 1, 4],
]

const HIVES: Record<SpinnerState, (t: number) => Layout> = {
  working: (t) => {
    const head = (t * 5) % 6
    return { cell: (i) => [1, i === 0 ? 0.25 : 0.15 + 0.85 * Math.exp(-((head - (i - 1) + 6) % 6) * 0.9)] }
  },
  searching: (t) => {
    const beat = Math.floor(t * 3)
    const probe = 1 + Math.floor(hash(beat) * 6)
    const decay = 1 - (t * 3 - beat) * 0.7
    return { cell: (i) => (i === 0 ? [0.85 + 0.1 * Math.sin(t * 6), 0.8] : [1, i === probe ? decay : 0.18]) }
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 2.8)
    const tick = Math.floor(t / 0.1)
    return {
      cell: (i) => [1, phase >= 0.2 + 0.5 * hash(index, i) ? 1 : hash(index, i, tick) > 0.5 ? 0.85 : 0.15],
    }
  },
  listening: (t) => ({ cell: (i) => [0.45 + 0.55 * level(t, i), 0.9] }),
  connecting: (t) => {
    const { phase } = cycle(t, 3)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return { cell: (i) => [1, 0.15 + 0.85 * smooth((phase - i * 0.07) / 0.1) * fade] }
  },
  weaving: (t) => {
    const s = 0.5 + 0.5 * Math.sin(t * 3)
    return { cell: (i) => [1, i === 0 ? 0.6 : 0.2 + 0.8 * (i % 2 === 0 ? s : 1 - s)] }
  },
  composing: (t) => {
    const { phase } = cycle(t, 3.2)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return { cell: (i) => [smooth((phase - i * 0.08) / 0.1) * fade, 1] }
  },
  breathing: (t) => {
    const b = breath(t)
    return { spread: 0.85 + 0.3 * b, cell: () => [0.9, 0.5 + 0.5 * b] }
  },
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = SHAPE_MASKS[index % SHAPE_MASKS.length]
    const to = SHAPE_MASKS[(index + 1) % SHAPE_MASKS.length]
    const on = (mask: number[], i: number) => (mask.includes(i) ? 1 : 0.1)
    return { cell: (i) => [1, lerp(on(from, i), on(to, i), blend)] }
  },
}

function hexagon(f: Frame, x: number, y: number, r: number) {
  f.ctx.beginPath()
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6
    f.ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  f.ctx.closePath()
  f.ctx.fill()
}

function draw(state: SpinnerState, f: Frame) {
  const { cell, spread = 1 } = HIVES[state](f.t)
  const r = f.size * 0.168
  const ring = r * SQRT3 * spread
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + ((i - 1) * TAU) / 6
    const d = i === 0 ? 0 : ring
    const [scale, alpha] = cell(i)
    if (scale <= 0.02) continue
    f.ctx.globalAlpha = alpha
    hexagon(f, f.size / 2 + Math.cos(a) * d, f.size / 2 + Math.sin(a) * d, r * (f.compact ? 0.94 : 0.86) * scale)
  }
}

export const hive: SpinnerSet = {
  id: 'hive',
  label: 'Hive',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'a light runs around the comb',
    searching: 'the core probes one cell at a time',
    solving: 'cells flicker until the comb fills',
    listening: 'each cell swells on its own channel',
    connecting: 'cells light from the center outward',
    weaving: 'alternate cells trade brightness',
    composing: 'the comb builds cell by cell',
    breathing: 'the comb opens and closes',
    shaping: 'ring, triangle, line',
  },
  draw,
}
