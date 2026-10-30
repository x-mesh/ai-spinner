import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { paintField } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Seed = [number, number]

interface Tissue {
  seeds: Seed[]
  /** Wall strength between the cells of seeds i and j; 0 fuses them into one cell. */
  wall?: (i: number, j: number) => number
  gap?: number
  /** Membrane edge along canvas angle a. */
  rim?: (a: number) => number
}

/** Voronoi cells: ink where a pixel sits farther than half the gap from the wall to its second-nearest seed. */
function tissue(f: Frame, { seeds, wall, gap = 0.07, rim = () => 0.92 }: Tissue) {
  const half = (gap * (f.compact ? 1.8 : 1)) / 2
  const soft = f.compact ? 0.04 : 0.02
  paintField(f, (u, v) => {
    const outer = rim(Math.atan2(v, u)) - Math.hypot(u, v)
    if (outer <= 0) return 0
    let d1 = Infinity
    let d2 = Infinity
    let i1 = 0
    let i2 = 0
    for (let i = 0; i < seeds.length; i++) {
      const d = (u - seeds[i][0]) ** 2 + (v - seeds[i][1]) ** 2
      if (d < d1) {
        d2 = d1
        i2 = i1
        d1 = d
        i1 = i
      } else if (d < d2) {
        d2 = d
        i2 = i
      }
    }
    const span = Math.hypot(seeds[i1][0] - seeds[i2][0], seeds[i1][1] - seeds[i2][1])
    const toWall = span > 1e-4 ? (d2 - d1) / (2 * span) : Infinity
    const w = wall?.(i1, i2) ?? 1
    return smooth((toWall - half * w) / soft + 0.5) * smooth((outer - half) / soft + 0.5)
  })
}

/** One seed in the middle, six around it. */
function honeycomb(radius = 0.52, turn = 0): Seed[] {
  return [[0, 0], ...Array.from({ length: 6 }, (_, k): Seed => [Math.cos(turn + (k * TAU) / 6) * radius, Math.sin(turn + (k * TAU) / 6) * radius])]
}

function pair(i: number, j: number, a: number, b: number) {
  return (i === a && j === b) || (i === b && j === a)
}

const TISSUES: Record<SpinnerState, (t: number) => Tissue> = {
  working: (t) => ({
    seeds: honeycomb().map(([x, y], k): Seed => [x + 0.16 * Math.sin(t * 1.3 + k * 2.1), y + 0.16 * Math.cos(t * 1.1 + k * 1.7)]),
  }),
  searching: (t) => ({
    seeds: [...honeycomb(0.6).slice(1), [Math.sin(t * 1.1) * 0.55, Math.sin(t * 2.2) * 0.3]],
  }),
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const tick = Math.floor(t / 0.2)
    return {
      seeds: honeycomb().map(([x, y], k): Seed => [
        lerp(hash(index, k, tick) * 1.4 - 0.7, x, settle),
        lerp(hash(index, k, tick, 1) * 1.4 - 0.7, y, settle),
      ]),
    }
  },
  listening: (t) => ({
    seeds: honeycomb().map(([x, y], k): Seed => {
      const r = 0.6 + 0.6 * level(t, k)
      return [x * r, y * r]
    }),
  }),
  connecting: (t) => {
    const fuse = 1 - envelope(cycle(t, 3.2).phase, 0.4, 0.7)
    return { seeds: honeycomb(), wall: (i, j) => (pair(i, j, 0, 1) || pair(i, j, 0, 4) ? fuse : 1) }
  },
  weaving: (t) => ({
    seeds: [
      ...[0, 1, 2].map((k): Seed => [Math.cos(t * 0.9 + (k * TAU) / 3) * 0.28, Math.sin(t * 0.9 + (k * TAU) / 3) * 0.28]),
      ...[0, 1, 2, 3, 4, 5].map((k): Seed => [Math.cos(-t * 0.6 + (k * TAU) / 6) * 0.68, Math.sin(-t * 0.6 + (k * TAU) / 6) * 0.68]),
    ],
  }),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const split = (k: number) => smooth((phase - k * 0.09) / 0.1) * fade
    return { seeds: honeycomb(), wall: (i, j) => Math.min(split(i), split(j)) }
  },
  breathing: (t) => ({ seeds: honeycomb(0.52, t * 0.2), gap: 0.04 + 0.16 * breath(t) }),
  shaping: (t) => {
    const shape = shapeMorph(t)
    return { seeds: honeycomb(0.45, t * 0.4), rim: (a) => 0.92 * shape(a) }
  },
}

export const cells: SpinnerSet = {
  id: 'cells',
  label: 'Cells',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'cells jostle and reshape their walls',
    searching: 'a wandering cell pushes its neighbors aside',
    solving: 'restless cells settle into a honeycomb',
    listening: 'cells swell outward with the voice',
    connecting: 'three cells fuse into one and split again',
    weaving: 'an inner ring of cells turns against the outer',
    composing: 'one cell divides into seven',
    breathing: 'the walls thicken and thin',
    shaping: 'cells inside a circle, a triangle, a square',
  },
  draw(state, f) {
    tissue(f, TISSUES[state](f.t))
  },
}
