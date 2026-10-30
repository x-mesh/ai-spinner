import { TAU, breath, cycle, envelope, hash, lerp, level, polygonRadius, smooth } from '../math.js'
import { space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Glow {
  x: number
  y: number
  r: number
  /** 0 in focus to 1 fully defocused. */
  blur: number
  alpha?: number
  /** Aperture blades; 0 is round. */
  sides?: number
}

/** Stacked translucent copies from 1 − blur/2 to 1 + blur/2 of the radius give a soft edge at the same peak opacity. */
function glow(f: Frame, { x, y, r, blur, alpha = 0.55, sides = 0 }: Glow) {
  if (r <= 0.005 || alpha <= 0.01) return
  const s = space(f)
  const layers = f.compact ? 4 : 7
  f.ctx.globalAlpha = 1 - (1 - alpha) ** (1 / layers)
  for (let i = 0; i < layers; i++) {
    const k = lerp(1 - blur * 0.5, 1 + blur * 0.5, i / (layers - 1))
    f.ctx.beginPath()
    for (let j = 0; j < 36; j++) {
      const a = (j / 36) * TAU
      const rr = r * k * polygonRadius(sides, a)
      f.ctx.lineTo(s.x(x + Math.cos(a) * rr), s.y(y + Math.sin(a) * rr))
    }
    f.ctx.closePath()
    f.ctx.fill()
  }
}

function ring(n: number, radius: number, turn = 0): [number, number][] {
  return Array.from({ length: n }, (_, k) => [Math.cos(turn + (k * TAU) / n) * radius, Math.sin(turn + (k * TAU) / n) * radius])
}

const SIDES = [0, 5, 6]

const GLOWS: Record<SpinnerState, (t: number) => Glow[]> = {
  working: (t) =>
    [0, 1, 2, 3, 4, 5].map((k) => ({
      x: 0.55 * Math.sin(t * (0.5 + 0.1 * k) + k * 2.1),
      y: 0.5 * Math.cos(t * (0.4 + 0.12 * k) + k * 1.3),
      r: 0.16 + 0.14 * hash(k),
      blur: 0.5 + 0.5 * Math.sin(t * 1.3 + k),
    })),
  searching: (t) => {
    const focus = Math.sin(t * 1.2)
    return ring(5, 0.5, 0.4).map(([x, y], k) => {
      const blur = Math.min(1, Math.abs((k / 4) * 2 - 1 - focus) * 1.2)
      return { x, y, r: 0.2, blur, alpha: 0.75 - 0.35 * blur }
    })
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    return ring(6, 0.5).map(([x, y], k) => ({
      x: lerp(hash(index, k) * 1.2 - 0.6, x, settle),
      y: lerp(hash(index, k, 1) * 1.2 - 0.6, y, settle),
      r: 0.18,
      blur: 1 - settle,
      alpha: 0.45 + 0.35 * settle,
    }))
  },
  listening: (t) => [-0.5, 0, 0.5].map((x, k) => ({ x, y: 0, r: 0.1 + 0.22 * level(t, k), blur: 0.4 })),
  connecting: (t) => {
    const gap = lerp(0.42, 0.12, envelope(cycle(t, 3.2).phase, 0.4, 0.7))
    return [-gap, gap].map((x) => ({ x, y: 0, r: 0.36, blur: 0.5, alpha: 0.5 }))
  },
  weaving: (t) => [
    ...[0, 1, 2].map((k) => ({ x: 0.6 * Math.sin(t * 0.8 + (k * TAU) / 3), y: -0.3 + k * 0.3, r: 0.12, blur: 0.1, alpha: 0.8 })),
    ...[0, 1, 2].map((k) => ({ x: -0.5 * Math.sin(t * 0.6 + (k * TAU) / 3), y: -0.35 + k * 0.35, r: 0.3, blur: 1, alpha: 0.4 })),
  ],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return ring(5, 0.5, -Math.PI / 2).map(([x, y], k) => ({ x, y, r: 0.2, blur: 0.6, alpha: 0.6 * smooth((phase - k * 0.12) / 0.15) * fade }))
  },
  breathing: (t) => [{ x: 0, y: 0, r: 0.5, blur: 0.05 + 0.9 * breath(t), alpha: 0.6 }],
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    const sides = SIDES[index % SIDES.length]
    return ring(4, 0.42, Math.PI / 4).map(([x, y]) => ({ x, y, r: 0.28 * swap, blur: 0.25, sides }))
  },
}

export const bokeh: SpinnerSet = {
  id: 'bokeh',
  label: 'Bokeh',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'out-of-focus lights drift and soften',
    searching: 'the focus racks from one light to the next',
    solving: 'blurry lights snap into focus in a ring',
    listening: 'lights swell with the voice',
    connecting: 'two lights drift into each other',
    weaving: 'sharp near lights pass blurry far ones',
    composing: 'lights fade in one by one',
    breathing: 'a single light drifts in and out of focus',
    shaping: 'round, five-blade, six-blade apertures',
  },
  draw(state, f) {
    GLOWS[state](f.t).forEach((g) => glow(f, g))
  },
}
