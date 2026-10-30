import { TAU, breath, cycle, envelope, hash, level, shapeMorph, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const SAMPLES = 72

/** Fills a closed shape around (cx, cy) in unit space whose radius depends on canvas angle. */
function fillPolar(f: Frame, radius: (a: number) => number, cx = 0, cy = 0, alpha = 1) {
  const c = f.size / 2
  const unit = f.size * 0.4
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  for (let i = 0; i < SAMPLES; i++) {
    const a = (i / SAMPLES) * TAU
    const r = radius(a)
    f.ctx.lineTo(c + (cx + Math.cos(a) * r) * unit, c + (cy + Math.sin(a) * r) * unit)
  }
  f.ctx.closePath()
  f.ctx.fill()
}

function circle(f: Frame, r: number, cx = 0, cy = 0, alpha = 1) {
  fillPolar(f, () => r, cx, cy, alpha)
}

function angleGap(a: number, b: number) {
  return Math.abs((((a - b + Math.PI) % TAU) + TAU) % TAU - Math.PI)
}

const BLOBS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) =>
    fillPolar(f, (a) => 0.62 * (1 + 0.12 * Math.sin(3 * a + f.t * 2) + 0.06 * Math.sin(5 * a - f.t * 3))),
  searching: (f) => {
    circle(f, 0.48 + 0.03 * Math.sin(f.t * 3))
    const a = f.t * 2.2
    circle(f, 0.15, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.8)
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3)
    const chaos = 1 - smooth((phase - 0.4) / 0.35)
    const h1 = hash(index, 1) * TAU
    const h2 = hash(index, 2) * TAU
    fillPolar(f, (a) => {
      const bumps =
        0.2 * Math.sin(2 * a + f.t * 3 + h1) + 0.15 * Math.sin(5 * a - f.t * 4 + h2) + 0.08 * Math.sin(7 * a + f.t * 5)
      return 0.6 * (1 + chaos * bumps)
    })
  },
  listening: (f) => {
    const spikes = f.compact ? 4 : 6
    fillPolar(f, (a) => {
      let r = 0.5
      for (let k = 0; k < spikes; k++) {
        r += 0.22 * level(f.t, k) * Math.exp(-(angleGap(a, (k * TAU) / spikes) ** 2) * 10)
      }
      return r
    })
  },
  connecting: (f) => {
    const { phase } = cycle(f.t, 3)
    const join = envelope(phase, 0.4, 0.7)
    const r = 0.36
    const offset = 0.55 * (1 - join) + 0.18
    circle(f, r, -offset, 0)
    circle(f, r, offset, 0)
    const neck = r * 1.6 * smooth((join - 0.3) / 0.7)
    if (neck > 0.01) {
      const unit = f.size * 0.4
      f.ctx.fillRect(f.size / 2 - offset * unit, f.size / 2 - (neck / 2) * unit, offset * 2 * unit, neck * unit)
    }
  },
  weaving: (f) => {
    for (let j = 0; j < 3; j++) {
      const a = f.t * 1.2 + (j * TAU) / 3
      circle(f, 0.42, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.45)
    }
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const fade = 1 - smooth((phase - 0.82) / 0.18)
    const [a2, a3, a5] = [0, 0.25, 0.5].map((start) => smooth((phase - start) / 0.25) * fade)
    fillPolar(f, (a) =>
      0.58 *
      (1 + 0.12 * a2 * Math.sin(2 * a + f.t) + 0.1 * a3 * Math.sin(3 * a - f.t * 1.3) + 0.07 * a5 * Math.sin(5 * a + f.t * 1.7)),
    )
  },
  breathing: (f) => fillPolar(f, (a) => 0.42 + 0.22 * breath(f.t) + 0.02 * Math.sin(4 * a + f.t)),
  shaping: (f) => {
    const radius = shapeMorph(f.t)
    fillPolar(f, (a) => 0.82 * radius(a))
  },
}

export const blob: SpinnerSet = {
  id: 'blob',
  label: 'Blob',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'a soft body kneads itself',
    searching: 'a moon circles its planet',
    solving: 'a lumpy mass relaxes into a sphere',
    listening: 'spikes push out with the voice',
    connecting: 'two drops meet, merge, and part',
    weaving: 'three translucent discs orbit and overlap',
    composing: 'bumps grow in one at a time',
    breathing: 'a drop swells and shrinks',
    shaping: 'circle, triangle, square in solid',
  },
  draw: (state, f) => BLOBS[state](f),
}
