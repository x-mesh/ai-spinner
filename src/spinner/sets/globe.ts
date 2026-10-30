import { breath, clamp01, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type V3 = [number, number, number]

interface Dot {
  p: V3
  size?: number
  /** Overrides the view's yaw for this dot. */
  yaw?: number
}

interface View {
  dots: Dot[]
  yaw: number
  pitch: number
  x?: number
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/** Evenly spread points on the unit sphere. */
function fibonacci(n: number): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - ((i + 0.5) / n) * 2
    const r = Math.sqrt(1 - y * y)
    return [Math.cos(i * GOLDEN) * r, y, Math.sin(i * GOLDEN) * r]
  })
}

const LARGE = fibonacci(90)
const COMPACT = fibonacci(28)

function scaled([x, y, z]: V3, k: number): V3 {
  return [x * k, y * k, z * k]
}

/** Painter's order back to front; farther dots are smaller and fainter. */
function sphere(f: Frame, { dots, yaw, pitch, x = 0 }: View) {
  const base = f.compact ? 0.1 : 0.05
  dots
    .map(({ p: [px, py, pz], size = 1, yaw: own = yaw }) => {
      const x1 = px * Math.cos(own) + pz * Math.sin(own)
      const z1 = -px * Math.sin(own) + pz * Math.cos(own)
      return { x: x1 + x, y: py * Math.cos(pitch) - z1 * Math.sin(pitch), z: py * Math.sin(pitch) + z1 * Math.cos(pitch), size }
    })
    .sort((a, b) => b.z - a.z)
    .forEach((d) => {
      const near = clamp01(0.5 - d.z / 1.6)
      disc(f, d.x, d.y, base * d.size * (0.4 + 0.8 * near), 0.1 + 0.9 * near ** 1.5)
    })
}

function cube([x, y, z]: V3): V3 {
  return scaled([x, y, z], 0.55 / Math.max(Math.abs(x), Math.abs(y), Math.abs(z)))
}

function octahedron([x, y, z]: V3): V3 {
  return scaled([x, y, z], 0.85 / (Math.abs(x) + Math.abs(y) + Math.abs(z)))
}

const SOLIDS: ((p: V3) => V3)[] = [(p) => scaled(p, 0.8), cube, octahedron]

const GLOBES: Record<SpinnerState, (t: number, points: V3[]) => View[]> = {
  working: (t, points) => [{ dots: points.map((p) => ({ p: scaled(p, 0.8) })), yaw: t * 0.8, pitch: 0.4 }],
  searching: (t, points) => {
    const band = Math.sin(t * 1.6) * 0.8
    return [{ dots: points.map((p) => ({ p: scaled(p, 0.8), size: 1 + 1.3 * Math.exp(-((p[1] - band) ** 2) * 25) })), yaw: t * 0.5, pitch: 0.3 }]
  },
  solving: (t, points) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return [{ dots: points.map((p, i) => ({ p: scaled(p, 0.8 * lerp(0.3 + hash(index, i) * 0.9, 1, settle)) })), yaw: t * 0.6, pitch: 0.4 }]
  },
  listening: (t, points) => [
    { dots: points.map((p) => ({ p: scaled(p, 0.62 + 0.28 * level(t, Math.round((p[1] + 1) * 2))) })), yaw: t * 0.5, pitch: 0.3 },
  ],
  connecting: (t, points) => {
    const e = envelope(cycle(t, 3.4).phase, 0.4, 0.7)
    const k = lerp(0.42, 0.75, e)
    return [-1, 1].map((side) => ({
      dots: points.map((p) => ({ p: scaled(p, k) })),
      yaw: t * 0.8 + (side > 0 ? Math.PI / 2 : 0),
      pitch: 0.4,
      x: side * 0.45 * (1 - e),
    }))
  },
  weaving: (t, points) => [{ dots: points.map((p) => ({ p: scaled(p, 0.8), yaw: p[1] > 0 ? t : -t })), yaw: 0, pitch: 0.4 }],
  composing: (t, points) => {
    const { phase } = cycle(t, 3.6)
    const reach = smooth(phase / 0.7)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return [{ dots: points.map((p) => ({ p: scaled(p, 0.8), size: smooth((reach - (1 - p[1]) / 2) / 0.1) * fade })), yaw: t * 0.6, pitch: 0.4 }]
  },
  breathing: (t, points) => [{ dots: points.map((p) => ({ p: scaled(p, 0.5 + 0.3 * breath(t)) })), yaw: t * 0.3, pitch: 0.4 }],
  shaping: (t, points) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = SOLIDS[index % 3]
    const to = SOLIDS[(index + 1) % 3]
    return [
      {
        dots: points.map((p) => {
          const a = from(p)
          const b = to(p)
          return { p: [lerp(a[0], b[0], blend), lerp(a[1], b[1], blend), lerp(a[2], b[2], blend)] }
        }),
        yaw: t * 0.7,
        pitch: 0.5,
      },
    ]
  },
}

export const globe: SpinnerSet = {
  id: 'globe',
  label: 'Globe',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'a sphere of dots turns',
    searching: 'a band of light scans from pole to pole',
    solving: 'scattered dots gather into a sphere',
    listening: 'latitudes swell with the voice',
    connecting: 'two globes merge into one',
    weaving: 'the hemispheres turn against each other',
    composing: 'the sphere fills in from the top down',
    breathing: 'the sphere swells and shrinks',
    shaping: 'a sphere, a cube, an octahedron',
  },
  draw(state, f) {
    GLOBES[state](f.t, f.compact ? COMPACT : LARGE).forEach((view) => sphere(f, view))
  },
}
