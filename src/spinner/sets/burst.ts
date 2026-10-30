import { TAU, breath, cycle, hash, lerp, level, polygonRadius, smooth } from '../math.js'
import { disc, line, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Shell {
  x: number
  y: number
  age: number
  life?: number
  count?: number
  speed?: number
  seed?: number
  /** Radial reach along canvas angle a, for shaped bursts. */
  spread?: (a: number) => number
  /** Overrides the eased outward travel (0..1). */
  out?: number
  alpha?: number
}

/** Sparks fly out with drag, sag under gravity and burn down; large sizes add a short streak. */
function shell(f: Frame, { x, y, age, life = 1.4, count, speed = 0.62, seed = 0, spread, out, alpha }: Shell) {
  const q = age / life
  if (q < 0 || q >= 1) return
  const n = count ?? (f.compact ? 7 : 14)
  const travel = out ?? 1 - (1 - q) ** 3
  const size = (f.compact ? 0.13 : 0.05) * (1 - 0.6 * q)
  const fade = alpha ?? (1 - q) ** (f.compact ? 0.6 : 1.2)
  const sag = 0.25 * q * q
  for (let k = 0; k < n; k++) {
    const a = (k * TAU) / n + seed
    const d = speed * travel * (spread?.(a) ?? 1) * (0.85 + 0.3 * hash(seed, k))
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d + sag
    if (!f.compact) line(f, [[x + Math.cos(a) * d * 0.7, y + Math.sin(a) * d * 0.7 + sag], [px, py]], fade * 0.5)
    disc(f, px, py, size, fade)
  }
}

function rocket(f: Frame, x: number, from: [number, number], to: [number, number], p: number) {
  const px = lerp(from[0], to[0], smooth(p))
  const py = lerp(from[1], to[1], smooth(p))
  disc(f, x + px, py, f.compact ? 0.12 : 0.06)
}

const SIDES = [0, 3, 4]

const BURSTS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const { index } = cycle(f.t, 0.8)
    for (const k of [index - 1, index]) {
      shell(f, { x: (hash(k) - 0.5) * 0.6, y: (hash(k, 1) - 0.5) * 0.5 - 0.1, age: f.t - k * 0.8, seed: hash(k, 2) * TAU })
    }
  },
  searching: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const x = Math.sin(index * 2.3) * 0.4
    if (phase < 0.35) rocket(f, x, [0, 0.85], [0, -0.2], phase / 0.35)
    else shell(f, { x, y: -0.2, age: (phase - 0.35) * 1.8, seed: index })
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3)
    const out = smooth(phase / 0.3) * (1 - smooth((phase - 0.5) / 0.4))
    shell(f, { x: 0, y: 0, age: 0, out, speed: 0.75, seed: index * 0.7, alpha: 1 })
    disc(f, 0, 0, (f.compact ? 0.12 : 0.07) * (1.4 - out))
  },
  listening: (f) => {
    const n = f.compact ? 7 : 12
    for (let k = 0; k < n; k++) {
      const a = (k * TAU) / n - Math.PI / 2
      const d = 0.2 + 0.55 * level(f.t, k)
      disc(f, Math.cos(a) * d, Math.sin(a) * d, f.compact ? 0.1 : 0.05)
    }
  },
  connecting: (f) => {
    const { phase } = cycle(f.t, 2.6)
    if (phase < 0.4) {
      rocket(f, 0, [-0.8, 0.1], [0, 0], phase / 0.4)
      rocket(f, 0, [0.8, 0.1], [0, 0], phase / 0.4)
    } else shell(f, { x: 0, y: 0, age: (phase - 0.4) * 2.6, life: 1.5, count: f.compact ? 8 : 18 })
  },
  weaving: (f) => {
    const every = f.compact ? 0.1 : 0.05
    const life = 1.1
    const last = Math.floor(f.t / every)
    for (let e = last - Math.ceil(life / every); e <= last; e++) {
      const age = f.t - e * every
      if (age < 0 || age > life) continue
      const a = e * every * 3 + (e % 2) * Math.PI
      const d = age * 0.75
      disc(f, Math.cos(a) * d, Math.sin(a) * d, (f.compact ? 0.1 : 0.045) * (1 - 0.5 * (age / life)), 1 - age / life)
    }
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    ;[-0.45, 0, 0.45].forEach((x, k) => {
      const age = phase * 3.6 - k * 0.5
      shell(f, { x, y: -0.1, age, life: 2.6 - k * 0.5, speed: 0.4, seed: k, alpha: age > 0 ? Math.min(1, (1 - age / (2.6 - k * 0.5)) * 2) * fade : 0 })
    })
  },
  breathing: (f) => {
    const b = breath(f.t)
    shell(f, { x: 0, y: 0, age: 0, out: 0.15 + 0.85 * b, alpha: 1 - 0.5 * b })
  },
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const sides = SIDES[index % SIDES.length]
    shell(f, { x: 0, y: 0, age: phase * 1.8, life: 1.8, count: f.compact ? 9 : 18, speed: 0.75, spread: (a) => polygonRadius(sides, a) })
  },
}

export const burst: SpinnerSet = {
  id: 'burst',
  label: 'Burst',
  icon: { state: 'solving', t: 0.6 },
  blurbs: {
    working: 'fireworks pop one after another',
    searching: 'a rocket climbs and bursts somewhere new',
    solving: 'a burst gathers back into a spark',
    listening: 'sparks flare out with the voice',
    connecting: 'two sparks collide and burst',
    weaving: 'a sparkler spins out spirals',
    composing: 'a row of bursts goes off in turn',
    breathing: 'a burst blooms and closes',
    shaping: 'bursts in a circle, a triangle, a square',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.02, 0.06)
    BURSTS[state](f)
  },
}
