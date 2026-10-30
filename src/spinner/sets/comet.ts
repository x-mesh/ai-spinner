import { TAU, breath, cycle, envelope, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]
type Path = (t: number) => Point

interface Tail {
  path: Path
  /** Seconds of history the tail shows. */
  span?: number
  /** Opacity at a past time; lets a tail end where its cycle restarted. */
  alpha?: (t: number) => number
}

function orbit(r: number, speed: number, cx = 0, offset = 0): Path {
  return (t) => [cx + Math.cos(t * speed + offset) * r, Math.sin(t * speed + offset) * r]
}

function streak(f: Frame, { path, span = 1.1, alpha = () => 1 }: Tail) {
  const steps = f.compact ? 28 : 64
  const head = f.compact ? 0.3 : 0.12
  // Dense faint discs blend into a smooth fade; stroked segments either bead at joints or leave wedge gaps.
  for (let k = steps; k > 0; k--) {
    const q = 1 - k / steps
    const from = f.t - (k * span) / steps
    disc(f, ...path(from), head * (0.15 + 0.85 * q), 0.18 * q * alpha(from))
  }
  disc(f, ...path(f.t), head, alpha(f.t))
}

const TAILS: Record<SpinnerState, (t: number) => Tail[]> = {
  working: () => [{ path: orbit(0.6, 2.4) }],
  searching: () => [{ path: (t) => [0.65 * Math.sin(t * 1.3), 0.4 * Math.sin(t * 2.6)], span: 1 }],
  solving: () => [
    {
      path: (t) => {
        const calm = envelope(cycle(t, 3.6).phase, 0.45, 0.8)
        const wild: Point = [0.65 * Math.sin(t * 3.1) * Math.cos(t * 1.7), 0.65 * Math.sin(t * 2.3 + 1) * Math.cos(t * 1.1)]
        const [ox, oy] = orbit(0.55, 2)(t)
        return [lerp(wild[0], ox, calm), lerp(wild[1], oy, calm)]
      },
    },
  ],
  listening: () => [
    {
      path: (t) => {
        const r = 0.25 + 0.45 * level(t, 0)
        return [Math.cos(t * 2.4) * r, Math.sin(t * 2.4) * r]
      },
    },
  ],
  connecting: () => {
    const apart = (t: number) => 0.42 * (1 - envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return [0, 1].map((k) => ({
      path: (t: number): Point => {
        const [x, y] = orbit(0.32, 2.4, 0, k * Math.PI)(t)
        return [x + (k ? apart(t) : -apart(t)), y]
      },
    }))
  },
  weaving: () =>
    [0, 1, 2].map((k) => ({
      path: (t: number): Point => {
        const tilt = (k * TAU) / 3
        const a = t * 2 + tilt
        const [ex, ey] = [0.7 * Math.cos(a), 0.25 * Math.sin(a)]
        return [ex * Math.cos(tilt) - ey * Math.sin(tilt), ex * Math.sin(tilt) + ey * Math.cos(tilt)]
      },
      span: 0.6,
    })),
  composing: (t) => {
    const { index } = cycle(t, 3.6)
    return [
      {
        path: (time) => {
          const { phase } = cycle(time, 3.6)
          const r = 0.08 + 0.65 * smooth(phase / 0.85)
          const a = phase * TAU * 2.2 - Math.PI / 2
          return [Math.cos(a) * r, Math.sin(a) * r]
        },
        span: 1.2,
        alpha: (time) => {
          const c = cycle(time, 3.6)
          return c.index === index ? 1 - smooth((c.phase - 0.85) / 0.15) : 0
        },
      },
    ]
  },
  breathing: () => [
    {
      path: (t) => {
        const r = 0.15 + 0.5 * breath(t)
        return [Math.cos(t * 1.4) * r, Math.sin(t * 1.4) * r]
      },
      span: 1.4,
    },
  ],
  shaping: () => [
    {
      path: (t) => {
        const a = t * 4.5
        const r = 0.65 * shapeMorph(t)(a)
        return [Math.cos(a) * r, Math.sin(a) * r]
      },
      span: 1.1,
    },
  ],
}

export const comet: SpinnerSet = {
  id: 'comet',
  label: 'Comet',
  icon: { state: 'shaping', t: 1.4 },
  blurbs: {
    working: 'a comet circles with a fading tail',
    searching: 'a comet traces a figure eight',
    solving: 'a wild streak calms into an orbit',
    listening: 'the orbit widens with the voice',
    connecting: 'two orbits drift into one',
    weaving: 'three comets trace an atom',
    composing: 'a comet spirals out from the center',
    breathing: 'a slow orbit swells and shrinks',
    shaping: 'the tail traces a circle, a triangle, a square',
  },
  draw(state, f) {
    TAILS[state](f.t).forEach((tail) => streak(f, tail))
  },
}
