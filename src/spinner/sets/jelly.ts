import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Bell height (0..1) across its width, x in -1..1. */
type Profile = (x: number) => number

interface Jelly {
  x?: number
  y?: number
  scale?: number
  tilt?: number
  /** Bell contraction, 0 relaxed to 1 fully squeezed. */
  squeeze: number
  /** Sideways offset of tentacle k at s (0 at the bell, 1 at the tip). */
  wave: (k: number, s: number) => number
  /** Tentacle length as a fraction of full. */
  reach?: (k: number) => number
  profile?: Profile
}

const DOME: Profile = (x) => Math.sqrt(Math.max(0, 1 - x * x))
const PEAK: Profile = (x) => 1 - Math.abs(x)
const BOX: Profile = (x) => smooth((1 - Math.abs(x)) / 0.2)
const PROFILES = [DOME, PEAK, BOX]

function medusa(f: Frame, { x = 0, y = 0, scale = 1, tilt = 0, squeeze, wave, reach = () => 1, profile = DOME }: Jelly) {
  const s = space(f)
  const unit = s.len(1)
  const w = 0.5 * (1 - 0.25 * squeeze)
  const h = 0.38 * (1 + 0.3 * squeeze)
  f.ctx.save()
  f.ctx.translate(s.x(x), s.y(y - 0.08 * squeeze))
  f.ctx.rotate(tilt)
  f.ctx.scale(scale * unit, scale * unit)
  f.ctx.lineWidth /= scale * unit
  const samples = f.compact ? 16 : 32
  f.ctx.beginPath()
  for (let i = 0; i <= samples; i++) {
    const xn = lerp(-1, 1, i / samples)
    f.ctx.lineTo(xn * w, -h * profile(xn))
  }
  f.ctx.quadraticCurveTo(0, -0.12 * h, -w, 0)
  f.ctx.fill()
  const n = f.compact ? 3 : 5
  for (let k = 0; k < n; k++) {
    const root = lerp(-0.7 * w, 0.7 * w, k / (n - 1))
    const length = 0.72 * reach(k)
    if (length <= 0.01) continue
    f.ctx.beginPath()
    for (let j = 0; j <= 12; j++) {
      const sj = j / 12
      f.ctx.lineTo(root + wave(k, sj) * sj, -0.06 * h + sj * length)
    }
    f.ctx.stroke()
  }
  f.ctx.restore()
}

const JELLIES: Record<SpinnerState, (t: number) => Jelly[]> = {
  working: (t) => [{ squeeze: (0.5 + 0.5 * Math.sin(t * 3)) ** 3, wave: (k, s) => 0.12 * Math.sin(s * 5 - t * 4 + k) }],
  searching: (t) => [
    {
      x: Math.sin(t * 1.2) * 0.35,
      tilt: Math.cos(t * 1.2) * 0.35,
      squeeze: (0.5 + 0.5 * Math.sin(t * 3)) ** 3,
      wave: (k, s) => 0.08 * Math.sin(s * 5 - t * 4 + k) - Math.cos(t * 1.2) * 0.12 * s,
    },
  ],
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const tangle = 1 - smooth((phase - 0.3) / 0.45)
    return [
      {
        squeeze: 0.2 * tangle,
        wave: (k, s) => (0.04 + 0.3 * tangle) * Math.sin(s * (4 + hash(index, k) * 8) - t * 5 + hash(index, k, 1) * 6),
      },
    ]
  },
  listening: (t) => [{ squeeze: level(t, 0), wave: (k, s) => (0.03 + 0.15 * level(t, k + 1)) * Math.sin(s * 6 - t * 5 + k) }],
  connecting: (t) => {
    const e = envelope(cycle(t, 3.4).phase, 0.4, 0.7)
    return [-1, 1].map((side) => ({
      x: side * lerp(0.5, 0.3, e),
      y: 0.05,
      scale: 0.6,
      tilt: -side * 0.45 * e,
      squeeze: (0.5 + 0.5 * Math.sin(t * 3 + side)) ** 3,
      wave: (k: number, s: number) => 0.1 * Math.sin(s * 5 - t * 4 + k),
    }))
  },
  weaving: (t) => [{ squeeze: 0.3 * breath(t * 2), wave: (k, s) => 0.15 * Math.sin(s * 5 - t * 3) * (k % 2 ? 1 : -1) }],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return [{ squeeze: 0.2, wave: (k, s) => 0.08 * Math.sin(s * 5 - t * 4 + k), reach: (k) => smooth((phase - k * 0.1) / 0.2) * fade }]
  },
  breathing: (t) => [{ squeeze: 0.8 * breath(t), wave: (k, s) => 0.08 * Math.sin(s * 4 - t * 1.5 + k) }],
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = PROFILES[index % 3]
    const to = PROFILES[(index + 1) % 3]
    return [{ squeeze: 0, wave: (k, s) => 0.08 * Math.sin(s * 5 - t * 4 + k), profile: (x) => lerp(from(x), to(x), blend) }]
  },
}

export const jelly: SpinnerSet = {
  id: 'jelly',
  label: 'Jelly',
  icon: { state: 'working', t: 0.5 },
  blurbs: {
    working: 'a jellyfish pulses and trails its tentacles',
    searching: 'it drifts side to side, leaning into the turn',
    solving: 'tangled tentacles comb out straight',
    listening: 'the bell pulses with the voice',
    connecting: 'two jellyfish lean in to touch',
    weaving: 'tentacles braid as they sway',
    composing: 'tentacles grow out one by one',
    breathing: 'the bell squeezes and relaxes slowly',
    shaping: 'a dome, a spire, a box',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.025, 0.08)
    JELLIES[state](f.t).forEach((j) => medusa(f, j))
  },
}
