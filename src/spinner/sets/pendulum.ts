import { TAU, breath, cycle, hash, lerp, level, smooth } from '../math.js'
import { disc, line, strokeWidth } from '../space.js'
import type { SpinnerSet, SpinnerState } from '../types.js'

/** Horizontal offset of bob i (of n, at height y) at time t, seen from above. */
type Swing = (i: number, n: number, t: number, y: number) => number

const SILHOUETTES: ((y: number) => number)[] = [
  (y) => Math.sqrt(Math.max(0, 1 - y * y)) * 0.75,
  (y) => ((y + 1) / 2) * 0.8,
  () => 0.65,
]

const SWINGS: Record<SpinnerState, Swing> = {
  working: (i, _, t) => 0.75 * Math.sin(t * (2 + i * 0.22)),
  searching: (i, _, t) => 0.7 * Math.sin(t * 2.2 - i * 0.55),
  solving: (i, _, t) => {
    const { index, phase } = cycle(t, 3.4)
    const settle = smooth((phase - 0.3) / 0.45)
    return 0.7 * Math.sin(t * 2.2 + (1 - settle) * hash(index, i) * TAU)
  },
  listening: (i, _, t) => (i % 2 ? 1 : -1) * 0.7 * level(t, i),
  connecting: (i, _, t) => (i % 2 ? 1 : -1) * 0.65 * Math.sin(t * 2),
  weaving: (i, _, t) => 0.6 * Math.sin(t * 2.4 + (i % 2 ? -1 : 1) * i * 0.6),
  composing: (i, n, t) => {
    const { phase } = cycle(t, 4)
    const released = smooth((phase - (i / n) * 0.5) / 0.15) * (1 - smooth((phase - 0.85) / 0.15))
    return 0.7 * released * Math.sin(t * 3)
  },
  breathing: (i, _, t) => 0.7 * Math.sin(t * 1.1 - i * 0.15) * (0.3 + 0.7 * breath(t)),
  shaping: (_, __, t, y) => {
    const { index, phase } = cycle(t, 2.4)
    const blend = smooth((phase - 0.6) / 0.4)
    const width = lerp(SILHOUETTES[index % 3](y), SILHOUETTES[(index + 1) % 3](y), blend)
    return width * Math.sin(t * 2.6)
  },
}

export const pendulum: SpinnerSet = {
  id: 'pendulum',
  label: 'Pendulum',
  icon: { state: 'working', t: 1.9 },
  blurbs: {
    working: 'a pendulum wave drifts in and out of sync',
    searching: 'a snake of bobs slithers back and forth',
    solving: 'out-of-step bobs fall into lockstep',
    listening: 'bobs kick out with the voice',
    connecting: 'alternate bobs zip past each other',
    weaving: 'two waves travel through each other',
    composing: 'bobs are released one by one',
    breathing: 'the swing grows and fades',
    shaping: 'the swing traces a circle, triangle, square',
  },
  draw(state, f) {
    const n = f.compact ? 5 : 11
    const r = f.compact ? 0.13 : 0.065
    f.ctx.lineWidth = strokeWidth(f, 0.012, 0.04)
    line(f, [[0, -0.9], [0, 0.9]], 0.15)
    for (let i = 0; i < n; i++) {
      const y = lerp(-0.8, 0.8, i / (n - 1))
      disc(f, SWINGS[state](i, n, f.t, y), y, r)
    }
  },
}
