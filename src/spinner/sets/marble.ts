import { breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { paintField } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Band coordinate at (u, v), already warped; one ink band per whole unit. */
type Comb = (u: number, v: number) => number

interface Marbling {
  combs: Comb[]
  weight?: number
  rim?: (a: number) => number
}

function stripe(x: number, weight: number, soft: number) {
  const d = Math.abs(x - Math.round(x))
  return smooth((weight / 2 - d) / soft + 0.5)
}

/** Overlapping band sets combine like XOR, as when a bath is combed twice. */
function bath(f: Frame, { combs, weight = 0.5, rim = () => 0.95 }: Marbling) {
  const soft = f.compact ? 0.12 : 0.06
  paintField(f, (u, v) => {
    const edge = smooth((rim(Math.atan2(v, u)) - Math.hypot(u, v)) / 0.04 + 0.5)
    if (edge <= 0) return 0
    let ink = 0
    for (const comb of combs) {
      const s = stripe(comb(u, v), weight, soft)
      ink = ink + s - 2 * ink * s
    }
    return ink * edge
  })
}

/** Layered sines that drift, so the bands meander like ink floating on water. */
function flow(u: number, v: number, t: number, amount: number) {
  return amount * (0.5 * Math.sin(u * 2.3 + t * 0.7) + 0.35 * Math.sin(v * 3.1 - u * 1.7 + t * 0.9) + 0.2 * Math.sin((u + v) * 5.3 - t * 1.3))
}

function pull(u: number, v: number, x: number, y: number) {
  return Math.exp(-((u - x) ** 2 + (v - y) ** 2) * 6)
}

/** Compact sizes use fewer bands so each stays a few pixels wide. */
const BATHS: Record<SpinnerState, (t: number, k: number) => Marbling> = {
  working: (t, k) => ({ combs: [(u, v) => v * 4.5 * k + flow(u, v, t, 1.2)] }),
  searching: (t, k) => {
    const x = Math.sin(t * 1.1) * 0.5
    const y = Math.sin(t * 1.7) * 0.3
    return { combs: [(u, v) => v * 4.5 * k + 1.2 * pull(u, v, x, y)] }
  },
  solving: (t, k) => {
    const { index, phase } = cycle(t, 3.2)
    const warp = 1.8 * (1 - smooth((phase - 0.3) / 0.45))
    return { combs: [(u, v) => v * 4.5 * k + flow(u, v, t + hash(index) * 20, warp)] }
  },
  listening: (t, k) => ({ combs: [(u, v) => v * 4.5 * k + flow(u, v, t, 0.2 + 1.4 * level(t, 0))] }),
  connecting: (t, k) => {
    const c = lerp(0.5, 0.12, envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return { combs: [(u, v) => v * 4.5 * k + 1.1 * (pull(u, v, -c, 0) - pull(u, v, c, 0))] }
  },
  weaving: (t, k) => ({
    combs: [(u, v) => v * 3.5 * k + flow(u, v, t, 0.6), (u, v) => u * 3.5 * k + flow(v, u, -t, 0.6)],
  }),
  composing: (t, k) => {
    const { phase } = cycle(t, 3.6)
    const spread = smooth(phase / 0.7)
    return {
      combs: [(u, v) => Math.hypot(u, v) * 5 * k - spread * 4 + flow(u, v, t, 0.3)],
      rim: () => 0.95 * spread,
      weight: 0.5 * (1 - smooth((phase - 0.85) / 0.15)),
    }
  },
  breathing: (t, k) => ({ combs: [(u, v) => v * 4.5 * k + flow(u, v, t * 0.4, 0.8)], weight: 0.2 + 0.6 * breath(t) }),
  shaping: (t, k) => {
    const shape = shapeMorph(t)
    return { combs: [(u, v) => v * 4.5 * k + flow(u, v, t, 1)], rim: (a) => 0.92 * shape(a) }
  },
}

export const marble: SpinnerSet = {
  id: 'marble',
  label: 'Marble',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'ink bands meander like marbled paper',
    searching: 'a stylus drags through the bands',
    solving: 'swirled ink combs back into straight bands',
    listening: 'the bands ripple harder with the voice',
    connecting: 'two pins pull the bands toward each other',
    weaving: 'a second combing crosses the first',
    composing: 'ink drops spread into rings',
    breathing: 'the bands thicken and thin',
    shaping: 'marbling in a circle, a triangle, a square',
  },
  draw(state, f) {
    bath(f, BATHS[state](f.t, f.compact ? 0.55 : 1))
  },
}
