import { TAU, breath, clamp01, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { line, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Pole at (x, y) with signed strength q. */
type Pole = [x: number, y: number, q: number]

interface Filings {
  poles: Pole[]
  /** Replaces the field angle of filing i, for scrambled states. */
  turn?: (i: number, a: number) => number
  length?: (i: number, r: number) => number
  /** Radius out to which filings are shown. */
  reach?: number
  alpha?: number
}

/** Iron filings: short dashes laid along the field of a few poles, fainter where the field is weak. */
function filings(f: Frame, { poles, turn, length = () => 1, reach = 0.92, alpha = 1 }: Filings) {
  const n = f.compact ? 5 : 9
  const dash = f.compact ? 0.2 : 0.11
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = lerp(-0.8, 0.8, i / (n - 1))
      const y = lerp(-0.8, 0.8, j / (n - 1))
      const r = Math.hypot(x, y)
      if (r > reach) continue
      let ex = 0
      let ey = 0
      let near = Infinity
      for (const [px, py, q] of poles) {
        const dx = x - px
        const dy = y - py
        const d2 = dx * dx + dy * dy
        near = Math.min(near, d2)
        ex += (q * dx) / d2
        ey += (q * dy) / d2
      }
      if (near < 0.006) continue
      const k = j * n + i
      const a = turn ? turn(k, Math.atan2(ey, ex)) : Math.atan2(ey, ex)
      const half = (dash * length(k, r)) / 2
      line(f, [[x - Math.cos(a) * half, y - Math.sin(a) * half], [x + Math.cos(a) * half, y + Math.sin(a) * half]], alpha * clamp01(0.35 + Math.hypot(ex, ey) * 0.2))
    }
  }
}

function dipole(angle: number, r: number, cx = 0, cy = 0): Pole[] {
  return [
    [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1],
    [cx - Math.cos(angle) * r, cy - Math.sin(angle) * r, -1],
  ]
}

const COUNTS = [3, 4, 6]

const FIELDS: Record<SpinnerState, (t: number) => Filings> = {
  working: (t) => ({ poles: dipole(t * 0.8, 0.35) }),
  searching: (t) => ({ poles: [[0.45 * Math.sin(t * 1.1), 0.35 * Math.sin(t * 1.7), 1]] }),
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return { poles: dipole(0, 0.35), turn: (i, a) => lerp(hash(index, i) * TAU, a, settle) }
  },
  listening: (t) => ({ poles: dipole(0, 0.35), length: (_, r) => 0.4 + 1.2 * level(t - r, 0) }),
  connecting: (t) => {
    const c = lerp(0.6, 0.18, envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return { poles: [[-c, 0, 1], [c, 0, -1]] }
  },
  weaving: (t) => ({ poles: [...dipole(t * 0.9, 0.25), ...dipole(-t * 0.6, 0.6)] }),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    return { poles: dipole(0.5, 0.35), reach: 0.95 * smooth(phase / 0.7), alpha: 1 - smooth((phase - 0.85) / 0.15) }
  },
  breathing: (t) => ({ poles: dipole(0, 0.35), length: () => 0.4 + 0.8 * breath(t) }),
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const sides = COUNTS[index % COUNTS.length]
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    return {
      poles: Array.from({ length: sides }, (_, k): Pole => {
        const a = -Math.PI / 2 + (k * TAU) / sides + t * 0.3
        return [Math.cos(a) * 0.45, Math.sin(a) * 0.45, sides % 2 ? 1 : k % 2 ? 1 : -1]
      }),
      alpha: swap,
    }
  },
}

export const field: SpinnerSet = {
  id: 'field',
  label: 'Field',
  icon: { state: 'connecting', t: 1.6 },
  blurbs: {
    working: 'iron filings follow a turning magnet',
    searching: 'filings point after a wandering pole',
    solving: 'scattered filings snap into field lines',
    listening: 'filings stretch outward with the voice',
    connecting: 'two poles close in and the field joins them',
    weaving: 'two magnets turn against each other',
    composing: 'filings line up from the center outward',
    breathing: 'the filings grow and shrink',
    shaping: 'three, four, six poles',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.022, 0.07)
    filings(f, FIELDS[state](f.t))
  },
}
