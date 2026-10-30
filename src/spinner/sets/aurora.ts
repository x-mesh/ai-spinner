import { breath, clamp01, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { inkRgb, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Curtain {
  /** Bright lower edge at x. */
  edge: (x: number) => number
  /** How far the light reaches up from the edge. */
  length: (x: number) => number
  intensity: (x: number) => number
  /** Sideways fold of the curtain at x. */
  fold?: (x: number) => number
}

/** Vertical rays fading upward from a sharp lower edge; neighbors overlap into one sheet of light. */
function curtain(f: Frame, { edge, length, intensity, fold = () => 0 }: Curtain) {
  const s = space(f)
  const [r, g, b] = inkRgb(f)
  const n = f.compact ? 10 : 30
  f.ctx.globalAlpha = 1
  for (let i = 0; i < n; i++) {
    const x = lerp(-0.85, 0.85, i / (n - 1))
    const a = clamp01(intensity(x))
    if (a <= 0.01) continue
    const px = s.x(x + fold(x))
    const bottom = s.y(edge(x))
    const top = s.y(edge(x) - length(x))
    const ray = f.ctx.createLinearGradient(0, top, 0, bottom)
    ray.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
    ray.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${a})`)
    f.ctx.strokeStyle = ray
    f.ctx.beginPath()
    f.ctx.moveTo(px, top)
    f.ctx.lineTo(px, bottom)
    f.ctx.stroke()
  }
}

function bump(x: number, center: number, width = 8) {
  return Math.exp(-((x - center) ** 2) * width)
}

const EDGES: ((x: number) => number)[] = [(x) => 0.15 + 0.45 * x * x, (x) => 0.2 + 0.5 * Math.abs(x), () => 0.4]

const SKIES: Record<SpinnerState, (t: number) => Curtain[]> = {
  working: (t) => [
    {
      edge: (x) => 0.35 + 0.15 * Math.sin(x * 3 + t * 1.5),
      length: (x) => 0.8 + 0.3 * Math.sin(x * 5 - t * 2),
      intensity: (x) => 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(x * 4 - t * 3)),
      fold: (x) => 0.06 * Math.sin(x * 7 + t * 2),
    },
  ],
  searching: (t) => [{ edge: () => 0.4, length: () => 1, intensity: (x) => 0.12 + 0.88 * bump(x, Math.sin(t * 1.2) * 0.6) }],
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const tick = Math.floor(t / 0.1)
    return [
      {
        edge: (x) => 0.4 + (1 - settle) * 0.2 * Math.sin(x * 9 + index),
        length: () => 0.9,
        intensity: (x) => lerp(hash(Math.round(x * 100), tick), 0.6 + 0.3 * Math.sin(x * 3 - t), settle),
      },
    ]
  },
  listening: (t) => [{ edge: () => 0.45, length: (x) => 0.25 + 0.95 * level(t + x * 0.8, 0), intensity: () => 0.8 }],
  connecting: (t) => {
    const c = lerp(0.65, 0.08, envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return [{ edge: () => 0.4, length: () => 1, intensity: (x) => 0.1 + 0.9 * Math.max(bump(x, -c, 10), bump(x, c, 10)) }]
  },
  weaving: (t) => [
    { edge: (x) => 0.3 + 0.1 * Math.sin(x * 4 + t * 2), length: () => 0.9, intensity: (x) => 0.55 * (0.5 + 0.5 * Math.sin(x * 5 + t * 2)), fold: (x) => 0.08 * Math.sin(x * 6 + t) },
    { edge: (x) => 0.5 + 0.1 * Math.sin(x * 4 - t * 2), length: () => 0.8, intensity: (x) => 0.55 * (0.5 + 0.5 * Math.sin(x * 5 - t * 2)), fold: (x) => -0.08 * Math.sin(x * 6 - t) },
  ],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const front = smooth(phase / 0.7) * 1.9 - 0.85
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return [{ edge: (x) => 0.35 + 0.1 * Math.sin(x * 3 + t), length: () => 0.95, intensity: (x) => 0.8 * smooth((front - x) / 0.2) * fade }]
  },
  breathing: (t) => [{ edge: (x) => 0.35 + 0.05 * Math.sin(x * 3 + t * 0.5), length: () => 0.95, intensity: () => 0.2 + 0.65 * breath(t) }],
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = EDGES[index % 3]
    const to = EDGES[(index + 1) % 3]
    return [{ edge: (x) => lerp(from(x), to(x), blend), length: () => 0.75, intensity: (x) => 0.6 + 0.3 * Math.sin(x * 4 - t * 2) }]
  },
}

export const aurora: SpinnerSet = {
  id: 'aurora',
  label: 'Aurora',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'curtains of light ripple and fold',
    searching: 'a bright patch drifts across the sky',
    solving: 'flickering light settles into a steady glow',
    listening: 'rays shoot up with the voice',
    connecting: 'two glows slide together in the middle',
    weaving: 'two curtains ripple past each other',
    composing: 'the curtain unrolls across the sky',
    breathing: 'the aurora brightens and fades',
    shaping: 'an arc, a V, a flat band',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.035, 0.09)
    SKIES[state](f.t).forEach((c) => curtain(f, c))
  },
}
