import { TAU, breath, cycle, hash, lerp, level, smooth } from '../math.js'
import { disc } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

interface Seeds {
  /** Turn between consecutive seeds; the golden angle packs them without gaps. */
  angle?: number
  spin?: (k: number) => number
  scale?: number
  size?: (k: number, r: number) => number
  alpha?: (k: number, r: number) => number
  /** Fractional index shift; animating it streams seeds outward seamlessly. */
  shift?: number
  /** Seeds with index at or above this are hidden. */
  limit?: number
}

function seeds(f: Frame, { angle = GOLDEN, spin = () => 0, scale = 1, size, alpha, shift = 0, limit = Infinity }: Seeds) {
  const count = f.compact ? 24 : 90
  const step = (0.95 / Math.sqrt(count)) * scale
  const base = f.compact ? 0.1 : 0.032
  const growth = f.compact ? 0.05 : 0.04
  for (let k = 0; k < Math.min(count, limit); k++) {
    const kk = k + shift
    const r = step * Math.sqrt(kk)
    if (r > 1.05) continue
    const a = kk * angle + spin(k)
    const appear = Math.min(1, kk)
    const radius = (base + growth * r) * (size?.(k, r) ?? 1) * appear
    disc(f, Math.cos(a) * r, Math.sin(a) * r, radius, (alpha?.(k, r) ?? 1) * appear)
  }
}

const ARMS = [3, 4, 5, 6]

const BLOOMS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) =>
    seeds(f, { spin: () => f.t * 0.5, alpha: (_, r) => 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(r * 9 - f.t * 4)) }),
  searching: (f) => seeds(f, { angle: GOLDEN + 0.012 * Math.sin(f.t * 0.7), spin: () => f.t * 0.2 }),
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    seeds(f, { angle: GOLDEN + (1 - settle) * (hash(index) * 0.6 + 0.2), spin: () => f.t * 0.3 })
  },
  listening: (f) => seeds(f, { size: (_, r) => 0.6 + 0.9 * level(f.t - r * 1.2, 0) }),
  connecting: (f) => {
    const { phase } = cycle(f.t, 3.4)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    seeds(f, { limit: Math.ceil(smooth(phase / 0.65) * 90), alpha: () => fade, spin: () => f.t * 0.2 })
  },
  weaving: (f) => seeds(f, { spin: (k) => (k % 2 ? 1 : -1) * f.t * 0.6, alpha: (k) => (k % 2 ? 1 : 0.55) }),
  composing: (f) => seeds(f, { shift: (f.t * 5) % 1, spin: () => Math.floor(f.t * 5) * GOLDEN }),
  breathing: (f) => seeds(f, { scale: 0.7 + 0.35 * breath(f.t), spin: () => f.t * 0.1 }),
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 2)
    const blend = smooth((phase - 0.55) / 0.45)
    const from = TAU / ARMS[index % ARMS.length]
    const to = TAU / ARMS[(index + 1) % ARMS.length]
    seeds(f, { angle: lerp(from, to, blend) + 0.004, spin: () => f.t * 0.2 })
  },
}

export const bloom: SpinnerSet = {
  id: 'bloom',
  label: 'Bloom',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'a sunflower head turns while light ripples out',
    searching: 'spiral arms drift in and out of focus',
    solving: 'a jumble snaps into the golden spiral',
    listening: 'seeds swell from the center with the voice',
    connecting: 'seeds fill in from the center',
    weaving: 'alternate seeds turn against each other',
    composing: 'new seeds stream out from the core',
    breathing: 'the seed head opens and closes',
    shaping: 'three, four, five, six straight arms',
  },
  draw: (state, f) => BLOOMS[state](f),
}
