import { TAU, breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { inkRgb, scratch, scratchResolution } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Metaball at (x, y) in unit space; overlapping balls merge into one surface. */
type Ball = [x: number, y: number, r: number]

/** Unit-space span covered by the canvas: the 0.4 × size unit fits 2.5 times. */
const SPAN = 2.5

function render(f: Frame, balls: Ball[]) {
  const resolution = scratchResolution(f)
  const target = scratch(resolution)
  if (!target) return
  const [r, g, b] = inkRgb(f)
  const data = target.image.data
  const step = SPAN / resolution
  for (let py = 0; py < resolution; py++) {
    const v = -SPAN / 2 + (py + 0.5) * step
    for (let px = 0; px < resolution; px++) {
      const u = -SPAN / 2 + (px + 0.5) * step
      let field = 0
      for (const [x, y, radius] of balls) {
        const dx = u - x
        const dy = v - y
        field += (radius * radius) / (dx * dx + dy * dy + 1e-6)
      }
      const i = (py * resolution + px) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = smooth((field - 0.85) / 0.3) * 255
    }
  }
  target.ctx.putImageData(target.image, 0, 0)
  f.ctx.drawImage(target.canvas, 0, 0, f.size, f.size)
}

const SHAPES: Ball[][] = [
  [0, 1, 2, 3].map((): Ball => [0, 0, 0.275]),
  [...[0, 1, 2].map((k): Ball => [Math.cos(-Math.PI / 2 + (k * TAU) / 3) * 0.34, Math.sin(-Math.PI / 2 + (k * TAU) / 3) * 0.34 + 0.06, 0.3]), [0, 0.06, 0.12]],
  [0, 1, 2, 3].map((k): Ball => [Math.cos(Math.PI / 4 + (k * TAU) / 4) * 0.36, Math.sin(Math.PI / 4 + (k * TAU) / 4) * 0.36, 0.28]),
]

const GOOS: Record<SpinnerState, (t: number) => Ball[]> = {
  working: (t) =>
    [0, 1, 2].map((k) => {
      const a = t * 1.3 + (k * TAU) / 3
      const d = 0.3 + 0.22 * Math.sin(t * 1.7 + k * 2)
      return [Math.cos(a) * d, Math.sin(a) * d, 0.3]
    }),
  searching: (t) => {
    const a = t * 1.6
    const d = 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.3))
    return [[0, 0, 0.42], [Math.cos(a) * d, Math.sin(a) * d, 0.2]]
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3)
    const settle = smooth((phase - 0.3) / 0.45)
    const jitter = Math.floor(t / 0.25)
    return [0, 1, 2, 3, 4].map((j) => [
      lerp(hash(index, j, jitter, 1) * 1.5 - 0.75, 0, settle),
      lerp(hash(index, j, jitter, 2) * 1.5 - 0.75, 0, settle),
      0.18,
    ])
  },
  listening: (t) => [
    [0, 0, 0.35],
    ...[0, 1, 2, 3].map((k): Ball => {
      const a = (k * TAU) / 4 + t * 0.3
      const d = 0.25 + 0.5 * level(t, k)
      return [Math.cos(a) * d, Math.sin(a) * d, 0.16]
    }),
  ],
  connecting: (t) => {
    const x = 0.62 - 0.45 * envelope(cycle(t, 3).phase, 0.4, 0.7)
    return [[-x, 0, 0.3], [x, 0, 0.3]]
  },
  weaving: (t) =>
    [0, Math.PI].map((offset): Ball => {
      const s = t * 1.8 + offset
      const d = 1 + Math.sin(s) ** 2
      return [(Math.cos(s) / d) * 0.8, ((Math.sin(s) * Math.cos(s)) / d) * 1.1, 0.28]
    }),
  composing: (t) => {
    const { phase } = cycle(t, 4)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const drops = 4
    const balls: Ball[] = []
    let landed = 0
    for (let j = 0; j < drops; j++) {
      const p = (phase - j * 0.18) / 0.18
      if (p >= 1) landed++
      else if (p > 0) balls.push([0, lerp(-0.95, 0.35, p * p), 0.14])
    }
    balls.push([0, 0.35, (0.18 + 0.06 * landed) * fade + 0.02])
    return balls
  },
  breathing: (t) => {
    const b = breath(t)
    return [[0, 0, 0.3 + 0.15 * b], [-0.62, 0, 0.12], [0.62, 0, 0.12]]
  },
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = SHAPES[index % SHAPES.length]
    const to = SHAPES[(index + 1) % SHAPES.length]
    return from.map(([x, y, r], k) => [lerp(x, to[k][0], blend), lerp(y, to[k][1], blend), lerp(r, to[k][2], blend)])
  },
}

export const goo: SpinnerSet = {
  id: 'goo',
  label: 'Goo',
  icon: { state: 'connecting', t: 2.4 },
  blurbs: {
    working: 'three drops churn and merge',
    searching: 'a droplet strays and is pulled back',
    solving: 'scattered beads gather into one drop',
    listening: 'the goo reaches out with the voice',
    connecting: 'two drops neck together and part',
    weaving: 'two drops pass through each other',
    composing: 'drips fall and fill a puddle',
    breathing: 'a drop swells until it swallows its neighbors',
    shaping: 'circle, triangle, square in liquid',
  },
  draw: (state, f) => render(f, GOOS[state](f.t)),
}
