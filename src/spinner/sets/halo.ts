import { TAU, breath, cycle, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { inkRgb } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Halo {
  f: Frame
  rgb: string
}

/** Soft disc at (x, y) in unit space with radius r. */
function glow({ f, rgb }: Halo, x: number, y: number, r: number, alpha = 1) {
  const unit = f.size * 0.4
  const px = f.size / 2 + x * unit
  const py = f.size / 2 + y * unit
  const g = f.ctx.createRadialGradient(px, py, 0, px, py, r * unit)
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`)
  g.addColorStop(0.45, `rgba(${rgb}, ${alpha * 0.55})`)
  g.addColorStop(1, `rgba(${rgb}, 0)`)
  f.ctx.fillStyle = g
  f.ctx.beginPath()
  f.ctx.arc(px, py, r * unit, 0, TAU)
  f.ctx.fill()
}

const HALOS: Record<SpinnerState, (h: Halo) => void> = {
  working: (h) => {
    for (let k = 0; k < 3; k++) {
      const a = h.f.t * (1.2 + k * 0.5) + k * 2
      glow(h, Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.5, 0.7)
    }
  },
  searching: (h) => {
    glow(h, 0, 0, 0.45, 0.35)
    const a = h.f.t * 2.4
    glow(h, Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.45, 0.95)
  },
  solving: (h) => {
    const { index, phase } = cycle(h.f.t, 3)
    const settle = smooth((phase - 0.35) / 0.4)
    const jitter = Math.floor(h.f.t / 0.15)
    const count = h.f.compact ? 3 : 5
    for (let j = 0; j < count; j++) {
      const x = (hash(index, j, jitter, 1) * 2 - 1) * 0.7
      const y = (hash(index, j, jitter, 2) * 2 - 1) * 0.7
      glow(h, lerp(x, 0, settle), lerp(y, 0, settle), lerp(0.35, 0.6, settle), lerp(0.75, 0.4, settle))
    }
  },
  listening: (h) => glow(h, 0, 0, 0.45 + 0.55 * level(h.f.t, 0), 0.95),
  connecting: (h) => {
    const { phase } = cycle(h.f.t, 2.8)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    glow(h, -0.65, 0, 0.4, 0.8)
    glow(h, 0.65, 0, 0.4, 0.8)
    const travel = smooth((phase - 0.15) / 0.6)
    if (travel > 0 && travel < 1) glow(h, lerp(-0.65, 0.65, travel), 0, 0.35, fade)
  },
  weaving: (h) => {
    for (let j = 0; j < 2; j++) {
      const s = h.f.t * 1.8 + j * Math.PI
      const d = 1 + Math.sin(s) ** 2
      glow(h, (Math.cos(s) / d) * 0.85, ((Math.sin(s) * Math.cos(s)) / d) * 1.1, 0.45, 0.85)
    }
  },
  composing: (h) => {
    const { phase } = cycle(h.f.t, 3.4)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const count = h.f.compact ? 2 : 4
    for (let j = 0; j < count; j++) {
      const on = smooth((phase - j * 0.15) / 0.15) * fade
      if (on > 0.01) glow(h, lerp(-0.7, 0.7, j / (count - 1)), 0, 0.32, on)
    }
  },
  breathing: (h) => {
    const b = breath(h.f.t)
    glow(h, 0, 0, 0.55 + 0.45 * b, 0.5 + 0.5 * b)
  },
  shaping: (h) => {
    const radius = shapeMorph(h.f.t)
    const count = h.f.compact ? 6 : 12
    for (let j = 0; j < count; j++) {
      const a = (j / count) * TAU
      const r = 0.75 * radius(a)
      glow(h, Math.cos(a) * r, Math.sin(a) * r, 0.24, 0.9)
    }
  },
}

export const halo: SpinnerSet = {
  id: 'halo',
  label: 'Halo',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'three glows circle and blend',
    searching: 'a beacon sweeps around a dim core',
    solving: 'scattered sparks gather into one light',
    listening: 'a glow that brightens with the voice',
    connecting: 'a spark travels between two lights',
    weaving: 'two glows trace a figure eight',
    composing: 'lights come on left to right',
    breathing: 'a soft light swells and dims',
    shaping: 'a ring of sparks finds each shape',
  },
  draw(state, f) {
    HALOS[state]({ f, rgb: inkRgb(f).join(', ') })
  },
}
