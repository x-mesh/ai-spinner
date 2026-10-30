import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc, line, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

/** Coil axis at u in [0, 1]: center point and unit normal. */
type Axis = (u: number) => { c: Point; n: Point }

interface Spring {
  axis: Axis
  turns?: number
  radius?: (u: number) => number
  phase?: number
  to?: number
  alpha?: number
}

function straight(x0: number, x1: number): Axis {
  return (u) => ({ c: [lerp(x0, x1, u), 0], n: [0, 1] })
}

function loopAxis(radius: (a: number) => number, r: number): Axis {
  const at = (u: number): Point => {
    const a = u * TAU
    return [Math.cos(a) * r * radius(a), Math.sin(a) * r * radius(a)]
  }
  return (u) => {
    const [ax, ay] = at(u - 0.002)
    const [bx, by] = at(u + 0.002)
    const len = Math.hypot(bx - ax, by - ay) || 1
    return { c: at(u), n: [-(by - ay) / len, (bx - ax) / len] }
  }
}

function coilPoint(axis: Axis, u: number, turns: number, radius: number, phase: number) {
  const { c, n } = axis(u)
  const theta = u * turns * TAU + phase
  return { p: [c[0] + n[0] * Math.sin(theta) * radius, c[1] + n[1] * Math.sin(theta) * radius] as Point, depth: Math.cos(theta) }
}

/** Strokes the helix in short pieces; the far side of each turn is lighter. */
function spring(f: Frame, { axis, turns, radius = () => (f.compact ? 0.36 : 0.28), phase = 0, to = 1, alpha = 1 }: Spring) {
  const s = space(f)
  const coils = turns ?? (f.compact ? 4 : 7)
  const samples = Math.ceil(coils * 20 * to)
  let prev = coilPoint(axis, 0, coils, radius(0), phase)
  for (let i = 1; i <= samples; i++) {
    const u = (i / samples) * to
    const next = coilPoint(axis, u, coils, radius(u), phase)
    f.ctx.globalAlpha = alpha * (0.25 + 0.75 * ((prev.depth + next.depth) / 2 + 1) / 2)
    f.ctx.beginPath()
    f.ctx.moveTo(s.x(prev.p[0]), s.y(prev.p[1]))
    f.ctx.lineTo(s.x(next.p[0]), s.y(next.p[1]))
    f.ctx.stroke()
    prev = next
  }
}

const COILS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const half = 0.6 + 0.25 * Math.sin(f.t * 3)
    spring(f, { axis: straight(-half, half), phase: f.t * 2 })
  },
  searching: (f) => spring(f, { axis: straight(-0.8, 0.8), phase: f.t * 5 }),
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const base = f.compact ? 0.36 : 0.28
    spring(f, { axis: straight(-0.8, 0.8), phase: f.t, radius: (u) => base + (1 - settle) * (hash(index, Math.floor(u * 14)) - 0.5) * 0.45 })
  },
  listening: (f) => {
    const half = 0.85 - 0.35 * level(f.t, 0)
    spring(f, { axis: straight(-half, half), phase: f.t * 1.5 })
  },
  connecting: (f) => {
    const end = lerp(-0.35, 0.85, envelope(cycle(f.t, 3).phase, 0.4, 0.7))
    const full = f.compact ? 4 : 7
    spring(f, { axis: straight(-0.85, end), phase: f.t, turns: Math.max(1.5, ((end + 0.85) / 1.7) * full) })
    disc(f, -0.85, 0, 0.07)
    disc(f, 0.85, 0, 0.07, 0.4)
  },
  weaving: (f) => {
    const axis = straight(-0.85, 0.85)
    const turns = f.compact ? 2 : 3
    const radius = () => (f.compact ? 0.4 : 0.32)
    const phase = f.t * 1.5
    const rungs = turns * 4
    for (let i = 0; i <= rungs; i++) {
      const u = i / rungs
      const a = coilPoint(axis, u, turns, radius(), phase)
      const b = coilPoint(axis, u, turns, radius(), phase + Math.PI)
      line(f, [a.p, b.p], 0.3)
    }
    spring(f, { axis, turns, radius, phase })
    spring(f, { axis, turns, radius, phase: phase + Math.PI })
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    spring(f, { axis: straight(-0.8, 0.8), to: Math.max(0.02, smooth(phase / 0.7)), alpha: 1 - smooth((phase - 0.85) / 0.15) })
  },
  breathing: (f) => {
    const half = 0.5 + 0.3 * breath(f.t)
    spring(f, { axis: straight(-half, half), phase: f.t * 0.5 })
  },
  shaping: (f) =>
    spring(f, { axis: loopAxis(shapeMorph(f.t), 0.62), turns: f.compact ? 8 : 14, radius: () => (f.compact ? 0.2 : 0.14), phase: f.t * 2 }),
}

export const coil: SpinnerSet = {
  id: 'coil',
  label: 'Coil',
  icon: { state: 'working', t: 0.4 },
  blurbs: {
    working: 'a spring bounces as it turns',
    searching: 'a screw thread drives forward',
    solving: 'a bent spring straightens out',
    listening: 'the spring squeezes with the voice',
    connecting: 'a spring stretches to reach its anchor',
    weaving: 'a double helix with rungs turns',
    composing: 'the coil winds itself turn by turn',
    breathing: 'a slow compress and release',
    shaping: 'a coiled ring in circle, triangle, square',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.035, 0.08)
    COILS[state](f)
  },
}
