import { breath, cycle, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const DISC_RADIUS = 0.8

interface Grain {
  k: number
  /** Resting place inside the disc. */
  x: number
  y: number
  r: number
  a: number
}

/** Returns where grain `g` is now and how visible it is. */
type Motion = (g: Grain) => [x: number, y: number, alpha?: number]

function grains(f: Frame, motion: Motion) {
  const count = f.compact ? 36 : 150
  const size = f.compact ? 0.065 : 0.03
  for (let k = 0; k < count; k++) {
    const r = Math.sqrt((k + 0.5) / count) * DISC_RADIUS
    const a = k * GOLDEN
    const [x, y, alpha = 1] = motion({ k, x: Math.cos(a) * r, y: Math.sin(a) * r, r, a })
    if (alpha > 0.01) disc(f, x, y, size, alpha)
  }
}

const DUSTS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) =>
    grains(f, (g) => {
      const life = (f.t * 0.4 + hash(g.k)) % 1
      const d = (g.r / DISC_RADIUS) ** 3 * Math.max(0, Math.sin(life * Math.PI * 2)) ** 2 * 0.55
      return [g.x + d * 0.9, g.y - d * 0.5 + Math.sin(f.t * 3 + g.k) * d * 0.2, 1 - d]
    }),
  searching: (f) => {
    const sweep = Math.sin(f.t * 1.2) * 0.9
    grains(f, (g) => {
      const hit = Math.exp(-(((g.x - sweep) / 0.18) ** 2))
      return [g.x + hit * 0.08 * Math.cos(g.k), g.y - hit * 0.35, 0.55 + 0.45 * hit]
    })
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.4)
    const fade = 1 - smooth((phase - 0.9) / 0.1)
    grains(f, (g) => {
      const p = smooth((phase - 0.1 - hash(g.k, 7) * 0.35) / 0.35)
      return [lerp(hash(index, g.k, 1) * 2.2 - 1.1, g.x, p), lerp(hash(index, g.k, 2) * 2.2 - 1.1, g.y, p), fade]
    })
  },
  listening: (f) =>
    grains(f, (g) => {
      const push = 1 + 0.35 * level(f.t - g.r * 0.8, 0)
      return [g.x * push, g.y * push]
    }),
  connecting: (f) => {
    const { index, phase } = cycle(f.t, 3.2)
    const direction = index % 2 ? -1 : 1
    grains(f, (g) => {
      const q = smooth((phase - hash(g.k, 3) * 0.4) / 0.45)
      const x = lerp(-0.5 * direction, 0.5 * direction, q) + g.x * 0.5
      return [x, g.y * 0.5 - Math.sin(q * Math.PI) * 0.45]
    })
  },
  weaving: (f) =>
    grains(f, (g) => {
      const twist = Math.sin(f.t * 1.4) * 1.6 * (1 - g.r / DISC_RADIUS)
      return [Math.cos(g.a + twist) * g.r, Math.sin(g.a + twist) * g.r]
    }),
  composing: (f) => {
    const { phase } = cycle(f.t, 3.8)
    const scan = lerp(0.95, -0.95, smooth(phase / 0.6))
    const drift = smooth((phase - 0.8) / 0.2)
    grains(f, (g) => {
      const shown = smooth((g.y - scan) / 0.15)
      const lift = drift * (0.5 + hash(g.k, 5)) * 0.8
      return [g.x + lift * 0.3, g.y - lift, shown * (1 - drift)]
    })
  },
  breathing: (f) => {
    const scale = 0.75 + 0.3 * breath(f.t)
    grains(f, (g) => [g.x * scale, g.y * scale])
  },
  shaping: (f) => {
    const radius = shapeMorph(f.t)
    grains(f, (g) => {
      const rr = g.r * radius(g.a) * 1.05
      return [Math.cos(g.a) * rr, Math.sin(g.a) * rr]
    })
  },
}

export const dust: SpinnerSet = {
  id: 'dust',
  label: 'Dust',
  icon: { state: 'weaving', t: 0.9 },
  blurbs: {
    working: 'grains flake off the edge and settle back',
    searching: 'a gust sweeps across, lifting grains',
    solving: 'scattered dust gathers into a disc',
    listening: 'the disc puffs out with the voice',
    connecting: 'a cloud of dust hops to the other side',
    weaving: 'the disc twists like a whirlpool',
    composing: 'the disc builds from the bottom, then blows away',
    breathing: 'the dust cloud expands and contracts',
    shaping: 'dust packs into circle, triangle, square',
  },
  draw: (state, f) => DUSTS[state](f),
}
