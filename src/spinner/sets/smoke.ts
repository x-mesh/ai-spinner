import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Wisp {
  x: number
  /** Sideways drift at the top, growing with height. */
  lean?: number
  sway?: number
  freq?: number
  speed?: number
  phase?: number
  /** Fraction of the full rise drawn. */
  height?: number
  thickness?: number
  alpha?: number
}

const BASE = 0.8
const TOP = -0.85

/** Dense, faint discs that shrink and thin out as the smoke rises; strokes would bead or step. */
function wisp(f: Frame, { x, lean = 0, sway = 0.12, freq = 5, speed = 3, phase = 0, height = 1, thickness = 1, alpha = 1 }: Wisp) {
  const steps = Math.round((f.compact ? 26 : 60) * height)
  const r = (f.compact ? 0.13 : 0.075) * thickness
  for (let i = 0; i <= steps; i++) {
    const s = (i / (f.compact ? 26 : 60))
    const px = x + lean * s * s + sway * s * Math.sin(s * freq - f.t * speed + phase) + 0.3 * sway * s * Math.sin(s * freq * 2.3 + f.t * speed * 0.7 + phase)
    disc(f, px, lerp(BASE, TOP, s), r * (1 - 0.45 * s), alpha * 0.22 * (1 - s) ** 0.8)
  }
}

/** A smoke ring: an expanding, fading outline. */
function puff(f: Frame, y: number, radius: number, shape: (a: number) => number, alpha: number) {
  const s = space(f)
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU
    f.ctx.lineTo(s.x(Math.cos(a) * radius * shape(a)), s.y(y + Math.sin(a) * radius * shape(a) * 0.45))
  }
  f.ctx.stroke()
}

const PLUMES: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => [-0.2, 0, 0.2].forEach((x, k) => wisp(f, { x, phase: k * 2.1, lean: (k - 1) * 0.15 })),
  searching: (f) => [-0.12, 0.12].forEach((x, k) => wisp(f, { x, phase: k * 2, lean: Math.sin(f.t) * 0.55 })),
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    wisp(f, { x: 0, sway: lerp(0.35, 0.03, settle), freq: lerp(4 + hash(index) * 6, 5, settle), speed: lerp(6, 2, settle), thickness: lerp(1.3, 0.7, settle) })
  },
  listening: (f) => {
    const v = level(f.t, 0)
    wisp(f, { x: 0, sway: 0.05 + 0.2 * v, thickness: 0.7 + 0.6 * v })
  },
  connecting: (f) => {
    const e = envelope(cycle(f.t, 3.2).phase, 0.4, 0.7)
    ;[-0.5, 0.5].forEach((x, k) => wisp(f, { x, lean: -x * e, phase: k * 3 }))
  },
  weaving: (f) => [0, Math.PI].forEach((phase) => wisp(f, { x: 0, sway: 0.25, freq: 6, phase, thickness: 0.8 })),
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    wisp(f, { x: 0, height: smooth(phase / 0.7), alpha: 1 - smooth((phase - 0.85) / 0.15) })
  },
  breathing: (f) => wisp(f, { x: 0, sway: 0.15, speed: 1, thickness: 0.6 + 0.6 * breath(f.t) }),
  shaping: (f) => {
    const shape = shapeMorph(f.t)
    const { phase } = cycle(f.t, 1.8)
    wisp(f, { x: 0, height: 0.35, thickness: 0.8 })
    puff(f, lerp(0.3, -0.5, phase), lerp(0.2, 0.6, phase), shape, 1 - smooth((phase - 0.6) / 0.4))
  },
}

export const smoke: SpinnerSet = {
  id: 'smoke',
  label: 'Smoke',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'three wisps curl upward',
    searching: 'a breeze pushes the smoke side to side',
    solving: 'turbulent smoke calms into a thin line',
    listening: 'the smoke billows with the voice',
    connecting: 'two plumes lean in and meet',
    weaving: 'two wisps braid as they rise',
    composing: 'a plume climbs from the source',
    breathing: 'incense smoke sways slowly',
    shaping: 'smoke rings: a circle, a triangle, a square',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.03, 0.08)
    PLUMES[state](f)
  },
}
