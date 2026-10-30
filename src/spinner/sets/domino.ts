import { cycle, lerp, level, smooth } from '../math.js'
import { space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Dims {
  floor: number
  width: number
  height: number
}

/** Inline sizes get fewer, much larger tiles so the row still reads as dominoes. */
function dims(f: Frame): Dims {
  return f.compact ? { floor: 0.62, width: 0.24, height: 1 } : { floor: 0.55, width: 0.12, height: 0.62 }
}

interface Tile {
  angle: number
  /** +1 topples to the right (pivot on its right foot), -1 to the left. */
  direction?: 1 | -1
  height?: number
  lift?: number
  alpha?: number
}

/** Tile i (of n) at time t. */
type Row = (i: number, n: number, t: number, d: Dims) => Tile

function columns(n: number) {
  return Array.from({ length: n }, (_, i) => lerp(-0.7, 0.7, i / (n - 1)))
}

/** Angle at which a falling tile comes to rest against its neighbor. */
function restAngle(n: number, d: Dims) {
  const gap = 1.4 / (n - 1) - d.width
  return Math.asin(Math.min(1, gap / d.height))
}

function fallen(i: number, n: number, progress: number, d: Dims) {
  const q = smooth((progress - (i / n) * 0.7) / 0.14)
  return q * (i === n - 1 ? Math.PI / 2 : restAngle(n, d))
}

function tile(f: Frame, x: number, d: Dims, { angle, direction = 1, height = d.height, lift = 0, alpha = 1 }: Tile) {
  const s = space(f)
  f.ctx.save()
  f.ctx.globalAlpha = alpha
  f.ctx.translate(s.x(x + (direction * d.width) / 2), s.y(d.floor - lift))
  f.ctx.rotate(angle * direction)
  const w = s.len(d.width)
  const h = s.len(height)
  f.ctx.beginPath()
  f.ctx.roundRect(direction === 1 ? -w : 0, -h, w, h, w * 0.25)
  f.ctx.fill()
  f.ctx.restore()
}

const PROFILES: ((d: number) => number)[] = [(d) => 1 - d * 0.6, (d) => 0.4 + d * 0.6, () => 0.75]

const ROWS: Record<SpinnerState, Row> = {
  working: (i, n, t, d) => {
    const { phase } = cycle(t, 3)
    return { angle: fallen(i, n, phase / 0.8, d), alpha: 1 - smooth((phase - 0.88) / 0.12) }
  },
  searching: (i, _, t) => ({ angle: 0.25 * Math.max(0, Math.sin(t * 4 - i * 0.8)) }),
  solving: (i, n, t, d) => {
    const { phase } = cycle(t, 3.2)
    const stand = smooth((phase - 0.3 - ((n - 1 - i) / n) * 0.4) / 0.14)
    return { angle: (1 - stand) * fallen(i, n, 1, d) }
  },
  listening: (i, _, t) => ({ angle: 0.35 * level(t, i) }),
  connecting: (i, n, t, d) => {
    const { phase } = cycle(t, 3.4)
    const half = Math.floor(n / 2)
    const left = i < half
    const k = left ? i : n - 1 - i
    const q = smooth((phase - (k / half) * 0.4) / 0.14) * (1 - smooth((phase - 0.85) / 0.15))
    return { angle: q * restAngle(n, d) * 1.1, direction: left ? 1 : -1 }
  },
  weaving: (i, _, t) => {
    const lean = 0.3 * Math.sin(t * 2.5)
    return { angle: Math.abs(lean), direction: (i % 2 === 0) === (lean > 0) ? 1 : -1 }
  },
  composing: (i, n, t, d) => {
    const { phase } = cycle(t, 4.2)
    const drop = smooth((phase - (i / n) * 0.45) / 0.12)
    const fade = 1 - smooth((phase - 0.9) / 0.1)
    return { angle: fallen(i, n, (phase - 0.6) / 0.28, d), lift: (1 - drop) * 1.4, alpha: drop * fade }
  },
  breathing: (_, __, t) => {
    const lean = 0.22 * Math.sin(t * 1.2)
    return { angle: Math.abs(lean), direction: lean >= 0 ? 1 : -1 }
  },
  shaping: (i, n, t, d) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const fromCenter = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2)
    return {
      angle: 0,
      height: d.height * lerp(PROFILES[index % 3](fromCenter), PROFILES[(index + 1) % 3](fromCenter), blend),
    }
  },
}

export const domino: SpinnerSet = {
  id: 'domino',
  label: 'Domino',
  icon: { state: 'searching', t: 0.4 },
  blurbs: {
    working: 'a chain topples from left to right',
    searching: 'a wobble travels down the line',
    solving: 'fallen tiles stand back up in reverse',
    listening: 'tiles rock with the voice',
    connecting: 'two chains fall toward the middle',
    weaving: 'alternate tiles lean opposite ways',
    composing: 'tiles are placed one by one, then fall',
    breathing: 'the row leans back and forth together',
    shaping: 'a peak, a valley, a wall',
  },
  draw(state, f) {
    const n = f.compact ? 3 : 6
    const d = dims(f)
    columns(n).forEach((x, i) => tile(f, x, d, ROWS[state](i, n, f.t, d)))
  },
}
