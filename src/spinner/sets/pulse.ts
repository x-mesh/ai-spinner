import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc, inkRgb, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Trace height at x (in -EDGE..EDGE); negative is up. */
type Wave = (x: number) => number

interface Trace {
  wave: Wave
  /** x the trace has reached; the head dot sits here. */
  head?: number
  y?: number
  alpha?: number
}

const EDGE = 0.85

/** One heartbeat over phase 0..1: a small bump, a sharp spike, a slow wave. */
function beat(phase: number) {
  const p = ((phase % 1) + 1) % 1
  const bump = (c: number, w: number, h: number) => h * Math.exp(-(((p - c) / w) ** 2))
  return bump(0.12, 0.04, -0.08) + bump(0.28, 0.012, 0.12) + bump(0.31, 0.014, -0.6) + bump(0.34, 0.012, 0.22) + bump(0.55, 0.06, -0.14)
}

/** The trace fades out toward its oldest end, like phosphor on a monitor. */
function trace(f: Frame, { wave, head = EDGE, y = 0, alpha = 1 }: Trace) {
  const s = space(f)
  const [r, g, b] = inkRgb(f)
  const samples = f.compact ? 24 : 72
  const ink = f.ctx.createLinearGradient(s.x(-EDGE), 0, s.x(head), 0)
  ink.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
  ink.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha})`)
  f.ctx.save()
  f.ctx.globalAlpha = 1
  f.ctx.strokeStyle = ink
  f.ctx.beginPath()
  for (let i = 0; i <= samples; i++) {
    const x = lerp(-EDGE, head, i / samples)
    f.ctx.lineTo(s.x(x), s.y(y + wave(x)))
  }
  f.ctx.stroke()
  f.ctx.restore()
  disc(f, head, y + wave(head), f.compact ? 0.1 : 0.05, alpha)
}

const FORMS: ((x: number) => number)[] = [
  (x) => Math.sin(x),
  (x) => (2 / Math.PI) * Math.asin(Math.sin(x)),
  (x) => Math.tanh(Math.sin(x) * 6),
]

const TRACES: Record<SpinnerState, (t: number) => Trace[]> = {
  working: (t) => [{ wave: (x) => beat((x - t * 0.8) / 0.9) }],
  searching: (t) => {
    const k = 6 + 5 * Math.sin(t * 0.8)
    return [{ wave: (x) => 0.3 * Math.sin(x * k - t * 6) }]
  },
  solving: (t) => {
    const { phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const tick = Math.floor(t / 0.08)
    return [{ wave: (x) => lerp((hash(Math.round(x * 40), tick) - 0.5) * 0.8, beat((x - t * 0.8) / 0.9), settle) }]
  },
  listening: (t) => [{ wave: (x) => 0.5 * level(t - (EDGE - x) * 0.8, 0) * Math.sin(x * 34 - t * 10) }],
  connecting: (t) => {
    const gap = 0.4 * (1 - envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    const wave = (x: number) => 0.15 * Math.sin(x * 7 - t * 4)
    return [{ wave, y: -gap }, { wave, y: gap, alpha: 0.7 }]
  },
  weaving: (t) => [
    { wave: (x) => 0.3 * Math.sin(x * 6 - t * 4) },
    { wave: (x) => -0.3 * Math.sin(x * 6 - t * 4), alpha: 0.7 },
  ],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    return [{ wave: (x) => beat((x + EDGE) / 0.9), head: lerp(-EDGE + 0.01, EDGE, smooth(phase / 0.75)), alpha: 1 - smooth((phase - 0.85) / 0.15) }]
  },
  breathing: (t) => [{ wave: (x) => 0.12 + 0.3 * breath(t) * Math.sin(x * 2.5 - t * 0.8) }],
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = FORMS[index % 3]
    const to = FORMS[(index + 1) % 3]
    return [{ wave: (x) => 0.3 * lerp(from(x * 5 - t * 4), to(x * 5 - t * 4), blend) }]
  },
}

export const pulse: SpinnerSet = {
  id: 'pulse',
  label: 'Pulse',
  icon: { state: 'working', t: 0.6 },
  blurbs: {
    working: 'a heartbeat scrolls across the monitor',
    searching: 'a wave sweeps up and down in pitch',
    solving: 'noise settles into a steady heartbeat',
    listening: 'the trace follows the voice',
    connecting: 'two traces converge into one',
    weaving: 'two waves cross back and forth',
    composing: 'the trace writes itself across',
    breathing: 'a slow wave swells and flattens',
    shaping: 'a sine, a triangle, a square wave',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.025, 0.075)
    TRACES[state](f.t).forEach((spec) => trace(f, spec))
  },
}
