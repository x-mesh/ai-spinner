import { breath, cycle, envelope, hash, level, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Pose {
  /** Rotation in quarter turns; two quarter turns look identical, so turns can grow forever. */
  turn: number
  alpha?: number
}

/** Tile (i, j) of an n × n grid at time t. */
type Flip = (i: number, j: number, n: number, t: number) => Pose

const EXTENT = 0.8

function base(i: number, j: number) {
  return hash(i, j) > 0.5 ? 1 : 0
}

/** Two quarter arcs on opposite corners; neighboring tiles join them into winding paths. */
function tile(f: Frame, cx: number, cy: number, size: number, { turn, alpha = 1 }: Pose) {
  if (alpha <= 0.01) return
  const s = space(f)
  const h = s.len(size / 2)
  f.ctx.save()
  f.ctx.globalAlpha = alpha
  f.ctx.translate(s.x(cx), s.y(cy))
  f.ctx.rotate((turn * Math.PI) / 2)
  f.ctx.beginPath()
  f.ctx.arc(-h, -h, h, 0, Math.PI / 2)
  f.ctx.stroke()
  f.ctx.beginPath()
  f.ctx.arc(h, h, h, Math.PI, Math.PI * 1.5)
  f.ctx.stroke()
  f.ctx.restore()
}

/** Monotonic quarter turns that snap once per unit of w. */
function ticks(w: number, snap = 0.3) {
  return Math.floor(w) + smooth((w - Math.floor(w)) / snap)
}

const PATTERNS: ((i: number, j: number) => number)[] = [() => 0, (i, j) => (i + j) % 2, (i) => i % 2]

const FLIPS: Record<SpinnerState, Flip> = {
  working: (i, j, _, t) => ({ turn: base(i, j) + ticks(t * 0.5 + hash(i, j, 1) * 3, 0.25) }),
  searching: (i, j, _, t) => ({ turn: base(i, j) + ticks(t * 0.7 - (i + j) * 0.18) }),
  solving: (i, j, _, t) => {
    const { index, phase } = cycle(t, 3.2)
    const chaos = smooth(phase / 0.2) * (1 - smooth((phase - 0.3) / 0.4))
    return { turn: ((i + j) % 2) + chaos * (hash(index, i, j) * 6 - 3) }
  },
  listening: (i, j, n, t) => ({ turn: base(i, j) + 0.3 * level(t, i + j * n) }),
  connecting: (i, j, _, t) => ({ turn: ((i + j) % 2) + (i % 2) * envelope(cycle(t, 3.2).phase, 0.4, 0.7) }),
  weaving: (i, j, _, t) => ({ turn: base(i, j) + (j % 2 ? 1 : -1) * t * 0.5 }),
  composing: (i, j, n, t) => {
    const { phase } = cycle(t, 3.6)
    const on = smooth((phase - ((j * n + i) / (n * n)) * 0.6) / 0.08)
    return { turn: base(i, j) + (1 - on), alpha: on * (1 - smooth((phase - 0.85) / 0.15)) }
  },
  breathing: (i, j, _, t) => ({ turn: base(i, j) + breath(t) }),
  shaping: (i, j, _, t) => {
    const { index, phase } = cycle(t, 1.8)
    const from = PATTERNS[index % 3](i, j)
    const to = PATTERNS[(index + 1) % 3](i, j)
    return { turn: from + ((to - from + 2) % 2) * smooth((phase - 0.6) / 0.4) }
  },
}

export const truchet: SpinnerSet = {
  id: 'truchet',
  label: 'Truchet',
  icon: { state: 'solving', t: 2.9 },
  blurbs: {
    working: 'tiles flip and reroute the paths',
    searching: 'a wave of flips sweeps across the grid',
    solving: 'spinning tiles lock into circles',
    listening: 'tiles twitch with the voice',
    connecting: 'circles open up into one winding path',
    weaving: 'alternate rows turn against each other',
    composing: 'tiles turn into place one by one',
    breathing: 'the whole pattern turns over and back',
    shaping: 'waves, circles, stripes',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.03, 0.08)
    const n = f.compact ? 3 : 4
    const size = (EXTENT * 2) / n
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        tile(f, -EXTENT + (i + 0.5) * size, -EXTENT + (j + 0.5) * size, size, FLIPS[state](i, j, n, f.t))
      }
    }
  },
}
