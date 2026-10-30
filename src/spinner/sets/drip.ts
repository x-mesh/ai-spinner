import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { paintField } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Ball = [x: number, y: number, r: number]

interface Scene {
  balls: Ball[]
  /** Thickness of the liquid clinging to the top of the vessel. */
  ceiling?: number
  /** Depth of the pool at the bottom. */
  floor?: number
}

const RIM = 0.95

/** Metaballs plus two horizontal line sources, so drops neck off the ceiling and merge into the pool. */
function pour(f: Frame, { balls, ceiling = 0.28, floor = 0.22 }: Scene) {
  paintField(f, (u, v) => {
    const inside = RIM - Math.hypot(u, v)
    if (inside <= 0) return 0
    let field = (ceiling * ceiling) / ((v + RIM) ** 2 + 1e-4) + (floor * floor) / ((v - RIM) ** 2 + 1e-4)
    for (const [x, y, r] of balls) field += (r * r) / ((u - x) ** 2 + (v - y) ** 2 + 1e-6)
    return smooth((field - 0.85) / 0.3) * smooth(inside / 0.03)
  })
}

/** A drop at life p (0..1): it swells on the ceiling, necks off, then falls into the pool. */
function drop(x: number, p: number): Ball[] {
  if (p < 0 || p >= 1) return []
  if (p < 0.45) {
    const g = p / 0.45
    return [[x, -0.62 + g * 0.1, 0.06 + 0.1 * g]]
  }
  const q = (p - 0.45) / 0.55
  const y = lerp(-0.5, 0.75, q * q)
  return [[x, y, 0.15], [x, y - 0.14, 0.07 * (1 - smooth(q / 0.3))]]
}

const COUNTS = [1, 2, 3]

const SCENES: Record<SpinnerState, (t: number) => Scene> = {
  working: (t) => {
    const { index } = cycle(t, 0.9)
    const balls = [index - 1, index].flatMap((k) => drop((hash(k) - 0.5) * 0.8, (t - k * 0.9) / 1.6))
    return { balls }
  },
  searching: (t) => ({ balls: [[Math.sin(t * 1.4) * 0.55, -0.56, 0.15]] }),
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return {
      balls: [0, 1, 2, 3, 4].map((k): Ball => [
        lerp(hash(index, k) * 1 - 0.5, 0, settle) + 0.05 * Math.sin(t * 3 + k),
        lerp(hash(index, k, 1) * 0.8 - 0.4, 0, settle),
        0.11,
      ]),
    }
  },
  listening: (t) => ({
    balls: [-0.42, 0, 0.42].map((x, k): Ball => [x, -0.62 + 0.3 * level(t, k), 0.09 + 0.05 * level(t, k)]),
  }),
  connecting: (t) => {
    const e = envelope(cycle(t, 3.2).phase, 0.4, 0.7)
    return { balls: [[0, lerp(-0.62, -0.13, e), 0.15], [0, lerp(0.64, 0.13, e), 0.15]] }
  },
  weaving: (t) => ({
    balls: [-0.3, 0.3].flatMap((x, side) => drop(x, cycle(t + side * 0.8, 1.6).phase)),
  }),
  composing: (t) => {
    const { phase } = cycle(t, 4)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    let landed = 0
    const balls: Ball[] = []
    for (let k = 0; k < 4; k++) {
      const p = (phase - k * 0.18) / 0.3
      if (p >= 1) landed++
      balls.push(...drop(0, p))
    }
    return { balls, floor: (0.1 + 0.07 * landed) * fade + 0.04 }
  },
  breathing: (t) => {
    const b = breath(t)
    return { balls: [[0, -0.6 + 0.12 * b, 0.08 + 0.1 * b]] }
  },
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    const n = COUNTS[index % COUNTS.length]
    return {
      balls: Array.from({ length: n }, (_, k): Ball => [n === 1 ? 0 : lerp(-0.4, 0.4, k / (n - 1)), -0.55, 0.14 * swap]),
    }
  },
}

export const drip: SpinnerSet = {
  id: 'drip',
  label: 'Drip',
  icon: { state: 'working', t: 1.2 },
  blurbs: {
    working: 'drops neck off the top and fall into the pool',
    searching: 'a hanging bead slides along the surface',
    solving: 'stray droplets gather into one',
    listening: 'hanging drops stretch with the voice',
    connecting: 'a drip and a splash reach for each other',
    weaving: 'drips fall left and right in turn',
    composing: 'drops fall and fill the pool',
    breathing: 'a hanging drop swells but never falls',
    shaping: 'one, two, three hanging drops',
  },
  draw(state, f) {
    pour(f, SCENES[state](f.t))
  },
}
