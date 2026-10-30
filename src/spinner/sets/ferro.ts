import { TAU, breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Spike {
  a: number
  h: number
}

interface Body {
  x?: number
  r?: number
  spikes: Spike[]
}

function wrap(a: number) {
  return ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI
}

function ring(n: number, rotation: number, height: (i: number) => number): Spike[] {
  return Array.from({ length: n }, (_, i) => ({ a: rotation + (i * TAU) / n, h: height(i) }))
}

/** Concave-sided cones, like ferrofluid peaks standing up in a magnetic field. */
function body(f: Frame, { x = 0, r = 0.42, spikes }: Body) {
  const s = space(f)
  const width = f.compact ? 0.45 : 0.28
  const samples = f.compact ? 72 : 180
  const base = r * (f.compact ? 1.3 : 1)
  f.ctx.beginPath()
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * TAU
    const rise = spikes.reduce((sum, p) => sum + p.h * Math.max(0, 1 - Math.abs(wrap(a - p.a)) / width) ** 2, 0)
    f.ctx.lineTo(s.x(x + Math.cos(a) * (base + rise)), s.y(Math.sin(a) * (base + rise)))
  }
  f.ctx.closePath()
  f.ctx.fill()
}

const COUNTS = [3, 5, 8]

const BODIES: Record<SpinnerState, (t: number) => Body[]> = {
  working: (t) => [{ spikes: ring(8, t * 0.6, (i) => 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 3 - i * 1.6))) }],
  searching: (t) => [{ spikes: ring(12, 0, (i) => 0.5 * Math.max(0, Math.cos((i * TAU) / 12 - t * 1.6)) ** 4) }],
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const tick = Math.floor(t / 0.12)
    return [{ spikes: ring(10, index * 0.4, (i) => lerp(hash(index, i, tick) * 0.5, 0.3, settle)) }]
  },
  listening: (t) => [{ spikes: ring(9, -Math.PI / 2, (i) => 0.06 + 0.42 * level(t, i)) }],
  connecting: (t) => {
    const reach = 0.24 * envelope(cycle(t, 3.2).phase, 0.4, 0.7)
    const calm = (rotation: number) => ring(5, rotation, () => 0.07)
    return [
      { x: -0.5, r: 0.3, spikes: [{ a: 0, h: reach }, ...calm(t * 0.5 + 0.6)] },
      { x: 0.5, r: 0.3, spikes: [{ a: Math.PI, h: reach }, ...calm(-t * 0.5 + 0.6)] },
    ]
  },
  weaving: (t) => [{ spikes: [...ring(6, t * 0.8, () => 0.24), ...ring(6, -t * 0.8, () => 0.24)] }],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return [{ spikes: ring(10, -Math.PI / 2, (i) => 0.4 * smooth((phase - (i / 10) * 0.6) / 0.1) * fade) }]
  },
  breathing: (t) => [{ spikes: ring(8, t * 0.2, () => 0.04 + 0.36 * breath(t)) }],
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    return [{ spikes: ring(COUNTS[index % COUNTS.length], -Math.PI / 2, () => 0.45 * swap) }]
  },
}

export const ferro: SpinnerSet = {
  id: 'ferro',
  label: 'Ferro',
  icon: { state: 'working', t: 0.4 },
  blurbs: {
    working: 'a wave of spikes rolls around the drop',
    searching: 'spikes rise toward a turning magnet',
    solving: 'restless spikes even out',
    listening: 'spikes stand up with the voice',
    connecting: 'two drops reach out and touch',
    weaving: 'two crowns of spikes pass through each other',
    composing: 'spikes rise one by one around the drop',
    breathing: 'the drop bristles and smooths',
    shaping: 'three, five, eight spikes',
  },
  draw(state, f) {
    BODIES[state](f.t).forEach((b) => body(f, b))
  },
}
