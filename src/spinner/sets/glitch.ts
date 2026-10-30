import { TAU, breath, cycle, envelope, hash, level, shapeMorph, smooth } from '../math.js'
import { space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const TOP = -0.85
const HEIGHT = 1.7

interface Slices {
  /** Horizontal shift of slice i in unit space. */
  offset?: (i: number, y: number) => number
  /** Fraction of each slice left empty, turning the shape into stripes. */
  gap?: number
  visible?: (i: number) => number
  radius?: (a: number) => number
}

/** Draws a solid shape cut into horizontal bands that can slide independently. */
function sliced(f: Frame, { offset = () => 0, gap = 0.08, visible = () => 1, radius = () => 1 }: Slices) {
  const s = space(f)
  const n = f.compact ? 5 : 12
  const band = HEIGHT / n
  for (let i = 0; i < n; i++) {
    const alpha = visible(i)
    if (alpha <= 0.01) continue
    const y = TOP + i * band
    f.ctx.save()
    f.ctx.beginPath()
    f.ctx.rect(0, s.y(y), f.size, s.len(band * (1 - gap)))
    f.ctx.clip()
    f.ctx.translate(s.len(offset(i, y + band / 2)), 0)
    f.ctx.globalAlpha = alpha
    f.ctx.beginPath()
    for (let j = 0; j < 72; j++) {
      const a = (j / 72) * TAU
      const r = 0.8 * radius(a)
      f.ctx.lineTo(s.x(Math.cos(a) * r), s.y(Math.sin(a) * r))
    }
    f.ctx.closePath()
    f.ctx.fill()
    f.ctx.restore()
  }
}

const GLITCHES: Record<SpinnerState, (f: Frame) => Slices> = {
  working: (f) => {
    const burst = f.t % 0.9 < 0.15
    const tick = Math.floor(f.t / 0.05)
    return { offset: (i) => (burst ? (hash(tick, i) - 0.5) * 0.5 : 0) }
  },
  searching: (f) => {
    const scan = ((f.t * 0.8) % 1) * 2.2 - 1.1
    return { offset: (i, y) => Math.exp(-(((y - scan) / 0.2) ** 2)) * 0.3 * Math.sin(f.t * 20 + i) }
  },
  solving: (f) => {
    const { phase } = cycle(f.t, 3)
    const noise = 1 - smooth((phase - 0.2) / 0.5)
    const tick = Math.floor(f.t / 0.06)
    return { offset: (i) => (hash(tick, i) - 0.5) * 0.9 * noise }
  },
  listening: (f) => ({ offset: (i) => (i % 2 ? 1 : -1) * 0.25 * level(f.t, i) }),
  connecting: (f) => {
    const split = 0.4 * (1 - envelope(cycle(f.t, 3).phase, 0.4, 0.7))
    const n = f.compact ? 5 : 12
    return { offset: (i) => (i < n / 2 ? -split : split) }
  },
  weaving: (f) => ({ offset: (i) => Math.sin(f.t * 3 + i * 0.9) * 0.18 * (i % 2 ? 1 : -1) }),
  composing: (f) => {
    const { phase } = cycle(f.t, 3.4)
    const n = f.compact ? 5 : 12
    const shown = smooth(phase / 0.6) * n
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return { visible: (i) => Math.min(1, Math.max(0, shown - i)) * fade }
  },
  breathing: (f) => ({ gap: 0.08 + 0.55 * breath(f.t) }),
  shaping: (f) => {
    const { phase } = cycle(f.t, 1.8)
    const morphing = phase > 1.1 / 1.8
    const tick = Math.floor(f.t / 0.05)
    return { radius: shapeMorph(f.t), offset: (i) => (morphing ? (hash(tick, i) - 0.5) * 0.35 : 0) }
  },
}

export const glitch: SpinnerSet = {
  id: 'glitch',
  label: 'Glitch',
  icon: { state: 'weaving', t: 1.9 },
  blurbs: {
    working: 'a solid disc with brief signal hiccups',
    searching: 'a scan line drags slices sideways',
    solving: 'heavy interference clears to a clean image',
    listening: 'slices jitter with the voice',
    connecting: 'the image splits in half and snaps back',
    weaving: 'interlaced rows slide past each other',
    composing: 'the image loads line by line',
    breathing: 'the shape breaks into stripes and back',
    shaping: 'each shape change glitches through',
  },
  draw: (state, f) => sliced(f, GLITCHES[state](f)),
}
