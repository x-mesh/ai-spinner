import { TAU, breath, clamp01, cycle, envelope, hash, level, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type V3 = [number, number, number]
type Curve = (u: number) => V3

interface Pose {
  yaw: number
  pitch: number
  scale?: number
  alpha?: number
  /** Fraction of each curve drawn. */
  progress?: number
}

interface Segment {
  a: V3
  b: V3
  depth: number
}

/** (p, q) torus knot, normalized so it always spans about 0.8. */
function torusKnot(p: number, q: number, tube = 1): Curve {
  const k = 0.8 / (2 + tube)
  return (u) => {
    const r = 2 + tube * Math.cos(q * u)
    return [r * Math.cos(p * u) * k, r * Math.sin(p * u) * k, -tube * Math.sin(q * u) * k]
  }
}

function rotate([x, y, z]: V3, { yaw, pitch, scale = 1 }: Pose): V3 {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw)
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw)
  return [x1 * scale, (y * Math.cos(pitch) - z1 * Math.sin(pitch)) * scale, (y * Math.sin(pitch) + z1 * Math.cos(pitch)) * scale]
}

/** Strokes back to front, clearing a band under each segment so crossings read as over and under. */
function tie(f: Frame, curves: Curve[], pose: Pose) {
  const s = space(f)
  const samples = f.compact ? 60 : 140
  const width = f.ctx.lineWidth
  const segments: Segment[] = []
  curves.forEach((curve) => {
    const count = Math.round(samples * (pose.progress ?? 1))
    let prev = rotate(curve(0), pose)
    for (let i = 1; i <= count; i++) {
      const next = rotate(curve((i / samples) * TAU), pose)
      segments.push({ a: prev, b: next, depth: (prev[2] + next[2]) / 2 })
      prev = next
    }
  })
  segments.sort((m, n) => n.depth - m.depth)
  f.ctx.globalAlpha = pose.alpha ?? 1
  segments.forEach(({ a, b, depth }) => {
    f.ctx.beginPath()
    f.ctx.moveTo(s.x(a[0]), s.y(a[1]))
    f.ctx.lineTo(s.x(b[0]), s.y(b[1]))
    // Butt caps keep the clearing band from biting into the neighboring segment behind each joint.
    f.ctx.globalCompositeOperation = 'destination-out'
    f.ctx.lineCap = 'butt'
    f.ctx.lineWidth = width * (f.compact ? 1.8 : 2.6)
    f.ctx.stroke()
    f.ctx.globalCompositeOperation = 'source-over'
    f.ctx.lineCap = 'round'
    f.ctx.lineWidth = width * (0.8 + 0.4 * clamp01(0.5 - depth / 1.6))
    f.ctx.stroke()
  })
}

const TREFOIL = torusKnot(2, 3)
const KNOTS = [TREFOIL, torusKnot(2, 5), torusKnot(3, 4)]

const KNOTS_BY_STATE: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => tie(f, [TREFOIL], { yaw: f.t * 0.9, pitch: 0.5 + 0.3 * Math.sin(f.t * 0.6) }),
  searching: (f) => {
    const pose = { yaw: f.t * 0.6, pitch: 0.6 }
    tie(f, [TREFOIL], pose)
    const [x, y] = rotate(TREFOIL(f.t * 1.4), pose)
    disc(f, x, y, f.compact ? 0.13 : 0.075)
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.2)
    const tangle = 0.22 * (1 - smooth((phase - 0.3) / 0.45))
    const seed = hash(index) * 9
    const curve: Curve = (u) => {
      const [x, y, z] = TREFOIL(u)
      return [
        x + tangle * Math.sin(u * 7 + seed + f.t * 3),
        y + tangle * Math.sin(u * 5 + seed * 1.3 - f.t * 2),
        z + tangle * Math.cos(u * 6 + seed),
      ]
    }
    tie(f, [curve], { yaw: f.t * 0.6, pitch: 0.5 })
  },
  listening: (f) => tie(f, [torusKnot(2, 3, 0.4 + 0.9 * level(f.t, 0))], { yaw: f.t * 0.6, pitch: 0.5 }),
  connecting: (f) => {
    const d = 0.25 + 0.35 * (1 - envelope(cycle(f.t, 3.4).phase, 0.4, 0.7))
    const r = 0.42
    const rings: Curve[] = [
      (u) => [-d + r * Math.cos(u), r * Math.sin(u), 0],
      (u) => [d + r * Math.cos(u), 0, r * Math.sin(u)],
    ]
    tie(f, rings, { yaw: 0.5 + Math.sin(f.t * 0.7) * 0.3, pitch: 0.4 })
  },
  weaving: (f) => tie(f, [KNOTS[1]], { yaw: f.t * 0.5, pitch: 1.1 + 0.2 * Math.sin(f.t * 0.4) }),
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    tie(f, [TREFOIL], {
      yaw: f.t * 0.5,
      pitch: 0.5,
      progress: smooth(phase / 0.75),
      alpha: 1 - smooth((phase - 0.88) / 0.12),
    })
  },
  breathing: (f) => tie(f, [torusKnot(2, 3, 0.5 + 0.7 * breath(f.t))], { yaw: f.t * 0.3, pitch: 0.5 }),
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    tie(f, [KNOTS[index % KNOTS.length]], { yaw: f.t * 0.8, pitch: 0.5, scale: 0.6 + 0.4 * swap, alpha: swap })
  },
}

export const knot: SpinnerSet = {
  id: 'knot',
  label: 'Knot',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'a trefoil knot tumbles',
    searching: 'a bead runs along the knot',
    solving: 'a tangle tightens into a trefoil',
    listening: 'the loops deepen with the voice',
    connecting: 'two rings slide into a chain link',
    weaving: 'a five-lobed knot turns over and under',
    composing: 'the knot ties itself',
    breathing: 'the knot loosens and tightens',
    shaping: 'three, five, and three-by-four crossings',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.035, 0.08)
    KNOTS_BY_STATE[state](f)
  },
}
