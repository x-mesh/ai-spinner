import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc, space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Dune {
  /** Heap height above the floor at x. */
  heap: (x: number) => number
  grains?: Point[]
}

const FLOOR = 0.75
const SPOUT = -0.85

/** A pile at the angle of repose: steep sides, rounded top and foot. */
function pile(x: number, center: number, height: number) {
  return height * smooth(1 - Math.abs(x - center) / (height * 1.6 + 0.1))
}

/** Grains falling from the spout onto whatever the heap is at x. */
function pour(x: number, t: number, heap: (x: number) => number, count = 9): Point[] {
  const land = FLOOR - heap(x)
  return Array.from({ length: count }, (_, k): Point => {
    const age = (t * 1.6 + k / count) % 1
    return [x + (hash(k) - 0.5) * 0.05, lerp(SPOUT, land, age * age)]
  })
}

function dune(f: Frame, { heap, grains = [] }: Dune) {
  const s = space(f)
  const samples = f.compact ? 16 : 40
  f.ctx.globalAlpha = 1
  f.ctx.beginPath()
  f.ctx.moveTo(s.x(-0.85), s.y(FLOOR))
  for (let i = 0; i <= samples; i++) {
    const x = lerp(-0.85, 0.85, i / samples)
    f.ctx.lineTo(s.x(x), s.y(FLOOR - heap(x)))
  }
  f.ctx.lineTo(s.x(0.85), s.y(FLOOR))
  f.ctx.closePath()
  f.ctx.fill()
  grains.forEach(([x, y]) => disc(f, x, y, f.compact ? 0.07 : 0.032))
}

const PROFILES: ((x: number) => number)[] = [
  (x) => smooth(1 - Math.abs(x) / 0.75),
  (x) => Math.sqrt(Math.max(0, 1 - (x / 0.7) ** 2)),
  (x) => smooth((0.55 - Math.abs(x)) / 0.2),
]

const DUNES: Record<SpinnerState, (t: number) => Dune> = {
  working: (t) => {
    const { phase } = cycle(t, 3.6)
    const h = 0.55 * smooth(phase / 0.8) * (1 - smooth((phase - 0.88) / 0.12))
    const heap = (x: number) => pile(x, 0, h)
    return { heap, grains: phase < 0.8 ? pour(0, t, heap) : [] }
  },
  searching: (t) => {
    const at = Math.sin(t * 0.9) * 0.4
    const heap = (x: number) => pile(x, Math.sin((t - 0.6) * 0.9) * 0.4, 0.35)
    return { heap, grains: pour(at, t, heap) }
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const heap = (x: number) => pile(x, 0, 0.35)
    return {
      heap,
      grains: Array.from({ length: 12 }, (_, k): Point => {
        const x = lerp(-0.5, 0.5, k / 11)
        return [lerp(hash(index, k) * 1.4 - 0.7, x, settle), lerp(hash(index, k, 1) * 1.1 - 0.75, FLOOR - heap(x) - 0.04, settle)]
      }),
    }
  },
  listening: (t) => ({ heap: (x) => pile(x, 0, 0.3) + 0.12 * level(t, 0) * (0.5 + 0.5 * Math.sin(x * 9 - t * 4)) }),
  connecting: (t) => {
    const h = 0.45 * envelope(cycle(t, 3.4).phase, 0.4, 0.7) + 0.05
    const heap = (x: number) => Math.max(pile(x, -0.42, h), pile(x, 0.42, h))
    return { heap, grains: [...pour(-0.42, t, heap, 6), ...pour(0.42, t + 0.3, heap, 6)] }
  },
  weaving: (t) => {
    const swing = Math.sin(t * 1.2)
    const heap = (x: number) => Math.max(pile(x, -0.4, 0.3 + 0.15 * swing), pile(x, 0.4, 0.3 - 0.15 * swing))
    return { heap, grains: pour(Math.cos(t * 1.2) > 0 ? -0.4 : 0.4, t, heap, 7) }
  },
  composing: (t) => {
    const { phase } = cycle(t, 4)
    const layers = Math.min(3, phase / 0.25)
    const h = 0.18 * (Math.floor(layers) + smooth((layers % 1) / 0.6)) * (1 - smooth((phase - 0.88) / 0.12))
    const heap = (x: number) => pile(x, 0, h)
    return { heap, grains: phase < 0.75 ? pour(0, t, heap, 7) : [] }
  },
  breathing: (t) => ({ heap: (x) => pile(x, 0, 0.18 + 0.27 * breath(t)) }),
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    return { heap: (x) => 0.45 * lerp(PROFILES[index % 3](x), PROFILES[(index + 1) % 3](x), blend) }
  },
}

export const sand: SpinnerSet = {
  id: 'sand',
  label: 'Sand',
  icon: { state: 'working', t: 2.2 },
  blurbs: {
    working: 'a stream of sand builds a heap, then it drains away',
    searching: 'the pour wanders and the heap follows',
    solving: 'scattered grains settle onto the heap',
    listening: 'ripples run over the dune with the voice',
    connecting: 'two heaps grow until they join',
    weaving: 'the pour switches sides as heaps trade height',
    composing: 'the heap builds up layer by layer',
    breathing: 'the dune rises and sinks',
    shaping: 'a heap, a dome, a mesa',
  },
  draw(state, f) {
    dune(f, DUNES[state](f.t))
  },
}
