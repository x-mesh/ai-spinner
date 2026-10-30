import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Flap {
  /** Direction of the flap's outward normal. */
  angle: number
  /** Distance of the crease from the center along that normal. */
  offset: number
  /** 0 flat, 0.5 standing up, 1 folded fully over. */
  p: number
}

/** Keeps the part of a convex polygon on one side of the crease line. */
function cut(poly: Point[], nx: number, ny: number, offset: number, outside: boolean): Point[] {
  const side = (q: Point) => (q[0] * nx + q[1] * ny - offset) * (outside ? 1 : -1)
  const out: Point[] = []
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    const sa = side(a)
    const sb = side(b)
    if (sa >= 0) out.push(a)
    if ((sa >= 0) !== (sb >= 0)) {
      const k = sa / (sa - sb)
      out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)])
    }
  })
  return out
}

function fill(f: Frame, poly: Point[], alpha: number) {
  const s = space(f)
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  poly.forEach(([x, y]) => f.ctx.lineTo(s.x(x), s.y(y)))
  f.ctx.closePath()
  f.ctx.fill()
}

/** Flaps swing over their crease in 3D; a flap past vertical shows its paler underside over the sheet. */
function paper(f: Frame, sheet: Point[], flaps: Flap[]) {
  const flat = flaps.reduce((poly, { angle, offset }) => cut(poly, Math.cos(angle), Math.sin(angle), offset, false), sheet)
  fill(f, flat, 1)
  for (const { angle, offset, p } of flaps) {
    const nx = Math.cos(angle)
    const ny = Math.sin(angle)
    const lift = Math.cos(Math.PI * p)
    const moved = cut(sheet, nx, ny, offset, true).map(([x, y]): Point => {
      const d = x * nx + y * ny - offset
      return [x - nx * d * (1 - lift), y - ny * d * (1 - lift)]
    })
    if (moved.length < 3) continue
    if (lift >= 0) {
      fill(f, moved, 1 - 0.4 * (p / 0.5))
      continue
    }
    f.ctx.globalCompositeOperation = 'destination-out'
    fill(f, moved, 1)
    f.ctx.globalCompositeOperation = 'source-over'
    fill(f, moved, 0.55)
  }
}

const HALF = 0.6
const SQUARE: Point[] = [
  [-HALF, -HALF],
  [HALF, -HALF],
  [HALF, HALF],
  [-HALF, HALF],
]

/** Creases that fold each corner to the center, like an envelope. */
function corners(p: (k: number) => number): Flap[] {
  return [0, 1, 2, 3].map((k) => ({ angle: Math.PI / 4 + (k * Math.PI) / 2, offset: 0.42, p: p(k) }))
}

const FOLDS: Record<SpinnerState, (t: number) => { sheet?: Point[]; flaps: Flap[] }> = {
  working: (t) => {
    const { index, phase } = cycle(t, 2.4)
    return { flaps: [{ angle: (index * Math.PI) / 4, offset: 0, p: envelope(phase, 0.4, 0.6) }] }
  },
  searching: (t) => ({ flaps: [{ angle: t * 0.8, offset: 0.1, p: 0.3 + 0.2 * Math.sin(t * 2.2) }] }),
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return { flaps: corners((k) => lerp(0.15 + 0.75 * hash(index, k), 0, settle)) }
  },
  listening: (t) => ({ flaps: corners((k) => 0.55 * level(t, k)) }),
  connecting: (t) => {
    const p = 0.97 * envelope(cycle(t, 3.2).phase, 0.4, 0.7)
    return { flaps: [0, Math.PI].map((angle) => ({ angle, offset: 0.3, p })) }
  },
  weaving: (t) => ({ flaps: corners((k) => 0.5 + 0.45 * Math.sin(t * 2.5 + k * Math.PI)) }),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    return { flaps: corners((k) => smooth((phase - k * 0.15) / 0.15) * (1 - smooth((phase - 0.8) / 0.2))) }
  },
  breathing: (t) => ({ flaps: [{ angle: Math.PI / 4, offset: 0, p: 0.45 * breath(t) }] }),
  shaping: (t) => {
    const shape = shapeMorph(t)
    const sheet = Array.from({ length: 48 }, (_, i): Point => {
      const a = (i / 48) * TAU
      return [Math.cos(a) * 0.75 * shape(a), Math.sin(a) * 0.75 * shape(a)]
    })
    return { sheet, flaps: [{ angle: t * 0.5, offset: 0, p: 0.25 + 0.2 * Math.sin(t * 2) }] }
  },
}

export const fold: SpinnerSet = {
  id: 'fold',
  label: 'Fold',
  icon: { state: 'composing', t: 1.4 },
  blurbs: {
    working: 'a sheet folds in half along a new crease each time',
    searching: 'a flap lifts and turns around the sheet',
    solving: 'dog-eared corners smooth flat',
    listening: 'corners lift with the voice',
    connecting: 'two sides fold in to meet in the middle',
    weaving: 'corners flap in a pinwheel',
    composing: 'four corners fold into an envelope',
    breathing: 'a corner lifts and settles',
    shaping: 'a circle, a triangle, a square of paper',
  },
  draw(state, f) {
    const { sheet = SQUARE, flaps } = FOLDS[state](f.t)
    paper(f, sheet, flaps)
  },
}
