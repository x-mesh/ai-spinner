import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { paintField } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Band coordinate at (u, v): one ink band per whole unit. */
type Band = (u: number, v: number) => number

interface Pattern {
  /** Overlapping band sets are combined like XOR, so crossings weave. */
  bands: Band[]
  /** Ink share of each band, 0..1. */
  weight?: number
  /** Edge of the disc along canvas angle a. */
  rim?: (a: number) => number
}

function spiral(arms: number, wind: number, spin: number): Band {
  return (u, v) => (arms * Math.atan2(v, u)) / TAU + wind * Math.hypot(u, v) + spin
}

function stripe(x: number, weight: number, soft: number) {
  const d = Math.abs(x - Math.round(x))
  return smooth((weight / 2 - d) / soft + 0.5)
}

function paint(f: Frame, { bands, weight = 0.5, rim = () => 0.95 }: Pattern) {
  const soft = f.compact ? 0.12 : 0.06
  paintField(f, (u, v) => {
    const edge = smooth((rim(Math.atan2(v, u)) - Math.hypot(u, v)) / 0.04 + 0.5)
    if (edge <= 0) return 0
    let ink = 0
    for (const band of bands) {
      const s = stripe(band(u, v), weight, soft)
      ink = ink + s - 2 * ink * s
    }
    return ink * edge
  })
}

/** Compact sizes wind fewer bands so each stays a few pixels wide. */
const PATTERNS: Record<SpinnerState, (t: number, k: number) => Pattern> = {
  working: (t, k) => ({ bands: [spiral(2, 2.2 * k, -t * 1.2)] }),
  searching: (t, k) => ({ bands: [spiral(1, 1.8 * k, Math.sin(t * 1.3) * 1.2)] }),
  solving: (t, k) => {
    const { index, phase } = cycle(t, 3.2)
    const tangle = 0.6 * (1 - smooth((phase - 0.3) / 0.45))
    const seed = hash(index) * 9
    const calm = spiral(2, 2.2 * k, -t * 0.6)
    return { bands: [(u, v) => calm(u, v) + tangle * Math.sin(u * 5 + seed + t * 3) * Math.cos(v * 4 - seed)] }
  },
  listening: (t, k) => {
    const calm = spiral(2, 2.2 * k, -t * 0.6)
    const ripple = 0.35 * level(t, 0)
    return { bands: [(u, v) => calm(u, v) + ripple * Math.sin(Math.hypot(u, v) * 14 * k - t * 6)] }
  },
  connecting: (t, k) => {
    const c = lerp(0.6, 0.15, envelope(cycle(t, 3.4).phase, 0.4, 0.7))
    return {
      bands: [
        (u, v) =>
          (Math.atan2(v, u + c) + Math.atan2(v, u - c)) / TAU + 1.1 * k * (Math.hypot(u + c, v) + Math.hypot(u - c, v)) - t * 0.8,
      ],
    }
  },
  weaving: (t, k) => ({ bands: [spiral(2, 2 * k, -t), spiral(2, -2 * k, -t)] }),
  composing: (t, k) => {
    const { phase } = cycle(t, 3.6)
    return {
      bands: [spiral(2, 2.2 * k, -t)],
      rim: () => 0.95 * smooth(phase / 0.7),
      weight: 0.5 * (1 - smooth((phase - 0.85) / 0.15)),
    }
  },
  breathing: (t, k) => ({ bands: [spiral(2, 2.2 * k, -t * 0.3)], weight: 0.2 + 0.6 * breath(t) }),
  shaping: (t, k) => {
    const shape = shapeMorph(t)
    return { bands: [spiral(2, 2.2 * k, -t)], rim: (a) => 0.92 * shape(a) }
  },
}

export const swirl: SpinnerSet = {
  id: 'swirl',
  label: 'Swirl',
  icon: { state: 'working', t: 0.4 },
  blurbs: {
    working: 'a hypnotic spiral winds inward',
    searching: 'the spiral turns one way, then the other',
    solving: 'warped bands straighten into a spiral',
    listening: 'ripples run through the spiral with the voice',
    connecting: 'two whirlpools merge into one and split',
    weaving: 'two counter-wound spirals weave a lattice',
    composing: 'the spiral spreads out from the center',
    breathing: 'the bands thicken and thin',
    shaping: 'a spiral in a circle, a triangle, a square',
  },
  draw(state, f) {
    paint(f, PATTERNS[state](f.t, f.compact ? 0.6 : 1))
  },
}
