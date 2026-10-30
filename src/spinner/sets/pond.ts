import { TAU, breath, cycle, hash, lerp, level, shapeMorph } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const FADE_RADIUS = 1.15

interface Ripple {
  x: number
  y: number
  /** Seconds since the drop landed. */
  age: number
  life?: number
  speed?: number
  alpha?: number
  /** Outline radius by canvas angle; defaults to a circle. */
  shape?: (a: number) => number
}

function ripple(f: Frame, { x, y, age, life = 1.5, speed = 0.7, alpha = 1, shape }: Ripple) {
  if (age < 0 || age > life) return
  const r = 0.04 + age * speed
  const fade = alpha * (1 - age / life) ** 1.4 * Math.max(0, 1 - r / FADE_RADIUS)
  if (fade <= 0.01) return
  const s = space(f)
  f.ctx.globalAlpha = fade
  f.ctx.beginPath()
  if (shape) {
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU
      const rr = r * shape(a)
      f.ctx.lineTo(s.x(x + Math.cos(a) * rr), s.y(y + Math.sin(a) * rr))
    }
  } else {
    f.ctx.arc(s.x(x), s.y(y), s.len(r), 0, TAU)
  }
  f.ctx.stroke()
}

/** Drops emitted every `period` seconds; `at` gives each drop's position and strength from its landing time. */
function rain(f: Frame, period: number, life: number, at: (landed: number, id: number) => Partial<Ripple>) {
  const latest = Math.floor(f.t / period)
  for (let k = 0; k <= Math.ceil(life / period); k++) {
    const id = latest - k
    const landed = id * period
    ripple(f, { x: 0, y: 0, age: f.t - landed, life, ...at(landed, id) })
  }
}

const PONDS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => rain(f, 0.45, 1.6, (_, id) => ({ x: hash(id, 1) * 1.2 - 0.6, y: hash(id, 2) * 1.2 - 0.6 })),
  searching: (f) => {
    const source = (time: number) => ({ x: Math.cos(time * 1.4) * 0.45, y: Math.sin(time * 1.4) * 0.45 })
    rain(f, 0.3, 1.2, (landed) => ({ ...source(landed), speed: 0.8 }))
    const now = source(f.t)
    disc(f, now.x, now.y, 0.06)
  },
  solving: (f) => {
    const { phase } = cycle(f.t, 3.2)
    if (phase < 0.5) {
      rain(f, 0.12, 0.6, (_, id) => ({ x: hash(id, 3) * 1.4 - 0.7, y: hash(id, 4) * 1.4 - 0.7, speed: 0.9 }))
    } else {
      const age = (phase - 0.5) * 3.2
      ;[0, 0.35, 0.7].forEach((lag) => ripple(f, { x: 0, y: 0, age: age - lag, life: 1.6 }))
    }
  },
  listening: (f) => rain(f, 0.25, 1.4, (landed) => ({ alpha: 0.15 + 0.85 * level(landed, 0) })),
  connecting: (f) => {
    rain(f, 0.5, 1.4, () => ({ x: -0.5, speed: 0.6 }))
    rain(f, 0.5, 1.4, () => ({ x: 0.5, speed: 0.6 }))
  },
  weaving: (f) => {
    rain(f, 0.6, 1.5, () => ({ y: -0.45 }))
    rain(f, 0.6, 1.5, (landed) => ({ y: 0.45, age: f.t - landed - 0.3 }))
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const count = f.compact ? 3 : 5
    for (let j = 0; j < count; j++) {
      const x = lerp(-0.6, 0.6, j / (count - 1))
      const age = (phase - j * 0.12) * 3.6
      ripple(f, { x, y: 0, age, life: 1.4, speed: 0.45 })
      if (age > 0 && age < 0.25) disc(f, x, 0, 0.05)
    }
  },
  breathing: (f) => {
    const b = breath(f.t)
    f.ctx.globalAlpha = 0.35 + 0.65 * (1 - b)
    const s = space(f)
    f.ctx.beginPath()
    f.ctx.arc(s.x(0), s.y(0), s.len(0.25 + 0.55 * b), 0, TAU)
    f.ctx.stroke()
    disc(f, 0, 0, 0.07 + 0.04 * (1 - b))
  },
  shaping: (f) => {
    const shape = shapeMorph(f.t)
    rain(f, 0.45, 1.6, () => ({ shape, speed: 0.6 }))
  },
}

export const pond: SpinnerSet = {
  id: 'pond',
  label: 'Pond',
  icon: { state: 'working', t: 2.4 },
  blurbs: {
    working: 'raindrops land here and there',
    searching: 'a skimmer circles, trailing rings',
    solving: 'a downpour, then one calm ripple',
    listening: 'each word sends out a ring',
    connecting: 'two sources ring in sync',
    weaving: 'two sources take turns',
    composing: 'stones skip across the water',
    breathing: 'one ring swells while the center sinks',
    shaping: 'ripples in circle, triangle, square',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.035, 0.08)
    PONDS[state](f)
  },
}
