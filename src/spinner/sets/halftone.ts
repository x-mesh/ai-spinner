import { breath, clamp01, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc } from '../space.js'
import type { SpinnerSet, SpinnerState } from '../types.js'

/** Ink density 0..1 at (u, v) in unit space. */
type Field = (u: number, v: number) => number

const SPAN = 0.9

function gaussian(u: number, v: number, x: number, y: number, spread: number) {
  return Math.exp(-((u - x) ** 2 + (v - y) ** 2) / spread)
}

const FIELDS: Record<SpinnerState, (t: number) => Field> = {
  working: (t) => (u, v) => 0.5 + 0.5 * Math.sin(u * 3 + t * 1.5) * Math.cos(v * 3 - t * 1.1),
  searching: (t) => {
    const x = Math.cos(t * 1.3) * 0.5
    const y = Math.sin(t * 1.7) * 0.4
    return (u, v) => gaussian(u, v, x, y, 0.15)
  },
  solving: (t) => {
    const { phase } = cycle(t, 3)
    const settle = smooth((phase - 0.3) / 0.45)
    const tick = Math.floor(t / 0.1)
    return (u, v) => lerp(hash(tick, Math.round(u * 10), Math.round(v * 10)), 1 - Math.hypot(u, v) / 1.2, settle)
  },
  listening: (t) => {
    const v0 = level(t, 0)
    return (u, v) => 0.5 + 0.5 * Math.sin(Math.hypot(u, v) * 9 - t * 5) * (0.2 + 0.8 * v0)
  },
  connecting: (t) => {
    const x = 0.55 * (1 - envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return (u, v) => gaussian(u, v, -x, 0, 0.12) + gaussian(u, v, x, 0, 0.12)
  },
  weaving: (t) => (u, v) => 0.5 + 0.5 * Math.sin((u + v) * 3 + t * 2) * Math.sin((u - v) * 3 - t * 2),
  composing: (t) => {
    const { phase } = cycle(t, 3.4)
    const wipe = lerp(-2.2, 2.2, smooth(phase / 0.7))
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return (u, v) => smooth((wipe - (u + v)) / 0.5) * fade
  },
  breathing: (t) => {
    const reach = 0.5 + 0.7 * breath(t)
    return (u, v) => 1 - Math.hypot(u, v) / reach
  },
  shaping: (t) => {
    const radius = shapeMorph(t)
    return (u, v) => {
      const d = Math.hypot(u, v) - 0.8 * radius(Math.atan2(v, u))
      return 1 - smooth((d + 0.05) / 0.2)
    }
  },
}

export const halftone: SpinnerSet = {
  id: 'halftone',
  label: 'Halftone',
  icon: { state: 'working', t: 0.4 },
  blurbs: {
    working: 'a plasma pattern in printer dots',
    searching: 'a spotlight roams the screen',
    solving: 'static noise prints into a clean gradient',
    listening: 'ripples print outward with the voice',
    connecting: 'two blobs of ink merge and part',
    weaving: 'a diagonal weave pattern shifts',
    composing: 'ink wipes on diagonally, then lifts',
    breathing: 'a soft vignette swells and shrinks',
    shaping: 'circle, triangle, square in halftone',
  },
  draw(state, f) {
    const n = f.compact ? 5 : 11
    const pitch = (SPAN * 2) / (n - 1)
    const field = FIELDS[state](f.t)
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const u = -SPAN + col * pitch
        const v = -SPAN + row * pitch
        const r = pitch * 0.58 * clamp01(field(u, v))
        if (r > 0.004) disc(f, u, v, r)
      }
    }
  },
}
