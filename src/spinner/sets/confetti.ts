import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Piece {
  x: number
  y: number
  angle: number
  /** Flip around the piece's long axis; the paler back shows when it is negative. */
  flip: number
  alpha?: number
}

function flutter(f: Frame, pieces: Piece[]) {
  const s = space(f)
  const w = s.len(f.compact ? 0.34 : 0.18)
  const h = s.len(f.compact ? 0.2 : 0.1)
  for (const { x, y, angle, flip, alpha = 1 } of pieces) {
    const face = Math.cos(flip)
    if (alpha <= 0.01) continue
    f.ctx.globalAlpha = alpha * (face >= 0 ? 1 : 0.6)
    f.ctx.save()
    f.ctx.translate(s.x(x), s.y(y))
    f.ctx.rotate(angle)
    f.ctx.scale(1, Math.max(0.25, Math.abs(face)))
    f.ctx.fillRect(-w / 2, -h / 2, w, h)
    f.ctx.restore()
  }
}

function stream(t: number, every: number, life: number, place: (k: number, p: number, age: number) => Piece) {
  const last = Math.floor(t / every)
  const out: Piece[] = []
  for (let k = last - Math.ceil(life / every); k <= last; k++) {
    const age = t - k * every
    if (age >= 0 && age < life) out.push(place(k, age / life, age))
  }
  return out
}

/** A falling piece at life p: sways, spins and flips as it drops. */
function fall(k: number, p: number, age: number, x: number, wind = 0): Piece {
  return {
    x: x + 0.1 * Math.sin(age * 3 + k) + wind * p,
    y: lerp(-0.95, 0.95, p),
    angle: age * (1 + hash(k, 2) * 2) + k,
    flip: age * (4 + hash(k, 3) * 4),
    alpha: smooth(p / 0.08) * (1 - smooth((p - 0.9) / 0.1)),
  }
}

function grid(n: number): [number, number][] {
  return Array.from({ length: n * n }, (_, k) => [lerp(-0.45, 0.45, (k % n) / (n - 1)), lerp(-0.45, 0.45, Math.floor(k / n) / (n - 1))])
}

const FALLS: Record<SpinnerState, (t: number, compact: boolean) => Piece[]> = {
  working: (t, compact) => stream(t, compact ? 0.35 : 0.16, 1.8, (k, p, age) => fall(k, p, age, (hash(k) - 0.5) * 1.3)),
  searching: (t, compact) =>
    stream(t, compact ? 0.35 : 0.16, 1.8, (k, p, age) => fall(k, p, age, (hash(k) - 0.5) * 0.8 - Math.sin(t * 0.8) * 0.35, Math.sin(t * 0.8) * 0.7)),
  solving: (t, compact) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return grid(compact ? 2 : 3).map(([x, y], k) => ({
      x: lerp(hash(index, k) * 1.4 - 0.7, x, settle),
      y: lerp(hash(index, k, 1) * 1.4 - 0.7, y, settle),
      angle: (1 - settle) * (t * 3 + k),
      flip: (1 - settle) * (t * 6 + k),
    }))
  },
  listening: (t, compact) => {
    const n = compact ? 3 : 5
    return Array.from({ length: n }, (_, k) => {
      const v = level(t, k)
      return { x: lerp(-0.6, 0.6, k / (n - 1)), y: 0.3 - 0.6 * v, angle: v * 0.8, flip: v * Math.PI }
    })
  },
  connecting: (t, compact) => {
    const meet = envelope(cycle(t, 3.2).phase, 0.4, 0.7)
    return stream(t, compact ? 0.3 : 0.14, 1.6, (k, p, age) => {
      const side = k % 2 ? 1 : -1
      return { ...fall(k, p, age, side * lerp(0.7, 0.15, meet), -side * meet * 0.5 * p), y: lerp(-0.9, 0.9, p) }
    })
  },
  weaving: (t, compact) =>
    stream(t, compact ? 0.3 : 0.12, 2, (k, p, age) => ({ ...fall(k, p, age, 0), x: 0.45 * Math.sin(age * 3 + (k % 2) * Math.PI) })),
  composing: (t, compact) => {
    const { phase } = cycle(t, 4)
    const n = compact ? 4 : 8
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return Array.from({ length: n }, (_, k) => {
      const p = smooth((phase - (k / n) * 0.6) / 0.15)
      const rest = 0.75 - Math.floor(k / 4) * 0.12
      return { x: lerp(-0.45, 0.45, (k % 4) / 3) + (hash(k) - 0.5) * 0.1, y: lerp(-0.95, rest, p), angle: (1 - p) * 4 + (hash(k, 1) - 0.5) * 0.4, flip: (1 - p) * 9, alpha: fade * smooth(p / 0.05 + 0.01) }
    })
  },
  breathing: (t, compact) => {
    const n = compact ? 3 : 5
    return Array.from({ length: n }, (_, k) => ({
      x: lerp(-0.55, 0.55, k / (n - 1)),
      y: 0.2 - 0.4 * breath(t - k * 0.3),
      angle: 0.3 * Math.sin(t + k),
      flip: t * 0.8 + k,
    }))
  },
  shaping: (t, compact) => {
    const shape = shapeMorph(t)
    const n = compact ? 6 : 10
    return Array.from({ length: n }, (_, k) => {
      const a = -Math.PI / 2 + (k * TAU) / n
      return { x: Math.cos(a) * 0.62 * shape(a), y: Math.sin(a) * 0.62 * shape(a), angle: a + Math.PI / 2, flip: t * 3 + k * 0.6 }
    })
  },
}

export const confetti: SpinnerSet = {
  id: 'confetti',
  label: 'Confetti',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'confetti flutters down',
    searching: 'a gust sweeps the confetti sideways',
    solving: 'tumbling pieces land in a neat grid',
    listening: 'pieces hop with the voice',
    connecting: 'two showers drift together',
    weaving: 'confetti spirals down in a helix',
    composing: 'pieces fall and pile up',
    breathing: 'a few pieces float up and down',
    shaping: 'confetti ringing a circle, a triangle, a square',
  },
  draw(state, f) {
    flutter(f, FALLS[state](f.t, f.compact))
  },
}
