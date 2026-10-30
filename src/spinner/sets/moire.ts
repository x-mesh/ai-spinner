import { TAU, breath, cycle, envelope, level, shapeMorph, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const CLIP_RADIUS = 0.95

interface Rings {
  kind: 'rings'
  x: number
  y: number
  spacing?: number
  /** Outline radius by canvas angle; defaults to circles. */
  shape?: (a: number) => number
  limit?: number
}

interface Lines {
  kind: 'lines'
  angle: number
  spacing?: number
}

type Grating = Rings | Lines

function baseSpacing(f: Frame) {
  return f.compact ? 0.24 : 0.105
}

function drawGrating(f: Frame, g: Grating) {
  const s = space(f)
  const spacing = g.spacing ?? baseSpacing(f)
  f.ctx.beginPath()
  if (g.kind === 'lines') {
    const dx = Math.cos(g.angle)
    const dy = Math.sin(g.angle)
    for (let d = -1.4; d <= 1.4; d += spacing) {
      const cx = -dy * d
      const cy = dx * d
      f.ctx.moveTo(s.x(cx - dx * 1.5), s.y(cy - dy * 1.5))
      f.ctx.lineTo(s.x(cx + dx * 1.5), s.y(cy + dy * 1.5))
    }
  } else {
    const count = Math.min(g.limit ?? Infinity, Math.ceil(1.6 / spacing))
    for (let i = 1; i <= count; i++) {
      const r = i * spacing
      if (g.shape) {
        for (let j = 0; j <= 64; j++) {
          const a = (j / 64) * TAU
          const rr = r * g.shape(a)
          const px = s.x(g.x + Math.cos(a) * rr)
          const py = s.y(g.y + Math.sin(a) * rr)
          if (j === 0) f.ctx.moveTo(px, py)
          else f.ctx.lineTo(px, py)
        }
      } else {
        f.ctx.moveTo(s.x(g.x + r), s.y(g.y))
        f.ctx.arc(s.x(g.x), s.y(g.y), s.len(r), 0, TAU)
      }
    }
  }
  f.ctx.stroke()
}

const MOIRES: Record<SpinnerState, (f: Frame) => Grating[]> = {
  working: (f) => {
    const x = Math.cos(f.t) * 0.12
    const y = Math.sin(f.t) * 0.12
    return [{ kind: 'rings', x, y }, { kind: 'rings', x: -x, y: -y }]
  },
  searching: (f) => [{ kind: 'rings', x: 0, y: 0 }, { kind: 'rings', x: Math.sin(f.t * 1.3) * 0.5, y: 0 }],
  solving: (f) => {
    const { phase } = cycle(f.t, 3)
    const d = 0.45 * (1 - smooth((phase - 0.3) / 0.45))
    return [{ kind: 'rings', x: -d, y: d * 0.3 }, { kind: 'rings', x: d, y: -d * 0.3 }]
  },
  listening: (f) => [
    { kind: 'rings', x: 0, y: 0 },
    { kind: 'rings', x: 0.04, y: 0, spacing: baseSpacing(f) * (1 + 0.14 * level(f.t, 0)) },
  ],
  connecting: (f) => {
    const gap = 0.5 * (1 - envelope(cycle(f.t, 3.2).phase, 0.4, 0.7)) + 0.03
    return [{ kind: 'lines', angle: gap / 2 }, { kind: 'lines', angle: -gap / 2 }]
  },
  weaving: (f) => [{ kind: 'lines', angle: f.t * 0.4 }, { kind: 'lines', angle: -f.t * 0.4 }],
  composing: (f) => {
    const { phase } = cycle(f.t, 3.4)
    const limit = Math.ceil(smooth(phase / 0.75) * 20 * (1 - smooth((phase - 0.88) / 0.12)))
    return [{ kind: 'rings', x: -0.1, y: 0, limit }, { kind: 'rings', x: 0.1, y: 0, limit }]
  },
  breathing: (f) => [
    { kind: 'rings', x: 0, y: 0 },
    { kind: 'rings', x: 0, y: 0, spacing: baseSpacing(f) * (1 + 0.08 * breath(f.t)) },
  ],
  shaping: (f) => [{ kind: 'rings', x: 0, y: 0 }, { kind: 'rings', x: 0, y: 0, shape: shapeMorph(f.t) }],
}

export const moire: SpinnerSet = {
  id: 'moire',
  label: 'Moiré',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'two ring sets orbit, fringes swirl',
    searching: 'a ring set slides across another',
    solving: 'busy fringes resolve into clean rings',
    listening: 'fringes ripple with the voice',
    connecting: 'two gratings align until the fringes vanish',
    weaving: 'crossed gratings turn against each other',
    composing: 'rings spread out from two centers',
    breathing: 'fringes bloom outward and fold back',
    shaping: 'circle, triangle, square hidden in fringes',
  },
  draw(state, f) {
    const s = space(f)
    f.ctx.lineWidth = strokeWidth(f, 0.016, 0.05)
    f.ctx.globalAlpha = 0.7
    f.ctx.save()
    f.ctx.beginPath()
    f.ctx.arc(s.x(0), s.y(0), s.len(CLIP_RADIUS), 0, TAU)
    f.ctx.clip()
    MOIRES[state](f).forEach((g) => drawGrating(f, g))
    f.ctx.restore()
  },
}
