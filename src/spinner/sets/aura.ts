import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Loop {
  r: number
  /** Relative radius change along canvas angle a. */
  wobble: (a: number) => number
  x?: number
  alpha?: number
  shape?: (a: number) => number
}

function loop(f: Frame, { r, wobble, x = 0, alpha = 1, shape = () => 1 }: Loop) {
  if (r <= 0.01 || alpha <= 0.01) return
  const s = space(f)
  const samples = f.compact ? 36 : 96
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * TAU
    const rr = r * shape(a) * (1 + wobble(a))
    f.ctx.lineTo(s.x(x + Math.cos(a) * rr), s.y(Math.sin(a) * rr))
  }
  f.ctx.closePath()
  f.ctx.stroke()
}

/** Outer loops are fainter, so the layers read as a glow around a core. */
const LAYERS = [
  { r: 0.52, alpha: 1 },
  { r: 0.64, alpha: 0.6 },
  { r: 0.76, alpha: 0.32 },
]

const AURAS: Record<SpinnerState, (t: number) => Loop[]> = {
  working: (t) => LAYERS.map(({ r, alpha }, k) => ({ r, alpha, wobble: (a) => 0.08 * Math.sin(3 * a + t * 2 + k) + 0.05 * Math.sin(5 * a - t * 3 + k * 2) })),
  searching: (t) => LAYERS.map(({ r, alpha }, k) => ({ r, alpha, wobble: (a) => 0.28 * Math.max(0, Math.cos(a - t * 1.5 + k * 0.25)) ** 3 })),
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const wild = 0.22 * (1 - smooth((phase - 0.3) / 0.45))
    return LAYERS.map(({ r, alpha }, k) => {
      const n = 2 + Math.floor(hash(index, k) * 5)
      return { r, alpha, wobble: (a) => wild * Math.sin(n * a + t * 4 + hash(index, k, 1) * 6) }
    })
  },
  listening: (t) => LAYERS.map(({ r, alpha }, k) => ({ r, alpha, wobble: (a) => (0.02 + 0.18 * level(t, k)) * Math.sin(4 * a + t * 3 + k) })),
  connecting: (t) => {
    const c = lerp(0.42, 0, envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return [-c, c].flatMap((x, side) =>
      LAYERS.slice(0, 2).map(({ r, alpha }, k) => ({ x, r: r * 0.7, alpha, wobble: (a: number) => 0.06 * Math.sin(3 * a + t * 2 * (side ? -1 : 1) + k) })),
    )
  },
  weaving: (t) => [
    { r: 0.6, wobble: (a) => 0.12 * Math.sin(3 * a + t * 2) },
    { r: 0.6, alpha: 0.6, wobble: (a) => 0.12 * Math.sin(4 * a - t * 2) },
  ],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return LAYERS.map(({ r, alpha }, k) => ({ r: r * smooth((phase - k * 0.15) / 0.25), alpha: alpha * fade, wobble: (a) => 0.06 * Math.sin(3 * a + t * 2 + k) }))
  },
  breathing: (t) => LAYERS.map(({ r, alpha }, k) => ({ r: r * (0.65 + 0.35 * breath(t - k * 0.25)), alpha, wobble: (a) => 0.03 * Math.sin(3 * a + t + k) })),
  shaping: (t) => {
    const shape = shapeMorph(t)
    return LAYERS.map(({ r, alpha }, k) => ({ r, alpha, shape, wobble: (a) => 0.04 * Math.sin(5 * a + t * 3 + k) }))
  },
}

export const aura: SpinnerSet = {
  id: 'aura',
  label: 'Aura',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'layered rings ripple around a core',
    searching: 'a bulge circles the rings',
    solving: 'restless rings smooth into circles',
    listening: 'the rings ripple with the voice',
    connecting: 'two auras slide into one',
    weaving: 'three- and four-lobed rings turn through each other',
    composing: 'rings bloom outward one by one',
    breathing: 'the rings swell in a slow wave',
    shaping: 'an aura in a circle, a triangle, a square',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.025, 0.07)
    AURAS[state](f.t).forEach((l) => loop(f, l))
  },
}
