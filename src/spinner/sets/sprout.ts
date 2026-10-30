import { TAU, breath, clamp01, cycle, lerp, level, smooth } from '../math.js'
import { disc, line, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const GROUND = 0.82

/** Leaf as an ellipse whose base sits at (x, y) and points along `angle`. */
function leaf(f: Frame, x: number, y: number, length: number, angle: number, alpha = 1) {
  if (length <= 0.01) return
  const s = space(f)
  f.ctx.globalAlpha = alpha
  f.ctx.save()
  f.ctx.translate(s.x(x), s.y(y))
  f.ctx.rotate(angle)
  f.ctx.beginPath()
  f.ctx.ellipse(s.len(length / 2), 0, s.len(length / 2), s.len(length * 0.3), 0, 0, TAU)
  f.ctx.fill()
  f.ctx.restore()
}

/** Petals around (x, y); `squash` < 1 turns the head sideways. */
function flower(f: Frame, x: number, y: number, petals: number, length: number, spin: number, squash = 1) {
  const sq = Math.max(0.15, squash)
  for (let k = 0; k < petals; k++) {
    const a = spin + (k * TAU) / petals
    const dx = Math.cos(a) * sq
    const dy = Math.sin(a)
    leaf(f, x, y, length * Math.hypot(dx, dy), Math.atan2(dy, dx), 0.75)
  }
  disc(f, x, y, length * 0.32)
}

/** Curved stem from the ground at x0 to a tip; returns points along it. */
function stem(f: Frame, x0: number, tipX: number, tipY: number, grown = 1) {
  const points: [number, number][] = []
  const steps = 14
  for (let i = 0; i <= Math.ceil(steps * grown); i++) {
    const k = Math.min(grown, i / steps)
    points.push([lerp(x0, tipX, k * k), lerp(GROUND, tipY, k)])
  }
  line(f, points)
  return points
}

function branch(f: Frame, x: number, y: number, angle: number, length: number, depth: number, grown: number, alpha: number) {
  const reach = clamp01(grown * 3 - (3 - depth))
  if (reach <= 0) return
  const ex = x + Math.cos(angle) * length * reach
  const ey = y + Math.sin(angle) * length * reach
  line(f, [[x, y], [ex, ey]], alpha)
  if (depth > 1 && reach >= 1) {
    branch(f, ex, ey, angle - 0.55, length * 0.68, depth - 1, grown, alpha)
    branch(f, ex, ey, angle + 0.55, length * 0.68, depth - 1, grown, alpha)
  } else if (depth === 1) {
    leaf(f, ex, ey, 0.28 * reach, angle, 0.8 * alpha)
  }
}

const SPROUTS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const sway = Math.sin(f.t * 1.5) * 0.15
    stem(f, 0, sway, -0.55)
    leaf(f, sway * 0.3, 0.25, 0.6, -0.5 + Math.sin(f.t * 2.3) * 0.25)
    leaf(f, sway * 0.6, -0.1, 0.52, Math.PI + 0.5 + Math.sin(f.t * 2.1 + 1) * 0.25)
    leaf(f, sway, -0.55, 0.42, -Math.PI / 2 + Math.sin(f.t * 2) * 0.3)
  },
  searching: (f) => {
    const turn = Math.sin(f.t * 1.4)
    const headX = turn * 0.18
    stem(f, 0, headX, -0.3)
    flower(f, headX, -0.3, 10, 0.48, 0, Math.cos(turn * 1.2))
  },
  solving: (f) => {
    const { phase } = cycle(f.t, 3.2)
    const bloom = smooth((phase - 0.45) / 0.3)
    const fade = 1 - smooth((phase - 0.9) / 0.1)
    stem(f, 0, 0, -0.25)
    leaf(f, 0, 0.35, 0.5, -0.6)
    if (bloom < 0.05) leaf(f, 0, -0.2, 0.45, -Math.PI / 2 + Math.sin(f.t * 12) * 0.1 * (1 - bloom))
    else flower(f, 0, -0.32, 6, 0.55 * bloom * fade + 0.05, f.t * 0.2)
  },
  listening: (f) => {
    const blades = f.compact ? 3 : 5
    for (let i = 0; i < blades; i++) {
      const x0 = lerp(-0.6, 0.6, i / (blades - 1))
      const bend = level(f.t, i) * 0.45 * (i % 2 ? 1 : -1)
      stem(f, x0, x0 + bend, -0.6 + 0.25 * Math.abs(x0))
    }
  },
  connecting: (f) => {
    const { phase } = cycle(f.t, 3.4)
    const grown = smooth(phase / 0.7)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const vine = (u: number): [number, number] => [lerp(-0.8, 0.8, u), GROUND - Math.sin(u * Math.PI) * 1.1]
    const count = 30
    const points = Array.from({ length: Math.ceil(count * grown) + 1 }, (_, i) => vine(Math.min(grown, i / count)))
    line(f, points, fade)
    for (let k = 1; k < 6; k++) {
      const u = k / 6
      if (u > grown) break
      const [x, y] = vine(u)
      leaf(f, x, y, 0.34 * smooth((grown - u) * 6), k % 2 ? -0.9 : -2.2, fade * 0.8)
    }
  },
  weaving: (f) => {
    stem(f, 0, 0, -0.85)
    for (let j = 0; j < 2; j++) {
      const points = Array.from({ length: 25 }, (_, i): [number, number] => {
        const u = i / 24
        return [Math.sin(u * TAU * 1.5 + f.t * 2 + j * Math.PI) * 0.32, lerp(GROUND, -0.85, u)]
      })
      line(f, points, j ? 0.5 : 1)
    }
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 4.2)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    branch(f, 0, GROUND, -Math.PI / 2, 0.6, f.compact ? 2 : 3, smooth(phase / 0.75), fade)
  },
  breathing: (f) => {
    const b = breath(f.t)
    stem(f, 0, 0, -0.2)
    leaf(f, 0, 0.4, 0.5, -0.5)
    flower(f, 0, -0.3, 7, 0.25 + 0.38 * b, f.t * 0.1)
  },
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const petals = [3, 4, 5, 6][index % 4]
    const grow = smooth(phase / 0.25) * (1 - smooth((phase - 0.85) / 0.15))
    stem(f, 0, 0, -0.2)
    flower(f, 0, -0.3, petals, 0.18 + 0.5 * grow, -Math.PI / 2)
  },
}

export const sprout: SpinnerSet = {
  id: 'sprout',
  label: 'Sprout',
  icon: { state: 'breathing', t: 2.9 },
  blurbs: {
    working: 'a seedling sways in the breeze',
    searching: 'a sunflower turns its head',
    solving: 'a trembling bud bursts into bloom',
    listening: 'grass bends with the voice',
    connecting: 'a vine arches across and leafs out',
    weaving: 'two tendrils climb a stake',
    composing: 'a tree grows branch by branch',
    breathing: 'a flower opens and closes',
    shaping: 'three, four, five, six petals',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.045, 0.09)
    SPROUTS[state](f)
  },
}
