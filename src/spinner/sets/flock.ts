import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const TRAIL = 6
const TRAIL_STEP = 0.06

/** Position of firefly k (of n) at time t, plus an optional glow multiplier. */
type Path = (k: number, n: number, t: number) => [x: number, y: number, glow?: number]

function lemniscate(s: number): [number, number] {
  const d = 1 + Math.sin(s) ** 2
  return [(Math.cos(s) / d) * 0.85, ((Math.sin(s) * Math.cos(s)) / d) * 1.2]
}

/** Each firefly is drawn with a fading tail sampled from its own past positions. */
function fireflies(f: Frame, path: Path) {
  const n = f.compact ? 4 : 12
  const size = f.compact ? 0.2 : 0.055
  for (let k = 0; k < n; k++) {
    for (let j = TRAIL - 1; j >= 0; j--) {
      const [x, y, glow = 1] = path(k, n, f.t - j * TRAIL_STEP)
      const fade = 1 - j / TRAIL
      disc(f, x, y, size * (0.4 + 0.6 * fade) * (0.7 + 0.3 * glow), fade ** 1.5 * glow)
    }
  }
}

const FLOCKS: Record<SpinnerState, Path> = {
  working: (k, _, t) => {
    const a = t * (0.9 + 0.4 * hash(k)) + hash(k, 1) * TAU
    const r = 0.45 + 0.3 * Math.sin(t * 1.3 + k * 1.7)
    return [Math.cos(a) * r, Math.sin(a) * r * 0.8]
  },
  searching: (k, _, t) => {
    const lag = t - k * 0.09
    return [0.7 * Math.sin(lag * 1.1) + Math.sin(k * 2.3 + t) * 0.05, 0.5 * Math.sin(lag * 1.9) + Math.cos(k * 1.7 + t) * 0.05]
  },
  solving: (k, n, t) => {
    const { phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.35) / 0.4)
    const wander: [number, number] = [
      Math.sin(t * (1.2 + hash(k, 1)) + hash(k, 2) * TAU) * 0.75,
      Math.cos(t * (1 + hash(k, 3)) + hash(k, 4) * TAU) * 0.75,
    ]
    const a = (k / n) * TAU + t * 1.2
    return [lerp(wander[0], Math.cos(a) * 0.5, settle), lerp(wander[1], Math.sin(a) * 0.5, settle)]
  },
  listening: (k, n, t) => {
    const a = (k / n) * TAU + t * 0.2
    const bob = Math.sin(t * 2 + k) * 0.05
    return [Math.cos(a) * 0.55, Math.sin(a) * 0.55 + bob, 0.25 + 0.75 * level(t, k)]
  },
  connecting: (k, _, t) => {
    const join = envelope(cycle(t, 3.4).phase, 0.35, 0.65)
    const group = k % 2 ? 1 : -1
    const a = t * 2 * group + k
    const r = 0.28 + 0.25 * join
    return [group * 0.5 * (1 - join) + Math.cos(a) * r, Math.sin(a) * r]
  },
  weaving: (k, n, t) => {
    const direction = k % 2 ? 1 : -1
    return lemniscate(t * 1.1 * direction + (k / n) * TAU)
  },
  composing: (k, n, t) => {
    const { index, phase } = cycle(t, 3.6)
    const arrive = smooth((phase - (k / n) * 0.45) / 0.2)
    const leave = smooth((phase - 0.85) / 0.15)
    const a = hash(index, k) * TAU
    const home: [number, number] = [lerp(-0.75, 0.75, k / (n - 1)), Math.sin(k * 1.3 + t * 2) * 0.06]
    const away: [number, number] = [Math.cos(a) * 1.4, Math.sin(a) * 1.4]
    const p = arrive * (1 - leave)
    return [lerp(away[0], home[0], p), lerp(away[1], home[1], p)]
  },
  breathing: (k, n, t) => {
    const a = (k / n) * TAU + t * 0.3
    const r = 0.3 + 0.45 * breath(t) + Math.sin(t * 2 + k * 2.1) * 0.03
    return [Math.cos(a) * r, Math.sin(a) * r]
  },
  shaping: (k, n, t) => {
    const radius = shapeMorph(t)
    const a = (k / n) * TAU + t * 0.4
    const r = 0.75 * radius(a)
    return [Math.cos(a) * r, Math.sin(a) * r]
  },
}

export const flock: SpinnerSet = {
  id: 'flock',
  label: 'Flock',
  icon: { state: 'working', t: 0.4 },
  blurbs: {
    working: 'fireflies circle on restless orbits',
    searching: 'the swarm follows its leader',
    solving: 'wanderers fall into a ring formation',
    listening: 'fireflies glow with the voice',
    connecting: 'two swarms merge and split again',
    weaving: 'two streams cross in a figure eight',
    composing: 'fireflies fly in and line up',
    breathing: 'the ring of lights widens and closes',
    shaping: 'the swarm flies in formation',
  },
  draw: (state, f) => fireflies(f, FLOCKS[state]),
}
