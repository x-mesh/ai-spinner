import { TAU, breath, cycle, hash, lerp, level, shapeMorph, smooth } from '../math.js'
import { disc, inkRgb, line, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type Point = [number, number]

const RIM = 0.85
/** Radians of afterglow behind the beam. */
const TRAIL = 1.6

function outline(f: Frame, rim: (a: number) => number, radius = RIM) {
  const s = space(f)
  f.ctx.beginPath()
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * TAU
    f.ctx.lineTo(s.x(Math.cos(a) * radius * rim(a)), s.y(Math.sin(a) * radius * rim(a)))
  }
}

/** Beam with a conic afterglow; `dir` is the direction the beam is moving, so the glow trails behind it. */
function sweep(f: Frame, angle: number, dir = 1, alpha = 1, rim: (a: number) => number = () => 1) {
  const s = space(f)
  const [r, g, b] = inkRgb(f)
  const start = dir > 0 ? angle - TRAIL : angle
  const glow = f.ctx.createConicGradient(start, s.x(0), s.y(0))
  const span = TRAIL / TAU
  const lit = `rgba(${r}, ${g}, ${b}, ${0.55 * alpha})`
  const dark = `rgba(${r}, ${g}, ${b}, 0)`
  glow.addColorStop(0, dir > 0 ? dark : lit)
  glow.addColorStop(span, dir > 0 ? lit : dark)
  glow.addColorStop(Math.min(1, span + 0.001), dark)
  glow.addColorStop(1, dark)
  f.ctx.save()
  f.ctx.globalAlpha = 1
  f.ctx.fillStyle = glow
  outline(f, rim)
  f.ctx.fill()
  f.ctx.restore()
  line(f, [[0, 0], [Math.cos(angle) * RIM * rim(angle), Math.sin(angle) * RIM * rim(angle)]], alpha)
}

/** Contacts light up as the beam passes and fade before it comes round again. */
function blips(f: Frame, angle: number, points: Point[], dir = 1) {
  points.forEach(([x, y]) => {
    const behind = ((((angle - Math.atan2(y, x)) * dir) % TAU) + TAU) % TAU
    disc(f, x, y, f.compact ? 0.11 : 0.055, Math.max(0, 1 - behind / (TAU * 0.75)))
  })
}

function ping(f: Frame, radius: number, alpha: number) {
  if (radius <= 0.01 || alpha <= 0.01) return
  const s = space(f)
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  f.ctx.arc(s.x(0), s.y(0), s.len(radius), 0, TAU)
  f.ctx.stroke()
}

function scope(f: Frame, rim: (a: number) => number = () => 1, alpha = 0.3) {
  f.ctx.globalAlpha = alpha
  outline(f, rim)
  f.ctx.stroke()
}

function contacts(seed: number, n = 4): Point[] {
  return Array.from({ length: n }, (_, k): Point => {
    const a = hash(seed, k) * TAU
    const r = 0.25 + 0.5 * hash(seed, k, 1)
    return [Math.cos(a) * r, Math.sin(a) * r]
  })
}

const SCREENS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const angle = f.t * 2.5
    scope(f)
    sweep(f, angle)
    blips(f, angle, contacts(Math.floor(f.t / 7.5)))
  },
  searching: (f) => {
    const angle = -Math.PI / 2 + Math.sin(f.t * 1.5) * 1.1
    const dir = Math.cos(f.t * 1.5) >= 0 ? 1 : -1
    scope(f)
    sweep(f, angle, dir)
    blips(f, angle, [[-0.35, -0.45], [0.3, -0.55], [0.05, -0.3]], dir)
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.2)
    const settle = smooth((phase - 0.3) / 0.45)
    const target: Point = [0.3, -0.25]
    scope(f)
    contacts(index, 5).forEach(([x, y]) => disc(f, lerp(x, target[0], settle), lerp(y, target[1], settle), f.compact ? 0.1 : 0.05))
    const s = space(f)
    f.ctx.globalAlpha = smooth((settle - 0.7) / 0.3)
    f.ctx.beginPath()
    f.ctx.arc(s.x(target[0]), s.y(target[1]), s.len(0.16), 0, TAU)
    f.ctx.stroke()
  },
  listening: (f) => {
    scope(f)
    for (let k = 0; k < 3; k++) {
      const age = (f.t * 0.6 + k / 3) % 1
      ping(f, age * RIM, (1 - age) * (0.2 + 0.8 * level(f.t - age, 0)))
    }
    disc(f, 0, 0, f.compact ? 0.1 : 0.05)
  },
  connecting: (f) => {
    const { phase } = cycle(f.t, 2.6)
    const blip: Point = [0.4, -0.3]
    const reach = Math.hypot(...blip)
    scope(f)
    disc(f, 0, 0, f.compact ? 0.1 : 0.05)
    if (phase < 0.45) ping(f, (phase / 0.45) * reach, 1)
    else {
      const back = (phase - 0.45) / 0.45
      const s = space(f)
      f.ctx.globalAlpha = Math.max(0, 1 - back)
      f.ctx.beginPath()
      f.ctx.arc(s.x(blip[0]), s.y(blip[1]), s.len(Math.min(1, back) * reach), 0, TAU)
      f.ctx.stroke()
    }
    disc(f, ...blip, f.compact ? 0.11 : 0.06, smooth((phase - 0.4) / 0.08) * (1 - smooth((phase - 0.9) / 0.1)))
  },
  weaving: (f) => {
    scope(f)
    sweep(f, f.t * 2, 1, 0.65)
    sweep(f, -f.t * 2 + Math.PI, -1, 0.65)
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    const s = space(f)
    ;[0.85, 0.55, 0.28].forEach((r, k) => {
      const grow = smooth((phase - k * 0.15) / 0.2)
      f.ctx.globalAlpha = 0.5 * fade
      f.ctx.beginPath()
      f.ctx.arc(s.x(0), s.y(0), s.len(r), -Math.PI / 2, -Math.PI / 2 + grow * TAU)
      f.ctx.stroke()
    })
    if (phase > 0.5) sweep(f, f.t * 2.5, 1, smooth((phase - 0.5) / 0.1) * fade)
  },
  breathing: (f) => {
    const b = breath(f.t)
    scope(f)
    ping(f, 0.15 + 0.65 * b, 1 - 0.6 * b)
    disc(f, 0, 0, f.compact ? 0.1 : 0.05)
  },
  shaping: (f) => {
    const shape = shapeMorph(f.t)
    scope(f, shape, 0.6)
    sweep(f, f.t * 2.5, 1, 1, shape)
  },
}

export const radar: SpinnerSet = {
  id: 'radar',
  label: 'Radar',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'a beam sweeps and contacts light up',
    searching: 'the beam scans back and forth across a sector',
    solving: 'scattered contacts close in on one target',
    listening: 'pings pulse out with the voice',
    connecting: 'a ping goes out and an echo comes back',
    weaving: 'two beams sweep in opposite directions',
    composing: 'range rings draw in, then the beam starts',
    breathing: 'a slow ping swells and fades',
    shaping: 'a round, triangular, square scope',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.022, 0.07)
    SCREENS[state](f)
  },
}
