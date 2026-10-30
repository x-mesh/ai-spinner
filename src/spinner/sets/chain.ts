import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Hang {
  /** Link centers in order, one list per separate chain. */
  points: Point[] | Point[][]
  anchors?: Point[]
  alpha?: number
  /** The last link joins the first. */
  closed?: boolean
}

const ANCHOR: Point = [0, -0.8]

/** Alternate links face the viewer as rings and turn edge-on as bars, like real chain. */
function links(f: Frame, { points, anchors = [], alpha = 1, closed = false }: Hang) {
  f.ctx.globalAlpha = alpha
  const chains = (typeof points[0]?.[0] === 'number' ? [points] : points) as Point[][]
  chains.forEach((one) => strand(f, one, closed))
  anchors.forEach(([x, y]) => disc(f, x, y, f.compact ? 0.1 : 0.05, alpha))
}

function strand(f: Frame, points: Point[], closed: boolean) {
  const s = space(f)
  points.forEach(([x, y], k) => {
    const next = points[k + 1] ?? (closed ? points[0] : undefined)
    const prev = points[k - 1] ?? (closed ? points[points.length - 1] : undefined)
    const [bx, by] = next ?? prev ?? [x, y + 0.1]
    const dir = next ? Math.atan2(by - y, bx - x) : Math.atan2(y - by, x - bx)
    const len = Math.max(0.05, Math.hypot(bx - x, by - y))
    f.ctx.save()
    f.ctx.translate(s.x(x), s.y(y))
    f.ctx.rotate(dir)
    f.ctx.beginPath()
    if (k % 2 === 0) f.ctx.ellipse(0, 0, s.len(len * 0.62), s.len(len * 0.32), 0, 0, TAU)
    else {
      f.ctx.moveTo(s.len(-len * 0.6), 0)
      f.ctx.lineTo(s.len(len * 0.6), 0)
    }
    f.ctx.stroke()
    f.ctx.restore()
  })
}

/** A chain hanging from the anchor, each link turned by its own angle from vertical. */
function hanging(n: number, angle: (k: number) => number, from: Point = ANCHOR, length = 1.45): Point[] {
  const step = length / n
  const points: Point[] = []
  let [x, y] = from
  for (let k = 0; k < n; k++) {
    const a = angle(k)
    x += Math.sin(a) * step
    y += Math.cos(a) * step
    points.push([x - (Math.sin(a) * step) / 2, y - (Math.cos(a) * step) / 2])
  }
  return points
}

/** A chain slung between two anchors, sagging like a parabola. */
function slung(n: number, half: number, sag: number, y0 = -0.35): Point[] {
  return Array.from({ length: n }, (_, k): Point => {
    const x = lerp(-half, half, (k + 0.5) / n)
    return [x, y0 + sag * (1 - (x / half) ** 2)]
  })
}

const HANGS: Record<SpinnerState, (t: number, n: number) => Hang> = {
  working: (t, n) => ({ points: hanging(n, (k) => 0.4 * Math.sin(t * 2.2 - k * 0.35) * (k / n)), anchors: [ANCHOR] }),
  searching: (t, n) => ({ points: hanging(n, (k) => 0.6 * Math.sin(t * 1.3 - k * 0.04)), anchors: [ANCHOR] }),
  solving: (t, n) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return { points: hanging(n, (k) => (1 - settle) * (hash(index, k) * 3 - 1.5)), anchors: [ANCHOR] }
  },
  listening: (t, n) => ({ points: hanging(n, (k) => 0.3 * level(t, k % 3) * Math.sin(k * 1.3 + t * 9)), anchors: [ANCHOR] }),
  connecting: (t, n) => {
    const e = envelope(cycle(t, 3.2).phase, 0.4, 0.7)
    const half = lerp(0.75, 0.35, e)
    return { points: slung(n, half, lerp(0.15, 0.85, e)), anchors: [[-half, -0.35], [half, -0.35]] }
  },
  weaving: (t, n) => ({
    points: [
      hanging(n, (k) => 0.3 * Math.sin(t * 2) * (k / n), [-0.15, -0.8]),
      hanging(n, (k) => -0.3 * Math.sin(t * 2) * (k / n), [0.15, -0.8]),
    ],
    anchors: [[-0.15, -0.8], [0.15, -0.8]],
  }),
  composing: (t, n) => {
    const { phase } = cycle(t, 3.6)
    const shown = Math.floor(n * smooth(phase / 0.7))
    return { points: hanging(n, (k) => 0.15 * Math.sin(t * 2 - k * 0.3)).slice(0, shown), anchors: [ANCHOR], alpha: 1 - smooth((phase - 0.85) / 0.15) }
  },
  breathing: (t, n) => ({ points: slung(n, 0.7, 0.2 + 0.4 * breath(t)), anchors: [[-0.7, -0.35], [0.7, -0.35]] }),
  shaping: (t, n) => {
    const shape = shapeMorph(t)
    const count = n + 4
    return {
      points: Array.from({ length: count }, (_, k): Point => {
        const a = (k / count) * TAU + t * 0.4
        return [Math.cos(a) * 0.65 * shape(a), Math.sin(a) * 0.65 * shape(a)]
      }),
      closed: true,
    }
  },
}

export const chain: SpinnerSet = {
  id: 'chain',
  label: 'Chain',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'a hanging chain ripples as it sways',
    searching: 'the chain swings wide like a pendulum',
    solving: 'a tangled chain falls straight',
    listening: 'links rattle with the voice',
    connecting: 'two ends draw together and the chain sags',
    weaving: 'two chains swing across each other',
    composing: 'the chain lengthens link by link',
    breathing: 'a slung chain sags and tightens',
    shaping: 'a necklace in a circle, a triangle, a square',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.022, 0.065)
    links(f, HANGS[state](f.t, f.compact ? 7 : 12))
  },
}
