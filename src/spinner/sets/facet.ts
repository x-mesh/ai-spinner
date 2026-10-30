import { TAU, breath, cycle, hash, lerp, level, polygonRadius, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Strokes a regular polygon in unit space; `progress` < 1 draws only part of the outline. */
function polygon(f: Frame, sides: number, r: number, rotate: number, alpha = 1, progress = 1, step = 1) {
  if (progress <= 0) return
  const unit = f.size * 0.4
  const vertex = (k: number): [number, number] => {
    const a = -Math.PI / 2 + rotate + (k * step * TAU) / sides
    return [f.size / 2 + Math.cos(a) * r * unit, f.size / 2 + Math.sin(a) * r * unit]
  }
  const edges = progress * sides
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  f.ctx.moveTo(...vertex(0))
  for (let k = 1; k <= Math.floor(edges); k++) f.ctx.lineTo(...vertex(k))
  const rest = edges - Math.floor(edges)
  if (rest > 0) {
    const [ax, ay] = vertex(Math.floor(edges))
    const [bx, by] = vertex(Math.floor(edges) + 1)
    f.ctx.lineTo(lerp(ax, bx, rest), lerp(ay, by, rest))
  }
  if (progress >= 1) f.ctx.closePath()
  f.ctx.stroke()
}

const FACETS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    polygon(f, 4, 0.92, f.t * 0.8)
    polygon(f, 3, 0.55, -f.t * 1.3, 0.7)
  },
  searching: (f) => {
    polygon(f, 6, 0.92, 0, 0.25)
    polygon(f, 3, 0.92, f.t * 1.5)
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3)
    const settle = smooth((phase - 0.35) / 0.35)
    for (let k = 0; k < 3; k++) {
      polygon(f, 4, 0.8, (1 - settle) * (hash(index, k) * TAU + f.t * (1 + k)), 0.65)
    }
  },
  listening: (f) => {
    const rings = f.compact ? 2 : 3
    for (let k = 0; k < rings; k++) {
      const v = level(f.t, k)
      polygon(f, 6, (0.35 + (k * 0.55) / (rings - 1)) * (1 + 0.15 * v), 0, 0.4 + 0.6 * v)
    }
  },
  connecting: (f) => {
    const { phase } = cycle(f.t, 3.2)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    polygon(f, 5, 0.85, 0, fade, smooth(phase / 0.35))
    polygon(f, 5, 0.85, 0, 0.6 * fade, smooth((phase - 0.35) / 0.35), 2)
    const unit = f.size * 0.4
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 5
      f.ctx.globalAlpha = 1
      f.ctx.beginPath()
      f.ctx.arc(f.size / 2 + Math.cos(a) * 0.85 * unit, f.size / 2 + Math.sin(a) * 0.85 * unit, f.ctx.lineWidth * 1.1, 0, TAU)
      f.ctx.fill()
    }
  },
  weaving: (f) => {
    polygon(f, 3, 0.88, f.t)
    polygon(f, 3, 0.88, -f.t + Math.PI, 0.55)
  },
  composing: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const sides = 3 + (index % 4)
    polygon(f, sides, 0.85, 0, 1 - smooth((phase - 0.85) / 0.15), smooth(phase / 0.6))
  },
  breathing: (f) => {
    const b = breath(f.t)
    polygon(f, 4, 0.6 + 0.3 * b, f.t * 0.2 + Math.PI / 4)
    polygon(f, 4, 0.35 + 0.15 * (1 - b), -f.t * 0.2, 0.6)
  },
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.6)
    const blend = smooth((phase - 0.55) / 0.45)
    const from = 3 + (index % 4)
    const to = 3 + ((index + 1) % 4)
    const unit = f.size * 0.4
    f.ctx.globalAlpha = 1
    f.ctx.beginPath()
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU
      const r = 0.9 * unit * lerp(polygonRadius(from, a), polygonRadius(to, a), blend)
      f.ctx.lineTo(f.size / 2 + Math.cos(a) * r, f.size / 2 + Math.sin(a) * r)
    }
    f.ctx.closePath()
    f.ctx.stroke()
  },
}

export const facet: SpinnerSet = {
  id: 'facet',
  label: 'Facet',
  icon: { state: 'working', t: 0.4 },
  blurbs: {
    working: 'a triangle turns inside a square',
    searching: 'a triangle sweeps a hexagon frame',
    solving: 'three squares spin, then stack as one',
    listening: 'nested hexagons pulse with the voice',
    connecting: 'a pentagon draws, then its star',
    weaving: 'two triangles counter-rotate',
    composing: 'outlines draw with one more side each time',
    breathing: 'two squares trade size',
    shaping: 'triangle to hexagon, one side at a time',
  },
  draw(state, f) {
    f.ctx.lineWidth = Math.max(1.25, f.size * (f.compact ? 0.08 : 0.04))
    FACETS[state](f)
  },
}
