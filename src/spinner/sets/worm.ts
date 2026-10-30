import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

/** Body position at u: 0 is the head, 1 the tip of the tail. */
type Body = (u: number) => Point

/** Draws tail first so the head overlaps the body; `length` < 1 hides the rear. */
function crawl(f: Frame, body: Body, length = 1, thickness: (u: number) => number = () => 1) {
  const segments = f.compact ? 6 : 14
  const scale = f.compact ? 1.6 : 1
  const shown = Math.ceil(segments * length)
  for (let j = shown - 1; j >= 0; j--) {
    const u = j / (segments - 1)
    const [x, y] = body(u)
    disc(f, x, y, lerp(0.12, 0.05, u) * scale * thickness(u))
  }
}

function lemniscate(s: number): Point {
  const d = 1 + Math.sin(s) ** 2
  return [(Math.cos(s) / d) * 0.85, ((Math.sin(s) * Math.cos(s)) / d) * 1.2]
}

const straight = (u: number): Point => [0.6 - u * 1.2, 0]

const WORMS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) =>
    crawl(f, (u) => {
      const a = f.t * 1.4 - u * 2.6
      const r = 0.55 + 0.04 * Math.sin(f.t * 9 - u * 12)
      return [Math.cos(a) * r, Math.sin(a) * r]
    }),
  searching: (f) =>
    crawl(f, (u) => {
      const time = f.t - u * 0.9
      return [0.65 * Math.sin(time * 1.3), 0.45 * Math.sin(time * 2.1 + 1)]
    }),
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.4)
    const settle = smooth((phase - 0.3) / 0.45)
    const h1 = hash(index, 1) * TAU
    const h2 = hash(index, 2) * TAU
    crawl(f, (u) => {
      const time = f.t - u * 1.2
      const messy: Point = [Math.sin(time * 2.3 + h1) * 0.6, Math.cos(time * 1.7 + h2) * 0.6]
      const neat = straight(u)
      return [lerp(messy[0], neat[0], settle), lerp(messy[1], neat[1], settle)]
    })
  },
  listening: (f) => {
    const v = level(f.t, 0)
    crawl(f, (u) => [straight(u)[0], Math.sin(u * 6 - f.t * 5) * 0.15 * v], 1, () => 0.8 + 0.5 * v)
  },
  connecting: (f) => {
    const join = envelope(cycle(f.t, 3.4).phase, 0.45, 0.7)
    const arc = (0.6 + 0.38 * join) * TAU
    crawl(f, (u) => {
      const a = f.t * 1.2 - u * arc
      return [Math.cos(a) * 0.55, Math.sin(a) * 0.55]
    })
  },
  weaving: (f) => {
    crawl(f, (u) => lemniscate(f.t * 1.1 - u * 1.6))
    crawl(f, (u) => lemniscate(-f.t * 1.1 + Math.PI + u * 1.6))
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const grown = smooth(phase / 0.7) * (1 - smooth((phase - 0.88) / 0.12))
    crawl(f, (u) => {
      const time = f.t - u * 0.9
      return [0.6 * Math.sin(time * 1.2), 0.35 * Math.sin(time * 2.4)]
    }, Math.max(0.08, grown))
  },
  breathing: (f) => {
    const coil = 0.8 + 0.3 * breath(f.t)
    crawl(f, (u) => {
      const a = f.t * 0.4 - u * 7
      const r = (0.12 + u * 0.6) * coil
      return [Math.cos(a) * r, Math.sin(a) * r]
    })
  },
  shaping: (f) => {
    const radius = shapeMorph(f.t)
    crawl(f, (u) => {
      const a = f.t * 1.2 - u * 3
      const r = 0.72 * radius(a)
      return [Math.cos(a) * r, Math.sin(a) * r]
    })
  },
}

export const worm: SpinnerSet = {
  id: 'worm',
  label: 'Worm',
  icon: { state: 'weaving', t: 2.9 },
  blurbs: {
    working: 'a caterpillar inches around a circle',
    searching: 'it wanders, sniffing around',
    solving: 'a knotted worm stretches out straight',
    listening: 'it wriggles in place with the voice',
    connecting: 'it chases its own tail',
    weaving: 'two worms cross in a figure eight',
    composing: 'it grows longer as it crawls',
    breathing: 'curled up, breathing in its sleep',
    shaping: 'it crawls around a circle, triangle, square',
  },
  draw: (state, f) => WORMS[state](f),
}
