import { TAU, breath, cycle, envelope, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Shard {
  points: Point[]
  ring: number
}

interface Pose {
  /** Outward travel along the shard's own direction. */
  push?: number
  spin?: number
  /** Turn about the center of the disc. */
  orbit?: number
  dx?: number
  dy?: number
  alpha?: number
}

const INNER = 0.38
const OUTER = 0.85

/** A disc cut into an inner ring of wedges and an outer ring of curved tiles, with jittered cuts. */
function crack(inner: number, outer: number): Shard[] {
  const arc = (r0: number, r1: number, a0: number, a1: number): Point[] => {
    const steps = 4
    const out: Point[] = []
    for (let i = 0; i <= steps; i++) {
      const a = lerp(a0, a1, i / steps)
      out.push([Math.cos(a) * r1, Math.sin(a) * r1])
    }
    for (let i = steps; i >= 0; i--) {
      const a = lerp(a0, a1, i / steps)
      out.push([Math.cos(a) * r0, Math.sin(a) * r0])
    }
    return out
  }
  const cuts = (n: number, salt: number) => Array.from({ length: n + 1 }, (_, k) => ((k % n) + (hash(salt, k % n) - 0.5) * 0.5) * (TAU / n) + (k === n ? TAU : 0))
  const a = cuts(inner, 1)
  const b = cuts(outer, 2)
  return [
    ...a.slice(0, inner).map((from, k) => ({ points: arc(0, INNER, from, a[k + 1]), ring: 0 })),
    ...b.slice(0, outer).map((from, k) => ({ points: arc(INNER, OUTER, from, b[k + 1]), ring: 1 })),
  ]
}

const LARGE = crack(5, 8)
const COMPACT = crack(3, 5)

/** Each shard shrinks toward its centroid so the cracks show, then moves as a rigid piece. */
function shards(f: Frame, pieces: Shard[], pose: (shard: Shard, k: number, angle: number) => Pose, shape: (a: number) => number) {
  const s = space(f)
  const gap = f.compact ? 0.82 : 0.9
  pieces.forEach((shard, k) => {
    const points = shard.points.map(([x, y]): Point => {
      const k2 = shape(Math.atan2(y, x))
      return [x * k2, y * k2]
    })
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length
    const angle = Math.atan2(cy, cx)
    const { push = 0, spin = 0, orbit = 0, dx = 0, dy = 0, alpha = 1 } = pose(shard, k, angle)
    if (alpha <= 0.01) return
    const ox = Math.cos(orbit) * cx - Math.sin(orbit) * cy + Math.cos(angle + orbit) * push + dx
    const oy = Math.sin(orbit) * cx + Math.cos(orbit) * cy + Math.sin(angle + orbit) * push + dy
    f.ctx.globalAlpha = alpha
    f.ctx.save()
    f.ctx.translate(s.x(ox), s.y(oy))
    f.ctx.rotate(spin + orbit)
    f.ctx.beginPath()
    points.forEach(([x, y]) => f.ctx.lineTo(s.len((x - cx) * gap), s.len((y - cy) * gap)))
    f.ctx.closePath()
    f.ctx.fill()
    f.ctx.restore()
  })
}

const ROUND = () => 1

const BREAKS: Record<SpinnerState, (t: number) => { pose: (shard: Shard, k: number, angle: number) => Pose; shape?: (a: number) => number }> = {
  working: (t) => {
    const out = envelope(cycle(t, 2.4).phase, 0.35, 0.55)
    return { pose: (_, k) => ({ push: out * (0.12 + 0.22 * hash(k)), spin: out * (hash(k, 1) - 0.5) * 1.5 }) }
  },
  searching: (t) => ({ pose: (_, __, angle) => ({ push: 0.2 * Math.max(0, Math.cos(angle - t * 2)) ** 4 }) }),
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const loose = smooth(phase / 0.15) * (1 - smooth((phase - 0.3) / 0.45))
    return { pose: (_, k) => ({ push: loose * (0.2 + 0.4 * hash(index, k)), spin: loose * (hash(index, k, 1) - 0.5) * 3 }) }
  },
  listening: (t) => ({ pose: (shard, k) => ({ push: 0.03 + 0.22 * level(t, k) * (shard.ring ? 1 : 0.5) }) }),
  connecting: (t) => {
    const split = 0.3 * (1 - envelope(cycle(t, 3.2).phase, 0.35, 0.65))
    return { pose: (_, __, angle) => ({ dx: Math.cos(angle) >= 0 ? split : -split }) }
  },
  weaving: (t) => ({ pose: (shard) => ({ orbit: shard.ring ? -t * 0.5 : t * 0.8, push: 0.04 }) }),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return {
      pose: (_, k) => {
        const on = smooth((phase - (k / LARGE.length) * 0.6) / 0.12)
        return { dy: -(1 - on) * 0.8, alpha: on * fade }
      },
    }
  },
  breathing: (t) => ({ pose: (shard) => ({ push: (0.02 + 0.12 * breath(t)) * (shard.ring ? 1 : 0.6) }) }),
  shaping: (t) => ({ pose: () => ({ push: 0.02 }), shape: shapeMorph(t) }),
}

export const shatter: SpinnerSet = {
  id: 'shatter',
  label: 'Shatter',
  icon: { state: 'working', t: 1.0 },
  blurbs: {
    working: 'the disc bursts into shards and pulls back together',
    searching: 'a crack wave runs around the rim',
    solving: 'flying shards snap back into place',
    listening: 'shards lift out with the voice',
    connecting: 'the disc splits in two and rejoins',
    weaving: 'the inner and outer rings turn against each other',
    composing: 'shards drop in one by one',
    breathing: 'the cracks open and close',
    shaping: 'a broken circle, triangle, square',
  },
  draw(state, f) {
    const { pose, shape = ROUND } = BREAKS[state](f.t)
    shards(f, f.compact ? COMPACT : LARGE, pose, shape)
  },
}
