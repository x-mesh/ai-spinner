import { TAU, breath, cycle, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Points in unit space: [-1, 1] on both axes, y down. */
type Point = [number, number]

function stroke(f: Frame, points: Point[], alpha = 1, closed = false) {
  const c = f.size / 2
  const r = f.size * 0.4
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  points.forEach(([x, y], i) => (i === 0 ? f.ctx.moveTo : f.ctx.lineTo).call(f.ctx, c + x * r, c + y * r))
  if (closed) f.ctx.closePath()
  f.ctx.stroke()
}

function sample(count: number, at: (u: number) => Point, from = 0, to = 1) {
  return Array.from({ length: count + 1 }, (_, i) => at(lerp(from, to, i / count)))
}

function lemniscate(s: number): Point {
  const d = 1 + Math.sin(s) ** 2
  return [(Math.cos(s) / d) * 1.1, ((Math.sin(s) * Math.cos(s)) / d) * 1.3]
}

const CHECK: Point[] = [
  [-0.7, 0],
  [-0.2, 0.5],
  [0.75, -0.55],
]

function alongCheck(u: number): Point {
  const split = 0.32
  const [a, b, c] = CHECK
  const [p, q, k] = u < split ? [a, b, u / split] : [b, c, (u - split) / (1 - split)]
  return [lerp(p[0], q[0], k), lerp(p[1], q[1], k)]
}

const STROKES: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    stroke(f, sample(48, (u) => lemniscate(u * TAU)), 0.15, true)
    const head = f.t * 2.2
    const pieces = 10
    for (let i = 0; i < pieces; i++) {
      const from = head - 1.8 + (i * 1.8) / pieces
      stroke(f, sample(4, (u) => lemniscate(u), from, from + 1.8 / pieces + 0.02), (i + 1) / pieces)
    }
  },
  searching: (f) => {
    stroke(f, sample(90, (u) => [Math.sin(3 * u * TAU + f.t * 0.9) * 0.95, Math.sin(2 * u * TAU) * 0.9]), 0.85)
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3)
    const settle = smooth((phase - 0.4) / 0.3)
    const jitter = Math.floor(f.t / 0.14)
    const count = 8
    const points = sample(count, (u) => {
      const j = Math.round(u * count)
      const loose: Point = [hash(index, j, jitter, 1) * 1.7 - 0.85, hash(index, j, jitter, 2) * 1.7 - 0.85]
      const neat = alongCheck(u)
      return [lerp(loose[0], neat[0], settle), lerp(loose[1], neat[1], settle)]
    })
    stroke(f, points)
  },
  listening: (f) => {
    const amp = 0.2 + 0.6 * level(f.t, 0)
    stroke(f, sample(f.compact ? 24 : 60, (u) => {
      const x = u * 2 - 1
      return [x, (1 - x * x) * amp * Math.sin(x * 7 - f.t * 6)]
    }))
  },
  connecting: (f) => {
    const { phase } = cycle(f.t, 2.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const reach = smooth(phase / 0.4)
    stroke(f, [[-0.85, 0], [lerp(-0.85, 0.85, reach), 0]], fade)
    const ends: Point[] = [[-0.85, 0], [0.85, 0]]
    ends.forEach((p) => stroke(f, sample(16, (u) => [p[0] + Math.cos(u * TAU) * 0.13, Math.sin(u * TAU) * 0.13])))
    if (phase > 0.4) {
      const x = lerp(-0.85, 0.85, smooth((phase - 0.4) / 0.4))
      stroke(f, sample(12, (u) => [x + Math.cos(u * TAU) * 0.05, Math.sin(u * TAU) * 0.05]), fade)
    }
  },
  weaving: (f) => {
    for (let j = 0; j < 3; j++) {
      const wave = (u: number): Point => {
        const x = u * 2 - 1
        return [x, 0.55 * Math.sin(x * 3.2 + f.t * 2.5 + (j * TAU) / 3)]
      }
      stroke(f, sample(f.compact ? 20 : 48, wave), 0.45 + j * 0.27)
    }
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const written = smooth(phase / 0.7)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const loops = f.compact ? 2.5 : 3.5
    const pen = (u: number): Point => {
      const a = u * TAU * loops
      return [-0.85 + u * 1.7 - 0.14 * Math.sin(a), -0.3 * Math.cos(a) + 0.05]
    }
    if (written > 0.01) stroke(f, sample(Math.ceil(80 * written) + 1, pen, 0, written), fade)
  },
  breathing: (f) => {
    const r = 0.45 + 0.35 * breath(f.t)
    stroke(f, sample(60, (u) => {
      const a = u * TAU
      const wobble = 1 + 0.04 * Math.sin(4 * a + f.t)
      return [Math.cos(a) * r * wobble, Math.sin(a) * r * wobble]
    }), 0.5 + 0.5 * breath(f.t), true)
  },
  shaping: (f) => {
    const radius = shapeMorph(f.t)
    f.ctx.setLineDash([f.size * 0.16, f.size * 0.07])
    f.ctx.lineDashOffset = -f.t * f.size * 0.3
    stroke(f, sample(72, (u) => {
      const a = u * TAU
      const r = 0.9 * radius(a)
      return [Math.cos(a) * r, Math.sin(a) * r]
    }), 1, true)
    f.ctx.setLineDash([])
  },
}

export const strokes: SpinnerSet = {
  id: 'strokes',
  label: 'Strokes',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'a pen chases its tail around an infinity loop',
    searching: 'a knot slowly turns over',
    solving: 'a scribble straightens into a check mark',
    listening: 'an oscilloscope trace',
    connecting: 'a line bridges two points, then a bead crosses',
    weaving: 'three threads braid',
    composing: 'cursive loops write themselves',
    breathing: 'a circle inhales and exhales',
    shaping: 'a dashed outline marches through shapes',
  },
  draw(state, f) {
    f.ctx.lineWidth = Math.max(1.25, f.size * (f.compact ? 0.09 : 0.045))
    STROKES[state](f)
  },
}
