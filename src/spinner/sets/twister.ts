import { TAU, breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Funnel {
  /** Ring radius at height s (0 bottom, 1 top). */
  radius: (s: number, k: number) => number
  /** Sideways offset of ring k at height s. */
  offset?: (s: number, k: number) => number
  x?: number
  scale?: number
  spin: number
  /** Fraction of rings shown, bottom up. */
  rings?: number
  alpha?: number
}

/** Stacked flattened rings, far halves faint, each carrying a bit of debris around. */
function funnel(f: Frame, { radius, offset = () => 0, x = 0, scale = 1, spin, rings = 1, alpha = 1 }: Funnel) {
  const s = space(f)
  const n = f.compact ? 5 : 9
  for (let k = 0; k < Math.round(n * rings); k++) {
    const h = k / (n - 1)
    const cx = x + offset(h, k) * scale
    const cy = lerp(0.75, -0.7, h) * scale
    const rx = radius(h, k) * scale
    const ry = rx * 0.28
    for (const [from, to, a] of [[Math.PI, TAU, 0.3], [0, Math.PI, 1]] as const) {
      f.ctx.globalAlpha = alpha * a
      f.ctx.beginPath()
      f.ctx.ellipse(s.x(cx), s.y(cy), s.len(rx), s.len(ry), 0, from, to)
      f.ctx.stroke()
    }
    const a = spin + k * 0.9
    disc(f, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, f.compact ? 0.08 : 0.035, alpha * (Math.sin(a) > 0 ? 1 : 0.35))
  }
}

const FUNNEL = (h: number) => 0.08 + 0.55 * h ** 1.4
const PROFILES: ((h: number) => number)[] = [FUNNEL, (h) => 0.12 + 0.5 * Math.abs(h * 2 - 1), () => 0.38]

const TWISTERS: Record<SpinnerState, (t: number) => Funnel[]> = {
  working: (t) => [{ radius: FUNNEL, offset: (h) => 0.12 * Math.sin(h * 4 - t * 2) * h, spin: t * 4 }],
  searching: (t) => [{ radius: FUNNEL, offset: (h) => Math.sin(t * 1.1 - h * 0.8) * 0.35, spin: t * 4 }],
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const loose = 1 - smooth((phase - 0.3) / 0.45)
    return [
      {
        radius: (h, k) => FUNNEL(h) * (1 + loose * (hash(index, k) - 0.5)),
        offset: (_, k) => loose * (hash(index, k, 1) - 0.5) * 0.6,
        spin: t * 4,
      },
    ]
  },
  listening: (t) => [{ radius: (h, k) => FUNNEL(h) * (0.7 + 0.55 * level(t, k)), spin: t * 4 }],
  connecting: (t) => {
    const c = lerp(0.42, 0, envelope(cycle(t, 3.4).phase, 0.4, 0.7))
    return [-c, c].map((x, side) => ({ radius: FUNNEL, x, scale: lerp(1, 0.7, c / 0.42), spin: t * 4 + side * Math.PI }))
  },
  weaving: (t) => [{ radius: FUNNEL, offset: (_, k) => (k % 2 ? 1 : -1) * 0.15 * Math.sin(t * 3), spin: t * 4 }],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    return [{ radius: FUNNEL, spin: t * 4, rings: smooth(phase / 0.7), alpha: 1 - smooth((phase - 0.85) / 0.15) }]
  },
  breathing: (t) => [{ radius: (h) => FUNNEL(h) * (0.6 + 0.45 * breath(t)), spin: t * 2 }],
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    return [{ radius: (h) => lerp(PROFILES[index % 3](h), PROFILES[(index + 1) % 3](h), blend), spin: t * 4 }]
  },
}

export const twister: SpinnerSet = {
  id: 'twister',
  label: 'Twister',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'a funnel spins and snakes',
    searching: 'the twister roams side to side',
    solving: 'loose rings spin up into a funnel',
    listening: 'the rings widen with the voice',
    connecting: 'two small twisters merge into one',
    weaving: 'alternate rings wobble against each other',
    composing: 'the funnel builds from the ground up',
    breathing: 'the funnel widens and narrows',
    shaping: 'a funnel, an hourglass, a column',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.022, 0.065)
    TWISTERS[state](f.t).forEach((spec) => funnel(f, spec))
  },
}
