import { TAU, breath, clamp01, cycle, hash, lerp, level, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const FLOOR = 0.62

/** Ball at (x, y) in unit space; sx/sy squash and stretch it. */
function ball(f: Frame, x: number, y: number, r: number, sx = 1, sy = 1, alpha = 1) {
  const unit = f.size * 0.4
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  f.ctx.ellipse(f.size / 2 + x * unit, f.size / 2 + y * unit, r * sx * unit, r * sy * unit, 0, 0, TAU)
  f.ctx.fill()
}

/** Shadow under a ball that is `height` (0 = on the floor) above the floor. */
function shadow(f: Frame, x: number, r: number, height: number) {
  ball(f, x, FLOOR + 0.06, r * (1 - 0.4 * clamp01(height)), 1, 0.25, 0.18)
}

/** A ball that hops with phase p in [0, 1); squashes on contact. */
function hop(f: Frame, x: number, r: number, p: number, peak: number) {
  const h = Math.sin(p * Math.PI) * peak
  const squash = h < 0.06 ? 1 - h / 0.06 : 0
  shadow(f, x, r, h / peak)
  ball(f, x, FLOOR - r - h + squash * r * 0.2, r, 1 + 0.25 * squash, 1 - 0.25 * squash)
}

function row(count: number, gap: number) {
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * gap)
}

const SHAPES = [
  { w: 0.38, h: 0.38, round: 0.5 },
  { w: 0.38, h: 0.38, round: 0.15 },
  { w: 0.62, h: 0.26, round: 0.5 },
]

const BOUNCES: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const count = f.compact ? 2 : 3
    const r = f.compact ? 0.24 : 0.2
    row(count, f.compact ? 0.7 : 0.6).forEach((x, i) => hop(f, x, r, (f.t * 1.6 - i * 0.22 + 10) % 1, 0.9))
  },
  searching: (f) => {
    const r = 0.22
    for (let k = 2; k >= 0; k--) {
      const x = 0.62 * Math.sin(f.t * 2 - k * 0.15)
      if (k === 0) shadow(f, x, r, 0)
      ball(f, x, FLOOR - r - 0.2, r, 1, 1, k === 0 ? 1 : 0.35 - k * 0.1)
    }
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3)
    const settle = smooth((phase - 0.35) / 0.35)
    const jitter = Math.floor(f.t / 0.15)
    const r = f.compact ? 0.24 : 0.2
    row(f.compact ? 2 : 3, f.compact ? 0.7 : 0.55).forEach((x, i) => {
      const lx = hash(index, i, jitter, 1) * 1.4 - 0.7
      const ly = hash(index, i, jitter, 2) * 1.2 - 0.7
      ball(f, lerp(lx, x, settle), lerp(ly, 0, settle), r)
    })
  },
  listening: (f) => {
    const count = f.compact ? 2 : 3
    row(count, f.compact ? 0.7 : 0.55).forEach((x, i) => {
      const h = level(f.t, i) * 0.9
      const r = f.compact ? 0.22 : 0.2
      shadow(f, x, r, h)
      ball(f, x, FLOOR - r - h, r)
    })
  },
  connecting: (f) => {
    const count = f.compact ? 3 : 5
    const r = f.compact ? 0.22 : 0.15
    const pivot = -0.75
    const length = 1.0
    const swing = Math.sin(f.t * 3.2) * 0.65
    f.ctx.lineWidth = Math.max(0.75, f.size * 0.012)
    row(count, r * 2).forEach((x, i) => {
      const theta = i === 0 ? Math.min(0, swing) : i === count - 1 ? Math.max(0, swing) : 0
      const bx = x + Math.sin(theta) * length
      const by = pivot + Math.cos(theta) * length
      const unit = f.size * 0.4
      f.ctx.globalAlpha = 0.35
      f.ctx.beginPath()
      f.ctx.moveTo(f.size / 2 + x * unit, f.size / 2 + pivot * unit)
      f.ctx.lineTo(f.size / 2 + bx * unit, f.size / 2 + by * unit)
      f.ctx.stroke()
      ball(f, bx, by, r * 0.96)
    })
  },
  weaving: (f) => {
    const r = f.compact ? 0.2 : 0.15
    for (let i = 0; i < 3; i++) {
      const p = (f.t * 0.9 + i / 3) % 1
      const high = p < 0.5
      const k = high ? p * 2 : (p - 0.5) * 2
      const x = high ? lerp(0.5, -0.5, k) : lerp(-0.5, 0.5, k)
      const y = 0.4 - Math.sin(k * Math.PI) * (high ? 1.05 : 0.25)
      ball(f, x, y, r)
    }
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 4)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const r = f.compact ? 0.26 : 0.18
    const rows = f.compact ? [2, 1] : [3, 2, 1]
    let j = 0
    rows.forEach((count, tier) => {
      row(count, r * 2).forEach((x) => {
        const target = FLOOR - r - tier * r * 1.75
        const drop = smooth((phase - j * 0.1) / 0.12)
        if (drop > 0) ball(f, x, lerp(-1.3, target, drop), r, 1, 1, fade)
        j++
      })
    })
  },
  breathing: (f) => {
    const b = breath(f.t)
    const h = 0.15 + 0.35 * b
    shadow(f, 0, 0.28, h / 0.5)
    ball(f, 0, FLOOR - 0.28 - h, 0.28)
  },
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const a = SHAPES[index % SHAPES.length]
    const b = SHAPES[(index + 1) % SHAPES.length]
    const unit = f.size * 0.4
    const w = lerp(a.w, b.w, blend) * 2 * unit
    const h = lerp(a.h, b.h, blend) * 2 * unit
    const round = lerp(a.round, b.round, blend) * Math.min(w, h)
    f.ctx.beginPath()
    f.ctx.roundRect(f.size / 2 - w / 2, f.size / 2 - h / 2, w, h, round)
    f.ctx.fill()
  },
}

export const bounce: SpinnerSet = {
  id: 'bounce',
  label: 'Bounce',
  icon: { state: 'connecting', t: 0.4 },
  blurbs: {
    working: 'balls hop in a relay',
    searching: 'a ball rolls back and forth',
    solving: 'loose balls line up in a row',
    listening: 'balls jump with the voice',
    connecting: "a Newton's cradle",
    weaving: 'three balls in a juggling cascade',
    composing: 'balls drop and stack into a pyramid',
    breathing: 'a ball floats over its shadow',
    shaping: 'ball, block, pill',
  },
  draw: (state, f) => BOUNCES[state](f),
}
