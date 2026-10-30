import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc, line, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Web {
  nodes: Point[]
  /** Nodes closer than this are linked; links fade with distance. */
  reach?: number
  /** Opacity of node i, for nodes that appear or vanish. */
  presence?: (i: number) => number
}

function network(f: Frame, { nodes, reach = 0.6, presence = () => 1 }: Web) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1])
      const a = (1 - d / reach) * Math.min(presence(i), presence(j))
      if (a > 0.01) line(f, [nodes[i], nodes[j]], a)
    }
  }
  nodes.forEach(([x, y], i) => disc(f, x, y, (f.compact ? 0.1 : 0.05) * presence(i), presence(i)))
}

function ring(n: number, radius: number, turn = 0, cx = 0): Point[] {
  return Array.from({ length: n }, (_, k): Point => [cx + Math.cos(turn + (k * TAU) / n) * radius, Math.sin(turn + (k * TAU) / n) * radius])
}

function drift(n: number, t: number): Point[] {
  return Array.from({ length: n }, (_, k): Point => [
    0.62 * Math.sin(t * (0.4 + 0.13 * hash(k)) + k * 2.4),
    0.62 * Math.cos(t * (0.35 + 0.15 * hash(k, 1)) + k * 1.7),
  ])
}

const WEBS: Record<SpinnerState, (t: number, n: number) => Web> = {
  working: (t, n) => ({ nodes: drift(n, t) }),
  searching: (t, n) => ({ nodes: [...ring(n - 1, 0.6, 0.3), [0.5 * Math.sin(t * 1.3), 0.45 * Math.sin(t * 2.1)]], reach: 0.5 }),
  solving: (t, n) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const target = [[0, 0] as Point, ...ring(n - 1, 0.55, -Math.PI / 2)]
    return {
      nodes: target.map(([x, y], k): Point => [lerp(hash(index, k) * 1.4 - 0.7, x, settle), lerp(hash(index, k, 1) * 1.4 - 0.7, y, settle)]),
    }
  },
  listening: (t, n) => ({ nodes: ring(n, 0.55, t * 0.2), reach: 0.3 + 0.9 * level(t, 0) }),
  connecting: (t, n) => {
    const c = lerp(0.48, 0.2, envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    const half = Math.ceil(n / 2)
    return { nodes: [...ring(half, 0.25, t * 0.6, -c), ...ring(half, 0.25, -t * 0.6, c)], reach: 0.5 }
  },
  weaving: (t, n) => ({ nodes: [...ring(Math.floor(n / 2), 0.3, t * 0.8), ...ring(Math.ceil(n / 2), 0.68, -t * 0.5)], reach: 0.5 }),
  composing: (t, n) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return { nodes: drift(n, t * 0.3), presence: (i) => smooth((phase - (i / n) * 0.6) / 0.1) * fade }
  },
  breathing: (t, n) => {
    const k = 0.55 + 0.45 * breath(t)
    return { nodes: drift(n, t * 0.2).map(([x, y]): Point => [x * k, y * k]) }
  },
  shaping: (t, n) => {
    const shape = shapeMorph(t)
    return {
      nodes: [
        [0, 0],
        ...Array.from({ length: n - 1 }, (_, k): Point => {
          const a = -Math.PI / 2 + (k * TAU) / (n - 1)
          return [Math.cos(a) * 0.65 * shape(a), Math.sin(a) * 0.65 * shape(a)]
        }),
      ],
      reach: 0.75,
    }
  },
}

export const plexus: SpinnerSet = {
  id: 'plexus',
  label: 'Plexus',
  icon: { state: 'working', t: 1.9 },
  blurbs: {
    working: 'drifting points link up when they come close',
    searching: 'a roaming point connects to whatever it passes',
    solving: 'scattered points settle into a wheel',
    listening: 'links reach further with the voice',
    connecting: 'two clusters drift close and link up',
    weaving: 'two rings turn and relink',
    composing: 'points appear and wire themselves in',
    breathing: 'the network spreads out and pulls in',
    shaping: 'a web in a circle, a triangle, a square',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.018, 0.05)
    network(f, WEBS[state](f.t, f.compact ? 6 : 10))
  },
}
