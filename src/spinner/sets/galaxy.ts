import { TAU, breath, clamp01, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc, line, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Spiral {
  x?: number
  scale?: number
  arms: number
  /** Radians each arm winds between the core and the rim. */
  twist: number
  rotation: (arm: number) => number
  /** Fraction of each arm shown, from the core outward. */
  reach?: number
  alpha?: number
  scatter?: (arm: number, j: number) => [number, number]
  swell?: (arm: number, j: number) => number
}

/** Large sizes scatter stars along each arm; compact sizes stroke the arm so it still reads as a spiral. */
function spiral(f: Frame, { x = 0, scale = 1, arms, twist, rotation, reach = 1, alpha = 1, scatter, swell }: Spiral) {
  const steps = f.compact ? 8 : 9
  disc(f, x, 0, 0.13 * scale * (f.compact ? 1.6 : 1), alpha)
  for (let arm = 0; arm < arms; arm++) {
    const trail: [number, number][] = [[x, 0]]
    for (let j = 1; j <= steps; j++) {
      const q = j / steps
      const on = clamp01((reach - q) * steps + 1)
      if (on <= 0) continue
      const grow = swell?.(arm, j) ?? 1
      const r = (0.12 + 0.68 * q) * scale * (f.compact ? lerp(1, grow, 0.3) : 1)
      const a = rotation(arm) + (arm * TAU) / arms + q * twist
      const [dx, dy] = scatter?.(arm, j) ?? [0, 0]
      const px = x + Math.cos(a) * r + dx
      const py = Math.sin(a) * r + dy
      if (f.compact) trail.push([px, py])
      else disc(f, px, py, lerp(0.075, 0.035, q) * scale * on * grow, alpha * (1 - 0.55 * q))
    }
    if (f.compact) line(f, trail, alpha)
  }
}

const ARMS = [2, 3, 5]

const SPIRALS: Record<SpinnerState, (t: number) => Spiral[]> = {
  working: (t) => [{ arms: 2, twist: 3, rotation: () => t * 1.2 }],
  searching: (t) => [{ arms: 1, twist: 4.5, rotation: () => t * 2.2 }],
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const loose = 0.8 * (1 - smooth((phase - 0.3) / 0.45))
    return [
      {
        arms: 3,
        twist: 3,
        rotation: () => t * 0.8,
        scatter: (arm, j) => [(hash(index, arm, j) - 0.5) * loose, (hash(index, arm, j, 1) - 0.5) * loose],
      },
    ]
  },
  listening: (t) => [{ arms: 2, twist: 3, rotation: () => t * 0.8, swell: (arm, j) => 0.5 + 1.1 * level(t - j * 0.08, arm) }],
  connecting: (t) => {
    const merge = envelope(cycle(t, 3.4).phase, 0.4, 0.7)
    const apart = 0.45 * (1 - merge)
    const scale = lerp(0.55, 0.85, merge)
    return [
      { x: -apart, scale, arms: 2, twist: 3, rotation: () => t * 1.2 },
      { x: apart, scale, arms: 2, twist: 3, rotation: () => t * 1.2 + Math.PI / 2 },
    ]
  },
  weaving: (t) => [{ arms: 4, twist: 2.5, rotation: (arm) => (arm % 2 ? 1 : -1) * t * 0.9 }],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    return [{ arms: 3, twist: 3, rotation: () => t * 0.9, reach: smooth(phase / 0.7), alpha: 1 - smooth((phase - 0.85) / 0.15) }]
  },
  breathing: (t) => [{ arms: 2, twist: 0.8 + 3.2 * breath(t), rotation: () => t * 0.4 }],
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    return [{ arms: ARMS[index % ARMS.length], twist: 3, rotation: () => t * 0.9, scale: 0.6 + 0.4 * swap, alpha: swap }]
  },
}

export const galaxy: SpinnerSet = {
  id: 'galaxy',
  label: 'Galaxy',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'two spiral arms turn around the core',
    searching: 'a single long arm sweeps like radar',
    solving: 'scattered stars fall into spiral arms',
    listening: 'stars swell outward with the voice',
    connecting: 'two galaxies merge into one',
    weaving: 'alternate arms turn against each other',
    composing: 'arms grow out from the core',
    breathing: 'the arms wind up and unwind',
    shaping: 'two, three, five arms',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.03, 0.09)
    SPIRALS[state](f.t).forEach((s) => spiral(f, s))
  },
}
