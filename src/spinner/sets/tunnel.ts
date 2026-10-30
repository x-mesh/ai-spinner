import { TAU, breath, cycle, hash, level, polygonRadius, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const NEAR = 0.08

interface Ring {
  /** 0 = far away at the vanishing point, 1 = at the viewer. */
  depth: number
  /** Stable id for the ring through one pass of the tunnel. */
  id: number
  sides?: number
  rotate?: number
  alpha?: number
  wobble?: number
}

interface Tunnel {
  rings: Ring[]
  /** Vanishing point offset; far rings drift toward it, curving the tunnel. */
  vx?: number
  vy?: number
}

function ringCount(f: Frame) {
  return f.compact ? 4 : 9
}

/** Rings evenly spaced in depth, travelling forward by `travel` ring spacings. */
function flight(f: Frame, travel: number, extra: (ring: Ring) => Partial<Ring> = () => ({})): Ring[] {
  const n = ringCount(f)
  return Array.from({ length: n }, (_, i) => {
    const position = i / n + travel
    const ring = { depth: position - Math.floor(position), id: i + n * Math.floor(position) }
    return { ...ring, ...extra(ring) }
  })
}

function drawRing(f: Frame, ring: Ring, vx: number, vy: number) {
  const s = space(f)
  const z = 1 - ring.depth * (1 - NEAR)
  const r = (NEAR / z) * (1 + (ring.wobble ?? 0))
  const fade = smooth(ring.depth / 0.2) * (1 - smooth((r - 0.9) / 0.35)) * (ring.alpha ?? 1)
  if (fade <= 0.01) return
  const cx = vx * (1 - r)
  const cy = vy * (1 - r)
  const sides = ring.sides ?? 0
  const rotate = ring.rotate ?? 0
  f.ctx.globalAlpha = fade
  f.ctx.lineWidth = strokeWidth(f, 0.012, 0.04) * (0.5 + 1.5 * r)
  f.ctx.beginPath()
  for (let j = 0; j <= 64; j++) {
    const a = (j / 64) * TAU
    const rr = r * polygonRadius(sides, a - rotate)
    f.ctx.lineTo(s.x(cx + Math.cos(a) * rr), s.y(cy + Math.sin(a) * rr))
  }
  f.ctx.closePath()
  f.ctx.stroke()
}

const SHAPES = [0, 3, 4]

const TUNNELS: Record<SpinnerState, (f: Frame) => Tunnel> = {
  working: (f) => ({ rings: flight(f, f.t * 0.35) }),
  searching: (f) => ({ rings: flight(f, f.t * 0.3), vx: Math.cos(f.t * 0.9) * 0.45, vy: Math.sin(f.t * 1.3) * 0.3 }),
  solving: (f) => {
    const { phase } = cycle(f.t, 3.2)
    const settle = smooth((phase - 0.35) / 0.4)
    return { rings: flight(f, f.t * 0.3, (ring) => ({ sides: 4, rotate: (1 - settle) * (hash(ring.id) - 0.5) * 1.6 })) }
  },
  listening: (f) => ({ rings: flight(f, f.t * 0.3, (ring) => ({ wobble: 0.18 * level(f.t - ring.depth * 0.6, 0) })) }),
  connecting: (f) => {
    const { index, phase } = cycle(f.t, 3)
    return { rings: flight(f, index * 3 + smooth(phase) ** 2 * 3, () => ({ alpha: 0.4 + 0.6 * Math.sin(phase * Math.PI) })) }
  },
  weaving: (f) => ({ rings: flight(f, f.t * 0.3, (ring) => ({ sides: 3, rotate: f.t * (ring.id % 2 ? 1 : -1) })) }),
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const n = ringCount(f)
    const shown = smooth(phase / 0.6) * n
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return { rings: flight(f, 0, (ring) => ({ alpha: Math.min(1, Math.max(0, shown - (n - 1 - ring.id))) * fade })) }
  },
  breathing: (f) => ({ rings: flight(f, 0.06 * Math.sin(f.t * 1.2) + 0.03 * breath(f.t)) }),
  shaping: (f) => ({ rings: flight(f, f.t * 0.3, (ring) => ({ sides: SHAPES[ring.id % SHAPES.length], rotate: f.t * 0.2 })) }),
}

export const tunnel: SpinnerSet = {
  id: 'tunnel',
  label: 'Tunnel',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'rings rush toward you',
    searching: 'the tunnel bends as it looks around',
    solving: 'twisted frames straighten into a corridor',
    listening: 'rings ripple as they pass',
    connecting: 'a warp jump, then a stop',
    weaving: 'triangles spin alternately as they fly by',
    composing: 'the corridor builds from near to far',
    breathing: 'the tunnel drifts in and out',
    shaping: 'circles, triangles, squares fly past',
  },
  draw(state, f) {
    const { rings, vx = 0, vy = 0 } = TUNNELS[state](f)
    ;[...rings].sort((a, b) => a.depth - b.depth).forEach((ring) => drawRing(f, ring, vx, vy))
  },
}
