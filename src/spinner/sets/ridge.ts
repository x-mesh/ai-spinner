import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Peak height of ridge k at x; ridges are stacked back (k = 0) to front. */
type Profile = (x: number, k: number, n: number) => number

interface Range {
  profile: Profile
  visible?: (k: number, n: number) => number
}

function bump(x: number, width = 5) {
  return Math.exp(-x * x * width)
}

/** Each ridge erases what lies below its line before stroking, so nearer ridges hide farther ones. */
function ridges(f: Frame, { profile, visible = () => 1 }: Range) {
  const s = space(f)
  const n = f.compact ? 4 : 9
  const samples = f.compact ? 16 : 40
  for (let k = 0; k < n; k++) {
    const alpha = visible(k, n)
    if (alpha <= 0.01) continue
    const base = lerp(-0.55, 0.75, k / (n - 1))
    const points = Array.from({ length: samples + 1 }, (_, i) => {
      const x = lerp(-0.9, 0.9, i / samples)
      return [x, base - profile(x, k, n)] as const
    })
    f.ctx.globalCompositeOperation = 'destination-out'
    f.ctx.globalAlpha = 1
    f.ctx.beginPath()
    points.forEach(([x, y]) => f.ctx.lineTo(s.x(x), s.y(y)))
    f.ctx.lineTo(s.x(0.9), s.y(1.3))
    f.ctx.lineTo(s.x(-0.9), s.y(1.3))
    f.ctx.closePath()
    f.ctx.fill()
    f.ctx.globalCompositeOperation = 'source-over'
    f.ctx.globalAlpha = alpha * (0.45 + 0.55 * (k / (n - 1)))
    f.ctx.beginPath()
    points.forEach(([x, y]) => f.ctx.lineTo(s.x(x), s.y(y)))
    f.ctx.stroke()
  }
}

const SHAPES: ((x: number) => number)[] = [
  (x) => bump(x),
  (x) => Math.max(0, 1 - Math.abs(x) * 1.6),
  (x) => smooth((0.5 - Math.abs(x)) / 0.15),
]

const RANGES: Record<SpinnerState, (t: number) => Range> = {
  working: (t) => ({ profile: (x, k) => bump(x) * (0.35 + 0.25 * Math.sin(x * 7 + k * 1.9 - t * 3)) }),
  searching: (t) => {
    const c = Math.sin(t * 1.2) * 0.6
    return { profile: (x) => bump(x - c, 18) * 0.4 }
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return {
      profile: (x, k) =>
        bump(x, 3) * (Math.abs(Math.sin(x * 13 + hash(index, k) * 9 + t * 7)) * 0.35 * (1 - settle) + bump(x, 2) * 0.3 * settle),
    }
  },
  listening: (t) => ({ profile: (x, k) => bump(x) * (0.08 + 0.42 * level(t - k * 0.1, 0)) }),
  connecting: (t) => {
    const c = 0.55 * (1 - envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return { profile: (x) => (bump(x - c, 14) + bump(x + c, 14)) * 0.3 }
  },
  weaving: (t) => ({ profile: (x, k) => bump(x, 4) * 0.3 * (0.5 + 0.5 * Math.sin(x * 6 + (k % 2 ? 1 : -1) * t * 3)) }),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return {
      profile: (x, k) => bump(x) * (0.25 + 0.15 * Math.sin(x * 5 + k)),
      visible: (k, n) => Math.min(1, Math.max(0, smooth(phase / 0.65) * n - (n - 1 - k))) * fade,
    }
  },
  breathing: (t) => ({ profile: (x) => bump(x) * (0.08 + 0.35 * breath(t)) }),
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    return { profile: (x) => 0.35 * lerp(SHAPES[index % 3](x), SHAPES[(index + 1) % 3](x), blend) }
  },
}

export const ridge: SpinnerSet = {
  id: 'ridge',
  label: 'Ridge',
  icon: { state: 'working', t: 1.9 },
  blurbs: {
    working: 'ridgelines rise and fall like a signal',
    searching: 'a single peak sweeps across the range',
    solving: 'jagged spikes settle into gentle hills',
    listening: 'peaks rise ridge by ridge with the voice',
    connecting: 'two peaks slide together and part',
    weaving: 'alternate ridges flow in opposite directions',
    composing: 'ridges stack up from front to back',
    breathing: 'the range swells and flattens',
    shaping: 'a hill, a pyramid, a mesa',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.025, 0.07)
    ridges(f, RANGES[state](f.t))
  },
}
