import { TAU, breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc, line, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Bolt {
  from: Point
  to: Point
  seed: number
  amp?: number
  /** Offset of the bolt's spine at u (0..1), for bolts that arc instead of running straight. */
  bow?: (u: number) => Point
  progress?: number
  alpha?: number
}

/** A new random shape every flicker; seeds derived from it redraw the whole bolt. */
function flicker(t: number, every = 0.09) {
  return Math.floor(t / every)
}

/** Jagged polyline pinned at both ends, drawn over a faint wide glow. */
function bolt(f: Frame, { from, to, seed, amp = 0.12, bow, progress = 1, alpha = 1 }: Bolt) {
  const n = f.compact ? 6 : 14
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const points: Point[] = []
  for (let i = 0; i <= Math.round(n * progress); i++) {
    const u = i / n
    const jag = (hash(seed, i) - 0.5) * 1.2 + (hash(seed, Math.floor(i / 3), 9) - 0.5) * 0.8
    const off = amp * Math.sin(Math.PI * u) * jag
    const [bx, by] = bow?.(u) ?? [0, 0]
    points.push([from[0] + dx * u - (dy / len) * off + bx, from[1] + dy * u + (dx / len) * off + by])
  }
  const width = f.ctx.lineWidth
  f.ctx.lineWidth = width * (f.compact ? 2.2 : 3.5)
  line(f, points, alpha * 0.15)
  f.ctx.lineWidth = width
  line(f, points, alpha)
}

function node(f: Frame, [x, y]: Point, scale = 1, alpha = 1) {
  disc(f, x, y, (f.compact ? 0.12 : 0.06) * scale, alpha)
}

const LEFT: Point = [-0.75, 0]
const RIGHT: Point = [0.75, 0]
const SIDES = [3, 4, 6]

const SPARKS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const tick = flicker(f.t)
    node(f, [0, 0], 1.6)
    for (let k = 0; k < 3; k++) {
      const a = f.t * 1.2 + (k * TAU) / 3
      const end: Point = [Math.cos(a) * 0.78, Math.sin(a) * 0.78]
      bolt(f, { from: [0, 0], to: end, seed: tick * 3 + k })
      node(f, end)
    }
  },
  searching: (f) => {
    const a = Math.sin(f.t * 1.3) * Math.PI * 0.8 - Math.PI / 2
    const end: Point = [Math.cos(a) * 0.78, Math.sin(a) * 0.78]
    node(f, [0, 0], 1.4)
    bolt(f, { from: [0, 0], to: end, seed: flicker(f.t), amp: 0.18 })
    node(f, end)
  },
  solving: (f) => {
    const { phase } = cycle(f.t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const tick = flicker(f.t)
    for (let k = 0; k < 3; k++) {
      bolt(f, { from: LEFT, to: RIGHT, seed: tick * 3 + k, amp: lerp(0.5, 0.03, settle), alpha: k === 0 ? 1 : 1 - settle })
    }
    node(f, LEFT)
    node(f, RIGHT)
  },
  listening: (f) => {
    const tick = flicker(f.t)
    const amp = 0.04 + 0.4 * level(f.t, 0)
    bolt(f, { from: LEFT, to: RIGHT, seed: tick, amp })
    bolt(f, { from: LEFT, to: RIGHT, seed: tick + 0.5, amp: amp * 0.7, alpha: 0.6 })
    node(f, LEFT)
    node(f, RIGHT)
  },
  connecting: (f) => {
    const e = envelope(cycle(f.t, 3.2).phase, 0.4, 0.7)
    const gap = lerp(0.75, 0.4, e)
    const tick = flicker(f.t)
    const a: Point = [-gap, 0]
    const b: Point = [gap, 0]
    const jump = smooth((e - 0.6) / 0.25)
    if (jump > 0.01) bolt(f, { from: a, to: b, seed: tick, amp: 0.2, alpha: jump })
    ;[a, b].forEach((p, side) => {
      const out = (hash(tick, side) - 0.5) * 2.4 + (side ? 0 : Math.PI)
      bolt(f, { from: p, to: [p[0] + Math.cos(out) * 0.2, p[1] + Math.sin(out) * 0.2], seed: tick + side, amp: 0.1, alpha: 1 - jump })
      node(f, p, 1.3)
    })
  },
  weaving: (f) => {
    const tick = flicker(f.t)
    ;[1, -1].forEach((sign, k) => {
      bolt(f, { from: LEFT, to: RIGHT, seed: tick * 2 + k, amp: 0.08, bow: (u) => [0, sign * 0.4 * Math.sin(Math.PI * u) * Math.sin(f.t * 2.2)] })
    })
    node(f, LEFT)
    node(f, RIGHT)
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const reach = smooth(phase / 0.6)
    const flash = phase > 0.6 ? 1 + 0.6 * (1 - smooth((phase - 0.6) / 0.15)) : 1
    node(f, LEFT, 1, fade)
    bolt(f, { from: LEFT, to: RIGHT, seed: flicker(f.t, 0.12), progress: reach, alpha: fade })
    if (reach >= 1) node(f, RIGHT, flash, fade)
  },
  breathing: (f) => {
    const glow = 0.35 + 0.65 * breath(f.t)
    bolt(f, { from: LEFT, to: RIGHT, seed: flicker(f.t, 0.25), amp: 0.08, alpha: glow })
    node(f, LEFT, 1, glow)
    node(f, RIGHT, 1, glow)
  },
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    const sides = SIDES[index % SIDES.length]
    const tick = flicker(f.t)
    const corner = (k: number): Point => {
      const a = -Math.PI / 2 + (k * TAU) / sides
      return [Math.cos(a) * 0.75, Math.sin(a) * 0.75]
    }
    for (let k = 0; k < sides; k++) {
      bolt(f, { from: corner(k), to: corner(k + 1), seed: tick * sides + k, amp: 0.1, alpha: swap })
      node(f, corner(k), 1, swap)
    }
  },
}

export const spark: SpinnerSet = {
  id: 'spark',
  label: 'Spark',
  icon: { state: 'working', t: 0.4 },
  blurbs: {
    working: 'three arcs crackle from the core',
    searching: 'an arc sweeps back and forth for a target',
    solving: 'wild arcs calm into one steady line',
    listening: 'the arc crackles with the voice',
    connecting: 'two poles close in until a spark jumps',
    weaving: 'two arcs braid between the poles',
    composing: 'an arc crawls across and strikes',
    breathing: 'a soft arc hums brighter and dimmer',
    shaping: 'arcs trace a triangle, a square, a hexagon',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.022, 0.07)
    SPARKS[state](f)
  },
}
