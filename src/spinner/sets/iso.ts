import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Column height at grid cell (i, j) of an n × n block. */
type Skyline = (i: number, j: number, n: number, t: number) => number

const GAP = 0.06
/** Shading per face; the top catches the most light. */
const TOP = 1
const RIGHT = 0.55
const LEFT = 0.3

/** Clears the column's silhouette before shading its faces, so nearer columns hide farther ones. */
function column(f: Frame, i: number, j: number, n: number, h: number) {
  if (h <= 0.005) return
  const s = space(f)
  const c = f.compact ? 0.5 : 0.36
  const pt = (x: number, y: number, z: number): [number, number] => [
    s.x((x - y) * Math.cos(Math.PI / 6) * c),
    s.y((x + y - n) * 0.5 * c + 0.25 - z),
  ]
  const [x0, x1, y0, y1] = [i + GAP, i + 1 - GAP, j + GAP, j + 1 - GAP]
  const face = (points: [number, number][], alpha: number) => {
    f.ctx.globalAlpha = alpha
    f.ctx.beginPath()
    points.forEach(([x, y]) => f.ctx.lineTo(x, y))
    f.ctx.closePath()
    f.ctx.fill()
  }
  f.ctx.globalCompositeOperation = 'destination-out'
  face([pt(x0, y0, h), pt(x1, y0, h), pt(x1, y0, 0), pt(x1, y1, 0), pt(x0, y1, 0), pt(x0, y1, h)], 1)
  f.ctx.globalCompositeOperation = 'source-over'
  face([pt(x1, y0, 0), pt(x1, y1, 0), pt(x1, y1, h), pt(x1, y0, h)], RIGHT)
  face([pt(x0, y1, 0), pt(x1, y1, 0), pt(x1, y1, h), pt(x0, y1, h)], LEFT)
  face([pt(x0, y0, h), pt(x1, y0, h), pt(x1, y1, h), pt(x0, y1, h)], TOP)
}

function fromCenter(i: number, j: number, n: number) {
  const c = (n - 1) / 2
  return Math.max(Math.abs(i - c), Math.abs(j - c)) / c
}

const PROFILES: ((d: number) => number)[] = [(d) => 1 - d * 0.75, (d) => 0.25 + d * 0.75, () => 0.6]

const SKYLINES: Record<SpinnerState, Skyline> = {
  working: (i, j, _, t) => 0.12 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3 - (i + j) * 1.1)),
  searching: (i, j, n, t) => {
    const c = (n - 1) / 2
    const px = c + c * 1.1 * Math.cos(t * 1.5)
    const py = c + c * 1.1 * Math.sin(t * 1.5)
    return 0.08 + 0.5 * Math.exp(-((i - px) ** 2 + (j - py) ** 2) * 1.5)
  },
  solving: (i, j, n, t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const tick = Math.floor(t / 0.2)
    return lerp(0.05 + hash(index, i, j, tick) * 0.55, 0.12 + 0.45 * (1 - fromCenter(i, j, n)), settle)
  },
  listening: (i, j, n, t) => 0.06 + 0.55 * level(t, i * n + j),
  connecting: (i, j, _, t) => {
    const e = envelope(cycle(t, 3.2).phase, 0.4, 0.7)
    return 0.08 + (i === j ? 0.5 : 0.08) * e
  },
  weaving: (i, j, _, t) => 0.3 + 0.22 * Math.sin(t * 2.5) * ((i + j) % 2 ? 1 : -1),
  composing: (i, j, n, t) => {
    const { phase } = cycle(t, 3.6)
    const order = (i + j + (i / n) * 0.5) / (2 * n - 1)
    return 0.42 * smooth((phase - order * 0.6) / 0.1) * (1 - smooth((phase - 0.85) / 0.15))
  },
  breathing: (_, __, ___, t) => 0.1 + 0.4 * breath(t),
  shaping: (i, j, n, t) => {
    const { index, phase } = cycle(t, 1.8)
    const d = fromCenter(i, j, n)
    return 0.55 * lerp(PROFILES[index % 3](d), PROFILES[(index + 1) % 3](d), smooth((phase - 0.6) / 0.4))
  },
}

export const iso: SpinnerSet = {
  id: 'iso',
  label: 'Iso',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'a wave rolls through the blocks',
    searching: 'a tall block circles the grid',
    solving: 'jumbled blocks settle into a pyramid',
    listening: 'blocks rise and fall with the voice',
    connecting: 'a wall rises from corner to corner',
    weaving: 'alternate blocks rise and sink',
    composing: 'a city goes up block by block',
    breathing: 'the whole block swells and settles',
    shaping: 'a pyramid, a bowl, a plateau',
  },
  draw(state, f) {
    const n = f.compact ? 2 : 3
    const cells = Array.from({ length: n * n }, (_, k) => [k % n, Math.floor(k / n)] as const)
    cells
      .sort(([ai, aj], [bi, bj]) => ai + aj - (bi + bj))
      .forEach(([i, j]) => column(f, i, j, n, SKYLINES[state](i, j, n, f.t)))
  },
}
