import { TAU, breath, cycle, hash, level, shapeMorph, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const TOP = -Math.PI / 2
const TRACK_ALPHA = 0.12

interface Dial {
  f: Frame
  rings: number
}

function ringRadius({ f, rings }: Dial, k: number) {
  return f.size * 0.4 * (1 - (k * 0.62) / rings)
}

function arc(d: Dial, k: number, start: number, sweep: number, alpha = 1) {
  if (sweep <= 0.001) return
  d.f.ctx.globalAlpha = alpha
  d.f.ctx.beginPath()
  d.f.ctx.arc(d.f.size / 2, d.f.size / 2, ringRadius(d, k), start, start + Math.min(sweep, TAU))
  d.f.ctx.stroke()
}

function tracks(d: Dial) {
  for (let k = 0; k < d.rings; k++) arc(d, k, 0, TAU, TRACK_ALPHA)
}

function eachRing(d: Dial, paint: (k: number) => void) {
  for (let k = 0; k < d.rings; k++) paint(k)
}

const DIALS: Record<SpinnerState, (d: Dial) => void> = {
  working: (d) => {
    tracks(d)
    eachRing(d, (k) => arc(d, k, d.f.t * (1.6 + k * 0.7) * (k % 2 ? -1 : 1), TAU * 0.28))
  },
  searching: (d) => {
    tracks(d)
    eachRing(d, (k) => arc(d, k, d.f.t * 2.4 * (k % 2 ? -0.7 : 1) + k, TAU * 0.1))
  },
  solving: (d) => {
    const { index, phase } = cycle(d.f.t, 3)
    const settle = smooth((phase - 0.35) / 0.35)
    const gap = TAU * 0.22
    eachRing(d, (k) => {
      const spin = (1 - settle) * (hash(index, k) * TAU * 2 + d.f.t * (2 + k))
      arc(d, k, TOP + gap / 2 + spin, TAU - gap)
    })
  },
  listening: (d) => {
    tracks(d)
    eachRing(d, (k) => {
      const sweep = TAU * (0.06 + 0.32 * level(d.f.t, k))
      arc(d, k, TOP - sweep / 2, sweep)
      arc(d, k, -TOP - sweep / 2, sweep, 0.6)
    })
  },
  connecting: (d) => {
    const { phase } = cycle(d.f.t, 3)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    tracks(d)
    eachRing(d, (k) => arc(d, k, TOP, TAU * smooth((phase - k * 0.15) / 0.35), fade))
  },
  weaving: (d) => {
    eachRing(d, (k) => {
      const front = k % 2 === 0
      arc(d, k, d.f.t * 2 + k, TAU * 0.22, front ? 1 : 0.45)
      arc(d, k, -d.f.t * 2 + k + Math.PI, TAU * 0.22, front ? 0.45 : 1)
    })
  },
  composing: (d) => {
    const ticks = d.f.compact ? 6 : 12
    const { phase } = cycle(d.f.t, 4)
    const lit = smooth(phase / 0.7) * ticks * d.rings
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const step = TAU / ticks
    eachRing(d, (k) => {
      for (let i = 0; i < ticks; i++) {
        const on = lit > k * ticks + i
        arc(d, k, TOP + i * step + step * 0.2, step * 0.6, on ? fade : TRACK_ALPHA)
      }
    })
  },
  breathing: (d) => {
    const b = breath(d.f.t)
    const { ctx, size } = d.f
    const width = ctx.lineWidth
    ctx.lineWidth = width * (0.6 + 0.7 * b)
    ctx.globalAlpha = 0.45 + 0.55 * b
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, ringRadius(d, 0) * (0.7 + 0.3 * b), 0, TAU)
    ctx.stroke()
    ctx.lineWidth = width
  },
  shaping: (d) => {
    const radius = shapeMorph(d.f.t)
    const { ctx, size } = d.f
    const r = ringRadius(d, 0) * 0.95
    ctx.globalAlpha = 1
    ctx.beginPath()
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU
      const p = r * radius(a)
      ctx.lineTo(size / 2 + Math.cos(a) * p, size / 2 + Math.sin(a) * p)
    }
    ctx.closePath()
    ctx.stroke()
  },
}

export const dial: SpinnerSet = {
  id: 'dial',
  label: 'Dial',
  icon: { state: 'working', t: 1.9 },
  blurbs: {
    working: 'arcs chase each other around the rings',
    searching: 'short needles sweep in opposite directions',
    solving: 'rings spin, then lock their gaps at the top',
    listening: 'arcs open and close with the voice',
    connecting: 'rings close one after another',
    weaving: 'arcs cross over and under between rings',
    composing: 'tick marks fill like a clock face',
    breathing: 'one ring swells and thins',
    shaping: 'circle, triangle, square in outline',
  },
  draw(state, f) {
    f.ctx.lineWidth = f.size * (f.compact ? 0.11 : 0.065)
    DIALS[state]({ f, rings: f.compact ? 2 : 3 })
  },
}
