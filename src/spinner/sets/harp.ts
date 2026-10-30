import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc, line, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Pose {
  /** Vibration at the antinode; enlarged on compact layouts so it stays visible. */
  amp?: number
  /** Static bow at the midpoint, never rescaled. */
  bend?: number
  mode?: number
  /** Fraction of the full height; strings stay centered. */
  length?: number
  /** Fraction drawn from the top down. */
  drawn?: number
  alpha?: number
}

/** String i (of n, at x) at time t. */
type Strum = (i: number, n: number, t: number, x: number) => Pose

const HALF = 0.75

function pluck(since: number) {
  return since > 0 ? 0.13 * Math.exp(-since * 2.4) * Math.cos(since * 26) : 0
}

function string(f: Frame, x: number, { amp = 0, bend = 0, mode = 1, length = 1, drawn = 1, alpha = 1 }: Pose) {
  const samples = f.compact ? 12 : 28
  const half = HALF * length
  const swing = amp * (f.compact ? 1.6 : 1) + bend
  const points: [number, number][] = []
  for (let j = 0; j <= samples; j++) {
    const u = Math.min(j / samples, drawn)
    points.push([x + swing * Math.sin(mode * Math.PI * u), lerp(-half, half, u)])
    if (u >= drawn) break
  }
  line(f, points, alpha)
  const pin = f.compact ? 0.09 : 0.045
  disc(f, x, -half, pin, alpha)
  if (drawn >= 1) disc(f, x, half, pin, alpha)
}

const PROFILES: ((d: number) => number)[] = [(d) => 1 - d * 0.6, (d) => 0.4 + d * 0.6, () => 0.75]

const STRUMS: Record<SpinnerState, Strum> = {
  working: (i, n, t) => {
    const gap = 0.3
    const loop = n * gap
    return { amp: pluck((((t - i * gap) % loop) + loop) % loop) }
  },
  searching: (i, _, t, x) => {
    const finger = Math.sin(t * 1.4) * 0.7
    return { amp: 0.13 * Math.max(0, 1 - Math.abs(x - finger) / 0.35) * Math.cos(t * 24 + i) }
  },
  solving: (i, _, t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return {
      amp: 0.13 * (1 - settle) * Math.cos(t * (14 + hash(index, i) * 16)),
      mode: 1 + Math.floor(hash(index, i, 1) * 3),
    }
  },
  listening: (i, _, t) => ({ amp: 0.14 * level(t, i) * Math.cos(t * 22 + i * 2) }),
  connecting: (_, __, t, x) => ({ bend: -x * 0.95 * envelope(cycle(t, 3.2).phase, 0.4, 0.7) }),
  weaving: (i, _, t) => ({ amp: 0.1 * Math.sin(t * 3) * (i % 2 ? 1 : -1), mode: 2 }),
  composing: (i, n, t) => {
    const { phase } = cycle(t, 3.6)
    return {
      drawn: smooth((phase - (i / n) * 0.4) / 0.15),
      amp: pluck(phase * 3.6 - 2 - i * 0.08),
      alpha: 1 - smooth((phase - 0.88) / 0.12),
    }
  },
  breathing: (_, __, t) => ({ amp: 0.12 * (breath(t) * 2 - 1) }),
  shaping: (i, n, t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const fromCenter = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2)
    return {
      amp: 0.03 * Math.sin(t * 20 + i),
      length: lerp(PROFILES[index % 3](fromCenter), PROFILES[(index + 1) % 3](fromCenter), blend),
    }
  },
}

export const harp: SpinnerSet = {
  id: 'harp',
  label: 'Harp',
  icon: { state: 'working', t: 0.5 },
  blurbs: {
    working: 'strings are plucked one after another',
    searching: 'a finger brushes back and forth',
    solving: 'jangling strings fall quiet',
    listening: 'strings hum with the voice',
    connecting: 'strings bow inward and meet',
    weaving: 'neighbors sway in opposite S-curves',
    composing: 'strings are strung, then strummed',
    breathing: 'every string sways in the same breeze',
    shaping: 'a peak, a valley, a wall',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.022, 0.07)
    const n = f.compact ? 3 : 5
    for (let i = 0; i < n; i++) {
      const x = lerp(-0.6, 0.6, i / (n - 1))
      string(f, x, STRUMS[state](i, n, f.t, x))
    }
  },
}
