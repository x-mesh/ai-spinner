import { TAU, breath, clamp01, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc, line, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Helix {
  /** Strand radius at height y. */
  radius: (y: number) => number
  spin: number
  strands?: number
  /** Opacity of base pair k; 0 leaves the strands unpaired. */
  pairs?: (k: number) => number
  /** Sideways pull on each strand, for unzipping. */
  apart?: number
  /** Fraction built, bottom up. */
  progress?: number
  /** Extra size for the bead at height y. */
  glow?: (y: number) => number
}

const TWIST = 4
const TOP = -0.8
const BOTTOM = 0.8

/** Ball-and-stick double helix: rungs first, then beads back to front sized by depth. */
function strands(f: Frame, { radius, spin, strands: count = 2, pairs = () => 1, apart = 0, progress = 1, glow = () => 0 }: Helix) {
  const n = f.compact ? 10 : 22
  const shown = Math.round(n * progress)
  const beads: { x: number; y: number; z: number; g: number }[] = []
  for (let k = 0; k < shown; k++) {
    const y = lerp(BOTTOM, TOP, k / (n - 1))
    const r = radius(y)
    const ends = Array.from({ length: count }, (_, j) => {
      const a = y * TWIST + spin + (j * TAU) / count
      const side = count === 2 ? (j ? 1 : -1) * apart : 0
      return { x: Math.cos(a) * r + side, y, z: Math.sin(a), g: glow(y) }
    })
    if (count === 2 && k % 2 === 0) {
      const a = pairs(k)
      if (a > 0.01) line(f, [[ends[0].x, y], [ends[1].x, y]], 0.45 * a)
    }
    beads.push(...ends)
  }
  beads
    .sort((a, b) => a.z - b.z)
    .forEach(({ x, y, z, g }) => {
      const near = clamp01(0.5 + z / 2)
      disc(f, x, y, (f.compact ? 0.1 : 0.05) * (0.6 + 0.6 * near + g), 0.3 + 0.7 * near)
    })
}

const PROFILES: ((y: number) => number)[] = [() => 0.35, (y) => 0.42 * (1 - Math.abs(y) / 0.9) + 0.04, (y) => 0.08 + 0.4 * Math.abs(y)]

const HELICES: Record<SpinnerState, (t: number) => Helix> = {
  working: (t) => ({ radius: () => 0.35, spin: t * 2 }),
  searching: (t) => {
    const at = Math.sin(t * 1.5) * 0.7
    return { radius: () => 0.35, spin: t * 1.2, glow: (y) => 0.9 * Math.exp(-((y - at) ** 2) * 30) }
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.2) / 0.6)
    return { radius: () => 0.35, spin: t * 1.5, pairs: (k) => smooth((settle - hash(index, k)) / 0.1) }
  },
  listening: (t) => ({ radius: (y) => 0.15 + 0.3 * level(t, Math.round((y + 1) * 2)), spin: t * 1.5 }),
  connecting: (t) => {
    const zip = envelope(cycle(t, 3.4).phase, 0.4, 0.7)
    return { radius: () => 0.3, spin: t * 1.2, apart: 0.3 * (1 - zip), pairs: () => smooth((zip - 0.7) / 0.3) }
  },
  weaving: (t) => ({ radius: () => 0.35, spin: t * 1.6, strands: 3 }),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    return { radius: () => 0.35, spin: t * 1.5, progress: smooth(phase / 0.75) * (1 - smooth((phase - 0.88) / 0.12)) }
  },
  breathing: (t) => ({ radius: () => 0.18 + 0.22 * breath(t), spin: t * 0.6 }),
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    return { radius: (y) => lerp(PROFILES[index % 3](y), PROFILES[(index + 1) % 3](y), blend), spin: t * 1.5 }
  },
}

export const helix: SpinnerSet = {
  id: 'helix',
  label: 'Helix',
  icon: { state: 'working', t: 0.4 },
  blurbs: {
    working: 'a double helix turns',
    searching: 'a glow travels up and down the strands',
    solving: 'loose bases pair up one by one',
    listening: 'the helix swells with the voice',
    connecting: 'the strands unzip and zip back up',
    weaving: 'three strands twist together',
    composing: 'the helix builds from the bottom up',
    breathing: 'the coil widens and tightens',
    shaping: 'a column, a spindle, an hourglass',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.02, 0.06)
    strands(f, HELICES[state](f.t))
  },
}
