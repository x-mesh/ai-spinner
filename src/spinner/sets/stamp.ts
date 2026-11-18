import { TAU, breath, cycle, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc, line, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Press {
  /** Height above the floor, in unit space. */
  lift: number
  /** 0 at rest; positive right after impact, when the block squashes flat and wide. */
  squash: number
  /** Seconds since the last impact, or Infinity before the first one. */
  age: number
}

const SLAM = 0.11
const REST = 0.22
const DUST_LIFE = 0.45

/** One press of `duration` seconds, `s` seconds in: it lands at s = 0, rests, rises to `top`, winds up and slams. */
function press(s: number, duration: number, top: number): Press {
  const squash = 0.42 * Math.exp(-9 * s) * Math.cos(28 * s)
  const fall = duration - SLAM
  if (s < REST) return { lift: 0, squash, age: s }
  if (s < fall) {
    const rise = smooth((s - REST) / ((fall - REST) * 0.7))
    const windup = smooth((s - (fall - 0.18)) / 0.18)
    return { lift: top * (rise + 0.12 * windup), squash, age: s }
  }
  const k = (s - fall) / SLAM
  return { lift: top * 1.12 * (1 - k * k), squash: 0, age: s }
}

function repeat(t: number, duration: number, top: number, offset = 0) {
  const { index, phase } = cycle(t - offset, duration)
  return { ...press(phase * duration, duration, top), index }
}

interface Block {
  x: number
  press: Press
  w: number
  h: number
  /** Turns the whole press so its "down" points elsewhere; 0 slams onto the floor below. */
  turn?: number
  /** Unit-space y of the surface it lands on, in the press's own frame. */
  floor?: number
  /** Outline radius function for shaped blocks; rectangles when absent. */
  shape?: (a: number) => number
  dust?: number
}

const FLOOR = 0.62

function block(f: Frame, b: Block) {
  const s = space(f)
  const { x, press: p, w, h, turn = 0, floor = FLOOR, shape, dust = 1 } = b
  const c = f.size / 2
  f.ctx.save()
  f.ctx.translate(c, c)
  f.ctx.rotate(turn)
  f.ctx.translate(-c, -c)
  const sw = w * (1 + 0.6 * p.squash)
  const sh = h * (1 - p.squash)
  const bottom = floor - p.lift
  f.ctx.globalAlpha = 1
  f.ctx.beginPath()
  if (shape) {
    const r = h / 2
    for (let k = 0; k <= 48; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 48
      const d = r * shape(a)
      f.ctx.lineTo(s.x(x + Math.cos(a) * d * (sw / h)), s.y(bottom - sh / 2 + Math.sin(a) * d * (sh / h)))
    }
  } else {
    f.ctx.roundRect(s.x(x - sw / 2), s.y(bottom - sh), s.len(sw), s.len(sh), s.len(Math.min(sw, sh) * 0.18))
  }
  f.ctx.fill()
  if (p.age < DUST_LIFE && dust > 0) {
    const q = p.age / DUST_LIFE
    const n = f.compact ? 2 : 4
    for (let k = 0; k < n; k++) {
      const side = k % 2 ? 1 : -1
      const v = 0.5 + 0.5 * hash(k, 3)
      const dx = side * (sw / 2 + (0.1 + 0.9 * v) * p.age * 1.6 * dust)
      const dy = -(1.4 * v * p.age - 3 * p.age * p.age) * dust
      disc(f, x + dx, floor + Math.min(0, dy) - 0.03, (f.compact ? 0.09 : 0.06) * (1 - 0.5 * q), 0.85 * (1 - q))
    }
    // The floor flashes outward from the point of impact.
    f.ctx.lineWidth = strokeWidth(f, 0.035, 0.07) * (1 - 0.6 * q)
    const reach = (sw / 2 + 0.35 * smooth(q * 2.5)) * Math.min(1, dust + 0.3)
    line(f, [[x - reach, floor + 0.04], [x + reach, floor + 0.04]], 0.7 * (1 - q))
  }
  f.ctx.restore()
}

function floor(f: Frame, from = -0.9, to = 0.9) {
  f.ctx.lineWidth = strokeWidth(f, 0.018, 0.045)
  line(f, [[from, FLOOR + 0.04], [to, FLOOR + 0.04]], 0.25)
}

function size(f: Frame, w: number, h: number) {
  return f.compact ? { w: w * 1.3, h: h * 1.3 } : { w, h }
}

const SOLVE_TAPS = [0.4, 0.4, 0.4, 1.3]
const SOLVE_TOPS = [0.12, 0.17, 0.22, 0.85]
const SOLVE_ROUND = SOLVE_TAPS.reduce((a, b) => a + b)

const STAMPS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    floor(f)
    block(f, { x: 0, press: repeat(f.t, 1.1, 0.7), ...size(f, 0.62, 0.42) })
  },
  searching: (f) => {
    const duration = 1
    const p = repeat(f.t, duration, 0.5)
    const spot = (i: number) => (hash(i, 5) - 0.5) * 0.9
    // It slides to the next spot while lifted, so each landing is somewhere new.
    const slide = smooth((cycle(f.t, duration).phase * duration - REST) / 0.45)
    floor(f)
    block(f, { x: lerp(spot(p.index), spot(p.index + 1), slide), press: p, ...size(f, 0.42, 0.36) })
  },
  solving: (f) => {
    const { phase } = cycle(f.t, SOLVE_ROUND)
    let s = phase * SOLVE_ROUND
    let k = 0
    while (k < SOLVE_TAPS.length - 1 && s >= SOLVE_TAPS[k]) s -= SOLVE_TAPS[k++]
    // Each tap lands with the force of the lift that came before it.
    const landed = SOLVE_TOPS[(k + SOLVE_TAPS.length - 1) % SOLVE_TAPS.length]
    const p = press(s, SOLVE_TAPS[k], SOLVE_TOPS[k])
    const scale = landed / SOLVE_TOPS[SOLVE_TOPS.length - 1]
    floor(f)
    block(f, { x: 0, press: { ...p, squash: p.squash * (0.3 + 0.7 * scale) }, ...size(f, 0.62, 0.42), dust: scale })
  },
  listening: (f) => {
    const n = f.compact ? 2 : 3
    const duration = 0.48
    floor(f)
    for (let k = 0; k < n; k++) {
      const offset = k * 0.15
      const index = Math.floor((f.t - offset) / duration)
      const top = 0.1 + 0.7 * level(index * duration, k)
      block(f, { x: lerp(-0.55, 0.55, k / (n - 1)), press: repeat(f.t, duration, top, offset), ...size(f, 0.3, 0.3), dust: top })
    }
  },
  connecting: (f) => {
    const p = repeat(f.t, 1.6, 0.42)
    for (const side of [-1, 1]) block(f, { x: 0, press: p, turn: (side * Math.PI) / 2, floor: 0, ...size(f, 0.55, 0.38), dust: 0.8 })
  },
  weaving: (f) => {
    const duration = 0.9
    floor(f)
    for (const [k, x] of [-0.33, 0.33].entries()) block(f, { x, press: repeat(f.t, duration, 0.55, (k * duration) / 2), ...size(f, 0.4, 0.38) })
  },
  composing: (f) => {
    const n = f.compact ? 3 : 4
    const duration = 0.7
    const spot = (k: number) => lerp(-0.6, 0.6, (((k % n) + n) % n) / (n - 1))
    const p = repeat(f.t, duration, 0.45)
    const k = ((p.index % n) + n) % n
    const s = cycle(f.t, duration).phase * duration
    const { w, h } = size(f, 0.3, 0.3)
    // Beat k lands on spot k and leaves a print; the prints wipe while it lifts off the last spot.
    const wipe = k === n - 1 ? smooth((s - REST) / (duration - REST - SLAM)) : 0
    f.ctx.lineWidth = strokeWidth(f, 0.02, 0.05)
    for (let m = 0; m <= k; m++) line(f, [[spot(m) - w / 2, FLOOR + 0.1], [spot(m) + w / 2, FLOOR + 0.1]], 0.55 * (1 - wipe))
    floor(f)
    const slide = smooth((s - REST) / 0.3)
    block(f, { x: lerp(spot(k), spot(k + 1), slide), press: p, w, h })
  },
  breathing: (f) => {
    const b = breath(f.t)
    floor(f)
    block(f, { x: 0, press: { lift: 0.45 * b, squash: 0.12 * (1 - b) ** 4, age: Infinity }, ...size(f, 0.62, 0.42) })
  },
  shaping: (f) => {
    const duration = 1.2
    const p = repeat(f.t, duration, 0.55)
    floor(f)
    // Morph while lifted, so each slam lands a new shape.
    const shape = shapeMorph(f.t + 0.6)
    block(f, { x: 0, press: p, ...size(f, 0.56, 0.56), shape })
  },
}

export const stamp: SpinnerSet = {
  id: 'stamp',
  label: 'Stamp',
  icon: { state: 'working', t: 1.12 },
  blurbs: {
    working: 'a block lifts, winds up and slams down',
    searching: 'it lands somewhere new each time',
    solving: 'small taps build up to one big slam',
    listening: 'hammers strike with the voice',
    connecting: 'two blocks clap together',
    weaving: 'two pistons pound in turn',
    composing: 'it stamps a row of prints, then wipes it',
    breathing: 'a slow, soft press',
    shaping: 'it slams down a circle, a triangle, a square',
  },
  draw(state, f) {
    STAMPS[state](f)
  },
}
