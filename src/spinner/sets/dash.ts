import { TAU, breath, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc, line, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Hop {
  from: Point
  to: Point
  /** Seconds since this hop began. */
  s: number
}

interface Dart {
  at: (t: number) => Point
  /** Landing spots whose impact ring is still spreading, with each ring's age in seconds. */
  rings: (t: number) => { at: Point; age: number }[]
}

/** Seconds spent pulling back before each launch. */
const WINDUP = 0.24
const PULLBACK = 0.14
/** Underdamped spring: a fast launch that overshoots the target and wobbles to rest. */
const OMEGA = 22
const ZETA = 0.45
const DAMPED = OMEGA * Math.sqrt(1 - ZETA * ZETA)
/** Time after launch when the spring first reaches the target, which is when the impact ring starts. */
const STRIKE = (Math.PI - Math.atan(Math.sqrt(1 - ZETA * ZETA) / ZETA)) / DAMPED
const RING_LIFE = 0.45

function spring(s: number) {
  const decay = Math.exp(-ZETA * OMEGA * s)
  return 1 - decay * (Math.cos(DAMPED * s) + (ZETA / Math.sqrt(1 - ZETA * ZETA)) * Math.sin(DAMPED * s))
}

function hopAt({ from, to, s }: Hop): Point {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-3) return from
  const back: Point = [from[0] - (dx / dist) * PULLBACK, from[1] - (dy / dist) * PULLBACK]
  if (s < WINDUP) {
    const k = smooth(s / WINDUP)
    return [lerp(from[0], back[0], k), lerp(from[1], back[1], k)]
  }
  const k = spring(s - WINDUP)
  return [lerp(back[0], to[0], k), lerp(back[1], to[1], k)]
}

/** Hop `i` leaves `target(i)` for `target(i + 1)`; one hop starts every `period` seconds, shifted by `offset`. */
function dart(period: number, target: (i: number) => Point, offset = 0, impact: (i: number) => boolean = () => true): Dart {
  const hop = (t: number, i: number): Hop => ({ from: target(i), to: target(i + 1), s: t - offset - i * period })
  const index = (t: number) => Math.floor((t - offset) / period)
  return {
    at: (t) => hopAt(hop(t, index(t))),
    rings: (t) => {
      const out: { at: Point; age: number }[] = []
      const last = index(t)
      for (let i = last - Math.ceil((WINDUP + STRIKE + RING_LIFE) / period); i <= last; i++) {
        const h = hop(t, i)
        const age = h.s - WINDUP - STRIKE
        const moved = Math.hypot(h.to[0] - h.from[0], h.to[1] - h.from[1]) > 1e-3
        if (moved && impact(i) && age >= 0 && age < RING_LIFE) out.push({ at: h.to, age })
      }
      return out
    },
  }
}

/** The puck smears along its recent path, so fast moves stretch it and still moments keep it round. */
function puck(f: Frame, path: (t: number) => Point, alpha = 1) {
  const s = space(f)
  const r = f.compact ? 0.22 : 0.15
  const ghosts = f.compact ? 2 : 4
  for (let k = ghosts; k > 0; k--) disc(f, ...path(f.t - k * 0.035), r * (1 - k * 0.1), (0.3 / k) * alpha)
  f.ctx.lineWidth = s.len(r * 2)
  line(f, [path(f.t - 0.03), path(f.t - 0.015), path(f.t)], alpha)
  disc(f, ...path(f.t), r, alpha)
}

function rings(f: Frame, d: Dart) {
  const s = space(f)
  const base = f.compact ? 0.22 : 0.15
  for (const { at, age } of d.rings(f.t)) {
    const p = age / RING_LIFE
    const grow = 1 - (1 - p) ** 3
    f.ctx.lineWidth = strokeWidth(f, 0.022, 0.06) * (1 - 0.5 * p)
    f.ctx.globalAlpha = 0.7 * (1 - p)
    f.ctx.beginPath()
    f.ctx.arc(s.x(at[0]), s.y(at[1]), s.len(base + grow * (f.compact ? 0.4 : 0.34)), 0, TAU)
    f.ctx.stroke()
  }
}

function play(f: Frame, darts: Dart[]) {
  darts.forEach((d) => rings(f, d))
  darts.forEach((d) => puck(f, d.at))
}

/** A random spot inside a disc of radius `r`, at least a third of the way out so hops stay long. */
function spot(i: number, r: number, salt = 0): Point {
  const a = hash(i, salt, 1) * TAU
  const d = r * (0.35 + 0.65 * Math.sqrt(hash(i, salt, 2)))
  return [Math.cos(a) * d, Math.sin(a) * d]
}

const SOLVE_PERIOD = 0.4
const SOLVE_HOPS = 9
const SOLVE_WILD = 5

const DASHES: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => play(f, [dart(0.95, (i) => spot(i, 0.6))]),
  searching: (f) =>
    play(f, [
      dart(0.62, (i) => {
        const a = i * 0.8 + (hash(i, 3) - 0.5) * 0.5
        const r = 0.45 + 0.2 * hash(i, 4)
        return [Math.cos(a) * r, Math.sin(a) * r]
      }),
    ]),
  solving: (f) => {
    // Hops early in each round land anywhere; the rest land on the center, so the puck snaps there and stops.
    const target = (i: number): Point => {
      const k = ((i % SOLVE_HOPS) + SOLVE_HOPS) % SOLVE_HOPS
      return k > 0 && k <= SOLVE_WILD ? spot(i, 0.65, 7) : [0, 0]
    }
    play(f, [dart(SOLVE_PERIOD, target)])
  },
  listening: (f) => {
    const n = f.compact ? 2 : 3
    const period = 0.5
    play(
      f,
      Array.from({ length: n }, (_, k) => {
        const x = lerp(-0.55, 0.55, k / (n - 1))
        return dart(period, (i) => [x, 0.4 - 0.9 * level(i * period, k)], k * 0.07)
      }),
    )
  },
  connecting: (f) => {
    const period = 1.6
    const side = (dir: number) => dart(period, (i) => [dir * (i % 2 ? (f.compact ? 0.22 : 0.15) : 0.62), 0], 0, (i) => i % 2 === 0)
    play(f, [side(-1), side(1)])
  },
  weaving: (f) => {
    const period = 0.9
    const zig = (dir: number) => (i: number): Point => [i % 2 ? 0.55 * dir : -0.55 * dir, i % 2 ? 0.38 : -0.38]
    play(f, [dart(period, zig(1)), dart(period, zig(-1), period / 2)])
  },
  composing: (f) => {
    const cols = f.compact ? 3 : 4
    const rows = f.compact ? 2 : 3
    const cells = cols * rows
    const period = 0.42
    const cell = (k: number): Point => [lerp(-0.6, 0.6, (k % cols) / (cols - 1)), lerp(-0.5, 0.5, Math.floor(k / cols) / (rows - 1))]
    const target = (i: number) => cell(((i % cells) + cells) % cells)
    const d = dart(period, target)
    const hopIndex = Math.floor(f.t / period)
    const k = ((hopIndex % cells) + cells) % cells
    const s = f.t - hopIndex * period
    // Hop k leaves cell k for cell k + 1; the last hop sweeps back to the start while every mark fades.
    const sweep = k === cells - 1
    const marks = sweep ? cells : k + 1 + (s > WINDUP + STRIKE ? 1 : 0)
    const fade = sweep ? 1 - smooth(s / period) : 1
    for (let m = 0; m < marks; m++) disc(f, ...cell(m), f.compact ? 0.1 : 0.06, 0.45 * fade)
    play(f, [d])
  },
  breathing: (f) => puck(f, (t) => [lerp(-0.45, 0.45, breath(t)), 0.08 * Math.sin(breath(t) * Math.PI)]),
  shaping: (f) => {
    const n = 12
    const period = 0.38
    const shape = shapeMorph(f.t)
    const s = space(f)
    f.ctx.lineWidth = strokeWidth(f, 0.018, 0.045)
    f.ctx.globalAlpha = 0.3
    f.ctx.beginPath()
    for (let k = 0; k <= 72; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 72
      f.ctx.lineTo(s.x(Math.cos(a) * 0.62 * shape(a)), s.y(Math.sin(a) * 0.62 * shape(a)))
    }
    f.ctx.stroke()
    const step = f.compact ? 2 : 1
    play(f, [
      dart(period * step, (i) => {
        const a = -Math.PI / 2 + (i * step * TAU) / n
        const r = 0.62 * shapeMorph(i * period * step)(a)
        return [Math.cos(a) * r, Math.sin(a) * r]
      }),
    ])
  },
}

export const dash: SpinnerSet = {
  id: 'dash',
  label: 'Dash',
  icon: { state: 'working', t: 0.38 },
  blurbs: {
    working: 'a puck winds up and darts from spot to spot',
    searching: 'it hops around in short bursts, checking each stop',
    solving: 'frantic dashes, then it snaps to the center',
    listening: 'pucks spring up with the voice',
    connecting: 'two pucks wind up and collide in the middle',
    weaving: 'two pucks zigzag past each other',
    composing: 'it hops along rows, leaving a mark at each stop',
    breathing: 'it glides slowly from side to side',
    shaping: 'it leaps between corners of a circle, a triangle, a square',
  },
  draw(state, f) {
    DASHES[state](f)
  },
}
