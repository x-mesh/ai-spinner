import { TAU, breath, cycle, envelope, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc, line, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Hit {
  /** Where the ball touched the wall. */
  at: Point
  /** Direction from the ball's center to the wall it struck. */
  normal: Point
  age: number
}

interface Ball {
  at: (t: number) => Point
  hits: (t: number) => Hit[]
}

const FLASH_LIFE = 0.32
const TRAIL = 0.34

/** Triangle wave in [-1, 1] with period 4; it reaches a wall at every odd `u`. */
function tri(u: number) {
  return Math.abs((((u + 1) % 4) + 4) % 4 - 2) - 1
}

/** Travel between walls at ±`half(t)` at `speed` wall-to-wall units per second, or free motion with no walls. */
type Axis = { half: (t: number) => number; speed: number; offset?: number } | { free: (t: number) => number }

/** Speeds up and slows down along the way, so the ball rushes, then eases into the next bounce. */
function surge(t: number) {
  return t + 0.25 * Math.sin(t * 2.5)
}

const HIT_STEP = 1 / 120

function ball(x: Axis, y: Axis, warp: (t: number) => number = surge): Ball {
  const unit = (a: Axis, t: number) => ('free' in a ? 0 : tri(a.speed * warp(t) + (a.offset ?? 0)))
  const pos = (a: Axis, t: number) => ('free' in a ? a.free(t) : a.half(t) * unit(a, t))
  const at = (t: number): Point => [pos(x, t), pos(y, t)]
  // Inverting the warp has no closed form, so wall touches are found as peaks in recent samples.
  const hits = (t: number) => {
    const out: Hit[] = []
    for (const [a, k] of [[x, 0], [y, 1]] as const) {
      if ('free' in a) continue
      const n = Math.ceil(FLASH_LIFE / HIT_STEP)
      const u = Array.from({ length: n + 2 }, (_, j) => Math.abs(unit(a, t - j * HIT_STEP)))
      for (let j = 1; j <= n; j++) {
        if (u[j] < 0.9 || u[j] < u[j - 1] || u[j] <= u[j + 1]) continue
        const when = t - j * HIT_STEP
        if (a.half(when) < 0.08) continue
        const edge = Math.sign(unit(a, when))
        out.push({ at: at(when), normal: k === 0 ? [edge, 0] : [0, edge], age: j * HIT_STEP })
      }
    }
    return out
  }
  return { at, hits }
}

function radius(f: Frame) {
  return f.compact ? 0.2 : 0.11
}

function trail(f: Frame, b: Ball, span = TRAIL, alpha = 1) {
  const steps = f.compact ? 8 : 18
  f.ctx.lineWidth = strokeWidth(f, 0.05, 0.09)
  for (let k = steps; k > 0; k--) {
    const from = b.at(f.t - (k * span) / steps)
    const to = b.at(f.t - ((k - 1) * span) / steps)
    line(f, [from, to], 0.35 * (1 - k / steps) * alpha)
  }
  disc(f, ...b.at(f.t), radius(f), alpha)
}

function flashes(f: Frame, b: Ball) {
  const r = radius(f)
  const reach = f.compact ? 0.32 : 0.22
  for (const { at, normal, age } of b.hits(f.t)) {
    const p = age / FLASH_LIFE
    const [wx, wy] = [at[0] + normal[0] * r, at[1] + normal[1] * r]
    const along: Point = [normal[1], normal[0]]
    const half = reach * (0.5 + 0.5 * smooth(p * 3))
    f.ctx.lineWidth = strokeWidth(f, 0.04, 0.08) * (1 - 0.6 * p)
    line(f, [[wx - along[0] * half, wy - along[1] * half], [wx + along[0] * half, wy + along[1] * half]], 0.9 * (1 - p))
    // A short spray off the wall sells the impact.
    f.ctx.lineWidth = strokeWidth(f, 0.02, 0.05)
    for (const side of [-1, 1]) {
      const spread = 0.12 + 0.18 * p
      const dx = -normal[0] * spread + along[0] * side * spread
      const dy = -normal[1] * spread + along[1] * side * spread
      line(f, [[wx + dx * 0.4, wy + dy * 0.4], [wx + dx, wy + dy]], 0.6 * (1 - p))
    }
  }
}

function box(f: Frame, hx: number, hy: number, alpha = 0.22) {
  const s = space(f)
  const r = radius(f)
  f.ctx.lineWidth = strokeWidth(f, 0.018, 0.045)
  f.ctx.globalAlpha = alpha
  f.ctx.strokeRect(s.x(-hx - r), s.y(-hy - r), s.len(2 * (hx + r)), s.len(2 * (hy + r)))
}

function walls(f: Frame, hx: number, hy: number) {
  const r = radius(f)
  f.ctx.lineWidth = strokeWidth(f, 0.04, 0.08)
  for (const side of [-1, 1]) line(f, [[side * (hx + r), -hy], [side * (hx + r), hy]], 0.5)
}

function play(f: Frame, balls: Ball[]) {
  balls.forEach((b) => flashes(f, b))
  balls.forEach((b) => trail(f, b))
}

const fixed = (v: number) => () => v

const RALLIES: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const h = f.compact ? 0.62 : 0.68
    box(f, h, h)
    play(f, [ball({ half: fixed(h), speed: 2.4 }, { half: fixed(h), speed: 1.7, offset: 0.6 })])
  },
  searching: (f) => {
    const h = f.compact ? 0.6 : 0.68
    walls(f, h, 0.8)
    play(f, [ball({ half: fixed(h), speed: 2.6 }, { free: (t) => 0.62 * Math.sin(t * 0.9) }, (t) => t)])
  },
  solving: (f) => {
    const settle = (t: number) => smooth((cycle(t, 3.6).phase - 0.15) / 0.6) * (1 - smooth((cycle(t, 3.6).phase - 0.92) / 0.08))
    const h = f.compact ? 0.62 : 0.68
    box(f, h, h)
    play(f, [ball({ half: fixed(h), speed: 2.4 }, { half: (t) => h * (1 - settle(t)), speed: 3.1, offset: 0.4 })])
  },
  listening: (f) => {
    const half = (t: number) => 0.3 + 0.4 * level(t, 0)
    box(f, half(f.t), half(f.t))
    play(f, [ball({ half, speed: 2.2 }, { half, speed: 1.6, offset: 0.5 })])
  },
  connecting: (f) => {
    const gap = (t: number) => lerp(0.7, f.compact ? 0.2 : 0.24, envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    walls(f, gap(f.t), 0.35)
    play(f, [ball({ half: gap, speed: 2.4 }, { free: () => 0 })])
  },
  weaving: (f) => {
    const h = f.compact ? 0.62 : 0.68
    box(f, h, h)
    play(f, [
      ball({ half: fixed(h), speed: 2.1 }, { half: fixed(h), speed: 2.1, offset: 1 }),
      ball({ half: fixed(h), speed: 2.1, offset: 2 }, { half: fixed(h), speed: 2.1, offset: 1 }),
    ])
  },
  composing: (f) => {
    const h = f.compact ? 0.62 : 0.68
    const period = 4
    const { phase } = cycle(f.t, period)
    const b = ball({ half: fixed(h), speed: 1.9 }, { half: fixed(h), speed: 1.3, offset: 0.6 })
    box(f, h, h)
    // The path draws itself over the round, then wipes before the next one starts.
    const span = phase * period
    const steps = Math.max(2, Math.ceil(span * 30))
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const points = Array.from({ length: steps + 1 }, (_, k) => b.at(f.t - span + (k * span) / steps))
    f.ctx.lineWidth = strokeWidth(f, 0.02, 0.05)
    line(f, points, 0.4 * fade)
    play(f, [b])
  },
  breathing: (f) => {
    const half = (t: number) => 0.45 + 0.2 * breath(t)
    box(f, half(f.t), half(f.t))
    play(f, [ball({ half, speed: 0.6 }, { half, speed: 0.45, offset: 0.6 }, (t) => t)])
  },
  shaping: (f) => {
    const shape = shapeMorph(f.t)
    const s = space(f)
    const R = 0.72
    f.ctx.lineWidth = strokeWidth(f, 0.018, 0.045)
    f.ctx.globalAlpha = 0.25
    f.ctx.beginPath()
    for (let k = 0; k <= 72; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 72
      f.ctx.lineTo(s.x(Math.cos(a) * R * shape(a)), s.y(Math.sin(a) * R * shape(a)))
    }
    f.ctx.stroke()
    // The ball cuts chords across the shape, three eighths of a turn per bounce, tracing a star.
    const hop = 0.3
    const inner = R - radius(f)
    const corner = (i: number): Point => {
      const a = -Math.PI / 2 + i * (3 / 8) * TAU
      const k = shapeMorph(i * hop)(a) * inner
      return [Math.cos(a) * k, Math.sin(a) * k]
    }
    const at = (t: number): Point => {
      const { index, phase } = cycle(t, hop)
      const [a, b] = [corner(index), corner(index + 1)]
      return [lerp(a[0], b[0], phase), lerp(a[1], b[1], phase)]
    }
    const hits = (t: number): Hit[] => {
      const { index, phase } = cycle(t, hop)
      return [0, 1]
        .map((back) => ({ i: index - back, age: (phase + back) * hop }))
        .filter(({ age }) => age < FLASH_LIFE)
        .map(({ i, age }) => {
          const p = corner(i)
          const d = Math.hypot(...p) || 1
          return { at: p, normal: [p[0] / d, p[1] / d] as Point, age }
        })
    }
    play(f, [{ at, hits }])
  },
}

export const ricochet: SpinnerSet = {
  id: 'ricochet',
  label: 'Ricochet',
  icon: { state: 'working', t: 0.55 },
  blurbs: {
    working: 'a ball ricochets around a box, sparking off the walls',
    searching: 'it zips wall to wall while sweeping up and down',
    solving: 'wild bounces narrow to a straight rally',
    listening: 'the box swells with the voice',
    connecting: 'a rally between two walls that close in',
    weaving: 'two balls cross paths as they ricochet',
    composing: 'the bounce path draws itself across the box',
    breathing: 'a slow ball drifts in a breathing box',
    shaping: 'it cuts a star inside a circle, a triangle, a square',
  },
  draw(state, f) {
    RALLIES[state](f)
  },
}
