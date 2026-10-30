import { TAU, breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Slot centers in clockwise order from top-left, in units of the slot offset. */
const SLOTS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

interface Tile {
  x: number
  y: number
  scale?: number
  alpha?: number
  rotate?: number
  /** Corner radius as a fraction of the side: 0.5 makes a circle. */
  round?: number
}

interface Quad {
  f: Frame
  /** Distance from the center to a slot center. */
  offset: number
  side: number
}

function tile({ f, offset, side }: Quad, { x, y, scale = 1, alpha = 1, rotate = 0, round = 0.18 }: Tile) {
  const s = side * scale
  if (s <= 0.2) return
  f.ctx.save()
  f.ctx.globalAlpha = alpha
  f.ctx.translate(f.size / 2 + x * offset, f.size / 2 + y * offset)
  f.ctx.rotate(rotate)
  f.ctx.beginPath()
  f.ctx.roundRect(-s / 2, -s / 2, s, s, s * round)
  f.ctx.fill()
  f.ctx.restore()
}

function each(q: Quad, paint: (slot: [number, number], j: number) => Tile | null) {
  SLOTS.forEach((slot, j) => {
    const spec = paint(slot, j)
    if (spec) tile(q, spec)
  })
}

const SHAPES: { round: number; rotate: number }[] = [
  { round: 0.18, rotate: 0 },
  { round: 0.5, rotate: 0 },
  { round: 0.18, rotate: Math.PI / 4 },
]

const QUADS: Record<SpinnerState, (q: Quad) => void> = {
  working: (q) => {
    const { index, phase } = cycle(q.f.t, 0.45)
    const empty = (4 - (index % 4)) % 4
    const mover = (empty + 1) % 4
    const slide = smooth(phase * 1.6)
    each(q, ([x, y], j) => {
      if (j === empty) return null
      if (j !== mover) return { x, y }
      const [tx, ty] = SLOTS[empty]
      return { x: lerp(x, tx, slide), y: lerp(y, ty, slide) }
    })
  },
  searching: (q) => {
    const head = (q.f.t * 3) % 4
    each(q, ([x, y], j) => ({ x, y, alpha: 0.15 + 0.85 * Math.exp(-(((head - j + 4) % 4) * 1.3)) }))
  },
  solving: (q) => {
    const { index, phase } = cycle(q.f.t, 2.8)
    const settle = smooth((phase - 0.35) / 0.35)
    each(q, ([x, y], j) => ({ x, y, rotate: (1 - settle) * (hash(index, j) * TAU + q.f.t * 3) }))
  },
  listening: (q) => each(q, ([x, y], j) => ({ x, y, scale: 0.4 + 0.6 * level(q.f.t, j) })),
  connecting: (q) => {
    const { phase } = cycle(q.f.t, 3)
    const join = envelope(phase, 0.4, 0.7)
    const spread = 1 + 0.6 * (1 - join)
    each(q, ([x, y]) => ({ x: x * spread, y: y * spread, alpha: 0.45 + 0.55 * join, scale: 0.8 + 0.2 * join }))
  },
  weaving: (q) => {
    const swap = 0.5 - 0.5 * Math.cos(q.f.t * 2)
    each(q, ([x, y], j) => {
      const pair = j % 2
      const k = pair === 0 ? swap : 1 - swap
      const [tx, ty] = SLOTS[(j + 2) % 4]
      const bow = Math.sin(k * Math.PI) * (pair === 0 ? 0.9 : -0.9)
      return {
        x: lerp(x, tx, k) + -y * bow * 0.5,
        y: lerp(y, ty, k) + x * bow * 0.5,
        alpha: pair === 0 ? 0.95 : 0.55,
      }
    })
  },
  composing: (q) => {
    const { phase } = cycle(q.f.t, 3)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    each(q, ([x, y], j) => ({ x, y, scale: smooth((phase - j * 0.15) / 0.15) * fade }))
  },
  breathing: (q) => {
    const b = breath(q.f.t)
    const spin = q.f.t * 0.3
    each(q, ([x, y]) => {
      const spread = 0.65 + 0.3 * b
      const rx = x * Math.cos(spin) - y * Math.sin(spin)
      const ry = x * Math.sin(spin) + y * Math.cos(spin)
      return { x: rx * spread, y: ry * spread, rotate: spin, scale: 0.85, alpha: 0.6 + 0.4 * b }
    })
  },
  shaping: (q) => {
    const { index, phase } = cycle(q.f.t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = SHAPES[index % SHAPES.length]
    const to = SHAPES[(index + 1) % SHAPES.length]
    const round = lerp(from.round, to.round, blend)
    const rotate = lerp(from.rotate, to.rotate === 0 && from.rotate !== 0 ? Math.PI / 2 : to.rotate, blend)
    each(q, ([x, y]) => ({ x, y, round, rotate, scale: 1 - 0.18 * Math.sin(2 * rotate) }))
  },
}

export const quad: SpinnerSet = {
  id: 'quad',
  label: 'Quad',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'tiles slide around an empty slot',
    searching: 'a highlight steps clockwise',
    solving: 'tiles spin, then square up',
    listening: 'each tile pulses on its own channel',
    connecting: 'four tiles drift in and dock',
    weaving: 'diagonal pairs swap past each other',
    composing: 'tiles stamp down one by one',
    breathing: 'the group opens and closes as it turns',
    shaping: 'squares, circles, diamonds',
  },
  draw(state, f) {
    QUADS[state]({ f, offset: f.size * 0.21, side: f.size * (f.compact ? 0.36 : 0.32) })
  },
}
