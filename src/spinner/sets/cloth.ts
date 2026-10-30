import { breath, clamp01, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Height of the sheet at (x, y), both in -EXTENT..EXTENT. */
type Surface = (x: number, y: number) => number

interface Sheet {
  height: Surface
  /** Fraction of grid lines laid down, front to back. */
  progress?: number
}

const EXTENT = 0.7
const PITCH = 0.95
const CAMERA = 3

/** Grid lines across a waving sheet seen from above and in front; farther lines are fainter. */
function sheet(f: Frame, { height, progress = 1 }: Sheet, yaw: number) {
  const s = space(f)
  const lines = f.compact ? 5 : 9
  const samples = f.compact ? 12 : 28
  const project = (x: number, y: number) => {
    const h = height(x, y)
    const xr = x * Math.cos(yaw) - y * Math.sin(yaw)
    const zr = x * Math.sin(yaw) + y * Math.cos(yaw)
    const depth = zr * Math.cos(PITCH) + h * Math.sin(PITCH)
    const persp = CAMERA / (CAMERA - depth)
    return { x: xr * persp, y: (zr * Math.sin(PITCH) - h * Math.cos(PITCH)) * persp, depth }
  }
  const stroke = (at: (u: number) => [number, number], length: number) => {
    const points = Array.from({ length: Math.round(samples * length) + 1 }, (_, i) => project(...at(lerp(-EXTENT, EXTENT, i / samples))))
    if (points.length < 2) return
    const depth = points.reduce((sum, p) => sum + p.depth, 0) / points.length
    f.ctx.globalAlpha = 0.35 + 0.65 * clamp01(0.5 + depth / 1.2)
    f.ctx.beginPath()
    points.forEach((p) => f.ctx.lineTo(s.x(p.x), s.y(p.y)))
    f.ctx.stroke()
  }
  for (let k = 0; k < lines; k++) {
    const c = lerp(-EXTENT, EXTENT, k / (lines - 1))
    if ((lines - 1 - k) / lines < progress) stroke((u) => [u, c], 1)
    stroke((u) => [c, u], progress)
  }
}

function bump(dx: number, dy: number, width: number) {
  return Math.exp(-(dx * dx + dy * dy) * width)
}

const DRAPES: Surface[] = [
  (x, y) => bump(x, y, 5),
  (x, y) => Math.max(0, 1 - (Math.abs(x) + Math.abs(y)) * 1.4),
  (x, y) => smooth((0.38 - Math.max(Math.abs(x), Math.abs(y))) / 0.15),
]

const SHEETS: Record<SpinnerState, (t: number) => Sheet> = {
  working: (t) => ({ height: (x, y) => 0.15 * Math.sin(x * 4 + y * 3 - t * 3) }),
  searching: (t) => {
    const px = 0.4 * Math.cos(t * 1.3)
    const py = 0.4 * Math.sin(t * 1.3)
    return { height: (x, y) => 0.38 * bump(x - px, y - py, 8) }
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const crumple = 0.3 * (1 - smooth((phase - 0.3) / 0.45))
    const [a, b, c] = [0, 1, 2].map((k) => hash(index, k) * 6)
    return {
      height: (x, y) => crumple * Math.sin(x * 7 + a) * Math.sin(y * 6 + b) + crumple * 0.5 * Math.sin((x + y) * 9 + c) + 0.05 * Math.sin(x * 3 - t * 2),
    }
  },
  listening: (t) => {
    const amp = 0.05 + 0.2 * level(t, 0)
    return { height: (x, y) => amp * Math.sin(Math.hypot(x, y) * 9 - t * 6) * Math.exp(-Math.hypot(x, y) * 1.5) }
  },
  connecting: (t) => {
    const c = 0.45 * (1 - envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return { height: (x, y) => 0.32 * Math.max(bump(x - c, y, 10), bump(x + c, y, 10)) }
  },
  weaving: (t) => ({ height: (x, y) => 0.16 * Math.sin(x * 5) * Math.sin(y * 5) * Math.cos(t * 2.5) }),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    return { height: (x, y) => 0.08 * Math.sin(x * 4 + y * 3 - t * 3), progress: smooth(phase / 0.7) * (1 - smooth((phase - 0.85) / 0.15)) }
  },
  breathing: (t) => ({ height: (x, y) => 0.35 * breath(t) * Math.max(0, 1 - (x * x + y * y) / 0.98) }),
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = DRAPES[index % 3]
    const to = DRAPES[(index + 1) % 3]
    return { height: (x, y) => 0.35 * lerp(from(x, y), to(x, y), blend) }
  },
}

export const cloth: SpinnerSet = {
  id: 'cloth',
  label: 'Cloth',
  icon: { state: 'searching', t: 0.9 },
  blurbs: {
    working: 'a sheet ripples in the wind',
    searching: 'something moves around under the sheet',
    solving: 'a crumpled sheet smooths out flat',
    listening: 'ripples spread across the sheet with the voice',
    connecting: 'two bumps slide together under the sheet',
    weaving: 'the sheet flexes in a checker of peaks',
    composing: 'the grid is woven thread by thread',
    breathing: 'the sheet billows up and settles',
    shaping: 'draped over a ball, a pyramid, a box',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.018, 0.06)
    sheet(f, SHEETS[state](f.t), 0.6 + 0.25 * Math.sin(f.t * 0.4))
  },
}
