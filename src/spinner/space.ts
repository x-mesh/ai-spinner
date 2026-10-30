import { TAU, clamp01 } from './math.js'
import type { Frame } from './types.js'

/** Maps unit space ([-1, 1] spans 80% of the canvas, y down) to canvas pixels. */
export function space(f: Frame) {
  const unit = f.size * 0.4
  const c = f.size / 2
  return {
    x: (u: number) => c + u * unit,
    y: (v: number) => c + v * unit,
    len: (d: number) => d * unit,
  }
}

export function disc(f: Frame, x: number, y: number, r: number, alpha = 1) {
  const s = space(f)
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  f.ctx.arc(s.x(x), s.y(y), s.len(r), 0, TAU)
  f.ctx.fill()
}

export function line(f: Frame, points: [number, number][], alpha = 1) {
  const s = space(f)
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  points.forEach(([x, y]) => f.ctx.lineTo(s.x(x), s.y(y)))
  f.ctx.stroke()
}

/** Line width that stays legible at inline sizes. */
export function strokeWidth(f: Frame, large: number, compact: number) {
  return Math.max(1.25, f.size * (f.compact ? compact : large))
}

export type Rgb = [number, number, number]

/** Canvas normalizes fillStyle to `#rrggbb` or `rgba(r, g, b, a)`; gradients and pixel buffers need the channels. */
export function inkRgb(f: Frame): Rgb {
  const style = f.ctx.fillStyle as string
  if (style.startsWith('#')) {
    return [1, 3, 5].map((i) => parseInt(style.slice(i, i + 2), 16)) as Rgb
  }
  const [r = 0, g = 0, b = 0] = style.match(/[\d.]+/g)?.map(Number) ?? []
  return [r, g, b]
}

const MAX_SCRATCH_RESOLUTION = 128

export function scratchResolution(f: Frame) {
  return Math.min(MAX_SCRATCH_RESOLUTION, Math.round(f.size * 2))
}

interface Scratch {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  image: ImageData
}

const scratches = new Map<number, Scratch>()

/** Offscreen square canvas shared by every spinner; safe because each draw finishes before the next starts. */
export function scratch(resolution: number): Scratch | null {
  let cached = scratches.get(resolution)
  if (!cached) {
    const canvas = document.createElement('canvas')
    canvas.width = resolution
    canvas.height = resolution
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    cached = { canvas, ctx, image: ctx.createImageData(resolution, resolution) }
    scratches.set(resolution, cached)
  }
  return cached
}

/** Unit-space span covered by the canvas: the 0.4 × size unit fits 2.5 times. */
const FIELD_SPAN = 2.5

/** Paints ink coverage (0..1) sampled once per scratch pixel at unit-space (u, v). */
export function paintField(f: Frame, coverage: (u: number, v: number) => number) {
  const resolution = scratchResolution(f)
  const target = scratch(resolution)
  if (!target) return
  const [r, g, b] = inkRgb(f)
  const data = target.image.data
  const step = FIELD_SPAN / resolution
  for (let py = 0; py < resolution; py++) {
    const v = -FIELD_SPAN / 2 + (py + 0.5) * step
    for (let px = 0; px < resolution; px++) {
      const u = -FIELD_SPAN / 2 + (px + 0.5) * step
      const i = (py * resolution + px) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = clamp01(coverage(u, v)) * 255
    }
  }
  target.ctx.putImageData(target.image, 0, 0)
  f.ctx.drawImage(target.canvas, 0, 0, f.size, f.size)
}
