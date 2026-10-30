import { breath, cycle, hash, lerp, level, smooth } from '../math.js'
import { disc, line, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Wedge {
  f: Frame
  /** Wedge angle in radians. */
  w: number
  /** Mark scale; compact layouts use heavier marks. */
  k: number
  alpha: number
}

type Motif = (wedge: Wedge) => void

/** Point at radius r and angle a inside the wedge. */
function polar(r: number, a: number): [number, number] {
  return [Math.cos(a) * r, Math.sin(a) * r]
}

/** Repeats the motif around the center, mirroring every other wedge like a kaleidoscope. */
function mirror(f: Frame, segments: number, motif: Motif, alpha = 1) {
  const w = (Math.PI * 2) / segments
  const c = f.size / 2
  const k = f.compact ? 1.5 : 1
  for (let i = 0; i < segments; i++) {
    f.ctx.save()
    f.ctx.translate(c, c)
    if (i % 2) {
      f.ctx.rotate((i + 1) * w)
      f.ctx.scale(1, -1)
    } else {
      f.ctx.rotate(i * w)
    }
    f.ctx.beginPath()
    f.ctx.moveTo(0, 0)
    f.ctx.arc(0, 0, f.size, -0.001, w + 0.001)
    f.ctx.closePath()
    f.ctx.clip()
    f.ctx.translate(-c, -c)
    motif({ f, w, k, alpha })
    f.ctx.restore()
  }
}

const MOTIFS: Record<SpinnerState, (t: number) => Motif> = {
  working: (t) => ({ f, w, k, alpha }) => {
    disc(f, ...polar(0.3 + 0.25 * Math.sin(t * 2), w * 0.5), 0.1 * k, alpha)
    disc(f, ...polar(0.6 + 0.2 * Math.sin(t * 2.7 + 1), w * 0.2), 0.07 * k, alpha)
  },
  searching: (t) => ({ f, w, k, alpha }) => {
    disc(f, ...polar(0.55, (0.5 + 0.5 * Math.sin(t * 1.5)) * w), 0.12 * k, alpha)
    disc(f, ...polar(0.15, w / 2), 0.06 * k, alpha)
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3)
    const settle = smooth((phase - 0.3) / 0.45)
    const tick = Math.floor(t / 0.15)
    return ({ f, w, k, alpha }) => {
      ;[0.3, 0.6].forEach((r, j) => {
        const rr = lerp(0.2 + hash(index, j, tick) * 0.7, r, settle)
        const a = lerp(hash(index, j, tick, 1) * w, w / 2, settle)
        disc(f, ...polar(rr, a), 0.09 * k, alpha)
      })
    }
  },
  listening: (t) => ({ f, w, k, alpha }) => {
    disc(f, ...polar(0.3, w / 2), (0.05 + 0.1 * level(t, 0)) * k, alpha)
    disc(f, ...polar(0.65, w / 2), (0.04 + 0.1 * level(t, 1)) * k, alpha)
  },
  connecting: (t) => {
    const { phase } = cycle(t, 3)
    const grown = smooth(phase / 0.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return ({ f, w, k, alpha }) => {
      const [ax, ay] = polar(0.2, 0)
      const [bx, by] = polar(0.8, w)
      line(f, [[ax, ay], [lerp(ax, bx, grown), lerp(ay, by, grown)]], alpha * fade)
      disc(f, ax, ay, 0.06 * k, alpha * fade)
      if (grown > 0.98) disc(f, bx, by, 0.06 * k, alpha * fade)
    }
  },
  weaving: (t) => ({ f, w, alpha }) => {
    const [cx, cy] = polar(0.5, w / 2)
    const dx = Math.cos(t * 1.5) * 0.3
    const dy = Math.sin(t * 1.5) * 0.3
    line(f, [[cx - dx, cy - dy], [cx + dx, cy + dy]], alpha)
  },
  composing: (t) => {
    const { phase } = cycle(t, 3.4)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return ({ f, w, k, alpha }) => {
      ;[0.2, 0.4, 0.6, 0.8].forEach((r, j) => {
        const on = smooth((phase - j * 0.15) / 0.12) * fade
        if (on > 0.01) disc(f, ...polar(r, w * (0.3 + 0.1 * j)), 0.07 * k * on, alpha)
      })
    }
  },
  breathing: (t) => ({ f, w, k, alpha }) => disc(f, ...polar(0.3 + 0.35 * breath(t), w / 2), 0.1 * k, alpha),
  shaping: () => ({ f, w, k, alpha }) => {
    disc(f, ...polar(0.6, w / 2), 0.1 * k, alpha)
    line(f, [polar(0.25, 0), polar(0.25, w)], alpha)
  },
}

const SEGMENTS = [4, 6, 8]

export const kaleido: SpinnerSet = {
  id: 'kaleido',
  label: 'Kaleido',
  icon: { state: 'solving', t: 2.4 },
  blurbs: {
    working: 'beads slide in and out of a six-way mirror',
    searching: 'a bead sweeps across the mirror seam',
    solving: 'loose beads line up into a snowflake',
    listening: 'beads swell with the voice',
    connecting: 'threads draw a star across the mirrors',
    weaving: 'turning sticks weave a lattice',
    composing: 'beads drop in from the center outward',
    breathing: 'a ring of beads opens and closes',
    shaping: 'four, six, eight mirrors',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.03, 0.08)
    if (state === 'shaping') {
      const { index, phase } = cycle(f.t, 1.8)
      const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
      mirror(f, SEGMENTS[index % SEGMENTS.length], MOTIFS.shaping(f.t), swap)
      return
    }
    mirror(f, 6, MOTIFS[state](f.t))
  },
}
