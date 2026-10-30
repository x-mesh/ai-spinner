import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Bubble = [x: number, y: number, r: number, alpha?: number]

function bubbles(f: Frame, list: Bubble[]) {
  const s = space(f)
  const k = f.compact ? 1.4 : 1
  for (const [x, y, r, alpha = 1] of list) {
    if (r <= 0.005 || alpha <= 0.01) continue
    f.ctx.globalAlpha = alpha
    f.ctx.beginPath()
    f.ctx.arc(s.x(x), s.y(y), s.len(r * k), 0, TAU)
    f.ctx.stroke()
  }
}

/** A bubble at life p: it beads up from the bottom, wobbles up and pops near the top. */
function rise(x: number, r: number, p: number, wobble: number): Bubble {
  const grow = smooth(p / 0.08)
  const pop = smooth((p - 0.9) / 0.1)
  return [x + 0.06 * Math.sin(wobble), lerp(0.85, -0.75, p), r * grow * (1 + pop * 0.6), 1 - pop]
}

function stream(t: number, every: number, life: number, place: (k: number, p: number, age: number) => Bubble) {
  const last = Math.floor(t / every)
  const list: Bubble[] = []
  for (let k = last - Math.ceil(life / every); k <= last; k++) {
    const age = t - k * every
    if (age >= 0 && age < life) list.push(place(k, age / life, age))
  }
  return list
}

function honeycomb(radius: number): [number, number][] {
  return [[0, 0], ...Array.from({ length: 6 }, (_, k): [number, number] => [Math.cos((k * TAU) / 6) * radius, Math.sin((k * TAU) / 6) * radius])]
}

const FIZZES: Record<SpinnerState, (t: number, compact: boolean) => Bubble[]> = {
  working: (t, compact) =>
    stream(t, compact ? 0.4 : 0.22, 1.5, (k, p, age) => rise((hash(k) - 0.5) * 0.9, 0.05 + 0.07 * hash(k, 1) + 0.03 * p, p, age * 7 + k)),
  searching: (t) => {
    const at = (time: number): [number, number] => [0.5 * Math.sin(time * 1.1), 0.35 * Math.sin(time * 1.7 + 1)]
    return [[...at(t), 0.26], ...[1, 2, 3].map((k): Bubble => [...at(t - k * 0.22), 0.07 - k * 0.012])]
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return honeycomb(0.42).map(([x, y], k): Bubble => [
      lerp(hash(index, k) * 1.2 - 0.6, x, settle) + 0.04 * Math.sin(t * 4 + k) * (1 - settle),
      lerp(hash(index, k, 1) * 1.2 - 0.6, y, settle),
      0.2,
    ])
  },
  listening: (t, compact) => {
    const n = compact ? 3 : 4
    return Array.from({ length: n }, (_, k): Bubble => [lerp(-0.6, 0.6, k / (n - 1)), 0, 0.05 + 0.15 * level(t, k)])
  },
  connecting: (t) => {
    const gap = lerp(0.45, 0.22, envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return [[-gap, 0, 0.3], [gap, 0, 0.3]]
  },
  weaving: (t, compact) =>
    stream(t, compact ? 0.3 : 0.16, 1.6, (k, p) => {
      const a = p * 8 + (k % 2) * Math.PI
      const near = 0.5 + 0.5 * Math.cos(a)
      return [0.35 * Math.sin(a), lerp(0.8, -0.8, p), 0.05 + 0.05 * near, (0.4 + 0.6 * near) * (1 - smooth((p - 0.9) / 0.1))]
    }),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const pop = smooth((phase - 0.85) / 0.15)
    return honeycomb(0.42).map(([x, y], k): Bubble => [x, y, 0.2 * smooth((phase - k * 0.09) / 0.1) * (1 + pop * 0.5), 1 - pop])
  },
  breathing: (t) => {
    const b = breath(t)
    return [[0, 0, 0.25 + 0.4 * b], [0.18 * b, -0.18 * b, 0.06 + 0.04 * b]]
  },
  shaping: (t, compact) => {
    const shape = shapeMorph(t)
    const n = compact ? 6 : 10
    return Array.from({ length: n }, (_, k): Bubble => {
      const a = -Math.PI / 2 + (k * TAU) / n + t * 0.3
      const r = 0.62 * shape(a)
      return [Math.cos(a) * r, Math.sin(a) * r, compact ? 0.1 : 0.09]
    })
  },
}

export const fizz: SpinnerSet = {
  id: 'fizz',
  label: 'Fizz',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'bubbles stream up and pop',
    searching: 'a big bubble wanders with a trail of small ones',
    solving: 'jostling bubbles pack into foam',
    listening: 'bubbles swell with the voice',
    connecting: 'two bubbles press together and part',
    weaving: 'bubbles rise in a double helix',
    composing: 'foam builds up bubble by bubble, then pops',
    breathing: 'a bubble inflates and deflates',
    shaping: 'bubbles ring a circle, a triangle, a square',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.025, 0.07)
    bubbles(f, FIZZES[state](f.t, f.compact))
  },
}
