import { TAU, breath, cycle, hash, lerp, level, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]
type Curve = (s: number) => Point

/** Pen at distance d inside a circle of radius r rolling inside radius R, scaled to fit unit space. */
function hypotrochoid(R: number, r: number, d: number): Curve {
  const scale = 0.92 / (R - r + d)
  const k = (R - r) / r
  return (s) => [((R - r) * Math.cos(s) + d * Math.cos(k * s)) * scale, ((R - r) * Math.sin(s) - d * Math.sin(k * s)) * scale]
}

function rose(k: number, amp = 0.9): Curve {
  return (s) => [Math.cos(k * s) * Math.cos(s) * amp, Math.cos(k * s) * Math.sin(s) * amp]
}

function turned(curve: Curve, a: number): Curve {
  return (s) => {
    const [x, y] = curve(s)
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
  }
}

/** Strokes the curve from `from` to `to`; with `tail`, the stroke fades toward its start. */
function trace(f: Frame, curve: Curve, from: number, to: number, alpha = 1, tail = false) {
  const s = space(f)
  const chunks = tail ? 10 : 1
  const perChunk = Math.max(6, Math.ceil(((to - from) * 18) / chunks))
  for (let c = 0; c < chunks; c++) {
    const a = lerp(from, to, c / chunks)
    const b = lerp(from, to, (c + 1) / chunks)
    f.ctx.globalAlpha = alpha * (tail ? (c + 1) / chunks : 1)
    f.ctx.beginPath()
    for (let i = 0; i <= perChunk; i++) {
      const [x, y] = curve(lerp(a, b, i / perChunk))
      f.ctx.lineTo(s.x(x), s.y(y))
    }
    f.ctx.stroke()
  }
}

const SHAPE_KS = [3, 2, 5]

const SPIROS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const curve = hypotrochoid(5, 3, 5)
    trace(f, curve, f.t * 2 - 7, f.t * 2, 1, true)
    disc(f, ...curve(f.t * 2), 0.05)
  },
  searching: (f) => {
    const curve = turned(hypotrochoid(6, 1, 1.5), f.t * 0.2)
    trace(f, curve, 0, TAU, 0.2)
    trace(f, curve, f.t * 1.5 - 2, f.t * 1.5, 1, true)
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const target = rose(3)
    const h1 = 2 + Math.floor(hash(index, 1) * 4)
    const h2 = 2 + Math.floor(hash(index, 2) * 4)
    const messy: Curve = (s) => [Math.sin(s * h1 + f.t) * 0.8, Math.cos(s * h2 - f.t * 1.3) * 0.8]
    trace(f, (s) => {
      const [ax, ay] = messy(s)
      const [bx, by] = target(s)
      return [lerp(ax, bx, settle), lerp(ay, by, settle)]
    }, 0, TAU)
  },
  listening: (f) => trace(f, turned(rose(4, 0.45 + 0.5 * level(f.t, 0)), f.t * 0.3), 0, TAU),
  connecting: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const end = smooth(phase / 0.75) * TAU * 2
    trace(f, hypotrochoid(5, 2, 3), 0, end, 1 - smooth((phase - 0.85) / 0.15))
  },
  weaving: (f) => {
    trace(f, turned(hypotrochoid(7, 3, 4), f.t * 0.4), 0, TAU * 3, 1)
    trace(f, turned(hypotrochoid(7, 3, 4), -f.t * 0.4 + 0.3), 0, TAU * 3, 0.45)
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 4.4)
    const end = smooth(phase / 0.78) * TAU * 3
    trace(f, hypotrochoid(5, 3, 5), 0, end, 1 - smooth((phase - 0.88) / 0.12))
  },
  breathing: (f) => trace(f, turned(rose(3, 0.5 + 0.42 * breath(f.t)), f.t * 0.15), 0, TAU),
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 2)
    const blend = smooth((phase - 0.6) / 0.4)
    const a = rose(SHAPE_KS[index % 3])
    const b = rose(SHAPE_KS[(index + 1) % 3])
    trace(f, turned((s) => {
      const [ax, ay] = a(s)
      const [bx, by] = b(s)
      return [lerp(ax, bx, blend), lerp(ay, by, blend)]
    }, f.t * 0.2), 0, TAU)
  },
}

export const spiro: SpinnerSet = {
  id: 'spiro',
  label: 'Spiro',
  icon: { state: 'listening', t: 1.4 },
  blurbs: {
    working: 'a spirograph pen loops with a fading trail',
    searching: 'a pen circles a faint pattern',
    solving: 'a scribble resolves into a three-leaf rose',
    listening: 'a rose opens with the voice',
    connecting: 'the pen draws until the loop closes',
    weaving: 'two patterns turn through each other',
    composing: 'a full spirograph draws itself',
    breathing: 'a rose swells and folds',
    shaping: 'roses with three, four, five petals',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.025, 0.07)
    SPIROS[state](f)
  },
}
