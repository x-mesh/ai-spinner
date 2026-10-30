import { TAU, breath, cycle, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { inkRgb, scratch, scratchResolution, space } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

interface Strip {
  /** Centerline in unit space for u in [0, 1]. */
  path: (u: number) => Point
  /** Twist angle at u: the strip shows its full width at 0 and its edge at π/2. */
  twist: (u: number) => number
  from?: number
  to?: number
  alpha?: number
  widthScale?: number
}

const DU = 0.002

/** Paints the strip as an opaque grayscale mask: gray encodes opacity, so neighboring quads never leave seams. */
function strip(f: Frame, ctx: CanvasRenderingContext2D, { path, twist, from = 0, to = 1, alpha = 1, widthScale = 1 }: Strip) {
  if (to - from < 0.01) return
  const s = space(f)
  const width = (f.compact ? 0.22 : 0.13) * widthScale
  const samples = Math.max(4, Math.ceil((f.compact ? 24 : 64) * (to - from)))
  const edges = Array.from({ length: samples + 1 }, (_, i) => {
    const u = lerp(from, to, i / samples)
    const [x, y] = path(u)
    const [ax, ay] = path(u - DU)
    const [bx, by] = path(u + DU)
    const len = Math.hypot(bx - ax, by - ay) || 1
    const nx = -(by - ay) / len
    const ny = (bx - ax) / len
    const c = Math.cos(twist(u))
    const w = width * c
    return { left: [x + nx * w, y + ny * w] as Point, right: [x - nx * w, y - ny * w] as Point, c }
  })
  for (let i = 0; i < samples; i++) {
    const a = edges[i]
    const b = edges[i + 1]
    const c = (a.c + b.c) / 2
    const shade = alpha * (c >= 0 ? 0.45 + 0.55 * c : 0.2 + 0.3 * -c)
    const gray = Math.round(shade * 255)
    ctx.fillStyle = ctx.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`
    ctx.beginPath()
    ctx.moveTo(s.x(a.left[0]), s.y(a.left[1]))
    ctx.lineTo(s.x(b.left[0]), s.y(b.left[1]))
    ctx.lineTo(s.x(b.right[0]), s.y(b.right[1]))
    ctx.lineTo(s.x(a.right[0]), s.y(a.right[1]))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

/** Draws strips back to front into the mask, then tints the mask with the ink color. */
function render(f: Frame, strips: Strip[]) {
  const resolution = scratchResolution(f)
  const target = scratch(resolution)
  if (!target) return
  const { canvas, ctx } = target
  ctx.setTransform(resolution / f.size, 0, 0, resolution / f.size, 0, 0)
  ctx.clearRect(0, 0, f.size, f.size)
  ctx.lineWidth = f.size / resolution
  ctx.lineJoin = 'round'
  ;[...strips].sort((a, b) => (a.alpha ?? 1) - (b.alpha ?? 1)).forEach((s) => strip(f, ctx, s))
  const pixels = ctx.getImageData(0, 0, resolution, resolution)
  const data = pixels.data
  const [r, g, b] = inkRgb(f)
  for (let i = 0; i < data.length; i += 4) {
    const opacity = (data[i] * data[i + 3]) / 255
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = opacity
  }
  ctx.putImageData(pixels, 0, 0)
  f.ctx.globalAlpha = 1
  f.ctx.drawImage(canvas, 0, 0, f.size, f.size)
}

function loop(radius: (a: number) => number, r: number): (u: number) => Point {
  return (u) => {
    const a = u * TAU
    const rr = r * radius(a)
    return [Math.cos(a) * rr, Math.sin(a) * rr]
  }
}

const RIBBONS: Record<SpinnerState, (t: number) => Strip[]> = {
  working: (t) => [{ path: (u) => [lerp(-0.9, 0.9, u), 0.28 * Math.sin(u * TAU + t * 2)], twist: (u) => u * TAU + t * 2 }],
  searching: (t) => [{ path: loop(() => 1, 0.62), twist: (u) => u * Math.PI + t * 1.5 }],
  solving: (t) => {
    const { index, phase } = cycle(t, 3)
    const chaos = 1 - smooth((phase - 0.35) / 0.4)
    const seed = hash(index) * TAU
    return [
      {
        path: (u) => [lerp(-0.85, 0.85, u), chaos * 0.45 * Math.sin(u * 9 + t * 5 + seed)],
        twist: (u) => chaos * (u * TAU * 2 + t * 4),
      },
    ]
  },
  listening: (t) => {
    const amp = 0.08 + 0.35 * level(t, 0)
    return [{ path: (u) => [lerp(-0.9, 0.9, u), amp * Math.sin(u * TAU * 1.5 - t * 4)], twist: (u) => u * 2 + t }]
  },
  connecting: (t) => {
    const { phase } = cycle(t, 3.2)
    return [
      {
        path: (u) => [lerp(-0.85, 0.85, u), -0.35 * Math.sin(u * Math.PI)],
        twist: (u) => u * TAU * 1.5 + t,
        to: smooth(phase / 0.6),
        alpha: 1 - smooth((phase - 0.85) / 0.15),
      },
    ]
  },
  weaving: (t) =>
    [0, 1].map((j) => ({
      path: (u: number): Point => [lerp(-0.9, 0.9, u), 0.3 * Math.sin(u * TAU * 1.2 + t * 2 + j * Math.PI)],
      twist: (u: number) => t * 2 + u * 3 + j,
      alpha: j ? 0.6 : 1,
    })),
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    return [
      {
        path: (u) => {
          const a = u * TAU * 1.6 + t * 0.5
          const r = 0.12 + 0.68 * u
          return [Math.cos(a) * r, Math.sin(a) * r]
        },
        twist: (u) => u * 4,
        to: smooth(phase / 0.7),
        alpha: 1 - smooth((phase - 0.85) / 0.15),
      },
    ]
  },
  breathing: (t) => [{ path: loop(() => 1, 0.55), twist: (u) => u * TAU * 2 + t * 0.6, widthScale: 0.6 + 0.8 * breath(t) }],
  shaping: (t) => [{ path: loop(shapeMorph(t), 0.75), twist: (u) => u * TAU + t }],
}

export const ribbon: SpinnerSet = {
  id: 'ribbon',
  label: 'Ribbon',
  icon: { state: 'searching', t: 2.9 },
  blurbs: {
    working: 'a ribbon ripples and turns',
    searching: 'a Möbius loop rolls around',
    solving: 'a tangled ribbon pulls straight and flat',
    listening: 'a streamer waves with the voice',
    connecting: 'a ribbon arches from end to end',
    weaving: 'two streamers wind past each other',
    composing: 'a ribbon unrolls into a spiral',
    breathing: 'a ring of ribbon swells and narrows',
    shaping: 'a twisted band in circle, triangle, square',
  },
  draw: (state, f) => render(f, RIBBONS[state](f.t)),
}
