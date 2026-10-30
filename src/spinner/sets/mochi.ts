import { breath, cycle, envelope, lerp, level, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

const FLOOR = 0.62

interface Pose {
  x?: number
  /** Height of the body above the floor. */
  lift?: number
  sx?: number
  sy?: number
  tilt?: number
  lookX?: number
  lookY?: number
  eyes?: 'open' | 'happy' | 'closed'
  open?: number
  scale?: number
}

function blink(t: number) {
  const p = (t % 3.1) / 3.1
  return p > 0.94 ? Math.abs(p - 0.97) / 0.03 : 1
}

/** A soft body with its eyes punched out, so they show the page behind. */
function body(f: Frame, pose: Pose) {
  const { x = 0, lift = 0, sx = 1, sy = 1, tilt = 0, lookX = 0, lookY = 0, eyes = 'open', open = 1 } = pose
  let { scale = 1 } = pose
  const s = space(f)
  scale *= f.compact ? 1.35 : 1
  const w = s.len(0.95 * scale * sx)
  const h = s.len(0.75 * scale * sy)
  const eyeX = s.len(0.18 * scale)
  const eyeR = s.len(0.065 * scale)
  f.ctx.save()
  f.ctx.translate(s.x(x), s.y(FLOOR - lift) - h / 2)
  f.ctx.rotate(tilt)
  f.ctx.globalAlpha = 1
  f.ctx.beginPath()
  f.ctx.roundRect(-w / 2, -h / 2, w, h, [w * 0.5, w * 0.5, w * 0.32, w * 0.32])
  f.ctx.fill()
  f.ctx.globalCompositeOperation = 'destination-out'
  const ex = s.len(lookX * scale)
  const ey = s.len((lookY - 0.04) * scale)
  for (const side of [-1, 1]) {
    f.ctx.beginPath()
    if (eyes === 'open') {
      f.ctx.ellipse(side * eyeX + ex, ey, eyeR, Math.max(eyeR * 0.2, eyeR * 1.4 * open), 0, 0, Math.PI * 2)
      f.ctx.fill()
    } else if (eyes === 'happy') {
      f.ctx.arc(side * eyeX + ex, ey + eyeR * 0.6, eyeR * 1.1, Math.PI + 0.3, -0.3)
      f.ctx.stroke()
    } else {
      f.ctx.moveTo(side * eyeX + ex - eyeR, ey)
      f.ctx.lineTo(side * eyeX + ex + eyeR, ey)
      f.ctx.stroke()
    }
  }
  f.ctx.restore()
}

/** Hop with phase p in [0, 1): squashes on contact, stretches in the air. */
function hop(p: number, height: number): Pose {
  const air = Math.sin(p * Math.PI)
  const contact = Math.max(0, 1 - air / 0.15)
  return { lift: air * height, sx: 1 + 0.16 * contact - 0.04 * air, sy: 1 - 0.18 * contact + 0.06 * air }
}

const SHAPES = [
  { sx: 1, sy: 1 },
  { sx: 0.72, sy: 1.3 },
  { sx: 1.3, sy: 0.68 },
]

const MOCHIS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => body(f, { ...hop((f.t * 1.8) % 1, 0.35), open: blink(f.t) }),
  searching: (f) => {
    const turn = Math.sin(f.t * 1.6)
    body(f, { tilt: turn * 0.16, lookX: turn * 0.1, open: blink(f.t) })
  },
  solving: (f) => {
    const { phase } = cycle(f.t, 3.2)
    if (phase < 0.55) {
      body(f, { lookX: 0.07, lookY: -0.07, open: 0.55 })
      const drip = (phase / 0.55) % 0.5 / 0.5
      disc(f, 0.48, lerp(-0.6, -0.25, drip), 0.06, 1 - drip)
    } else {
      body(f, { ...hop(((phase - 0.55) / 0.45) * 2 % 1, 0.3), eyes: 'happy' })
    }
  },
  listening: (f) => {
    const v = level(f.t, 0)
    body(f, { sx: 1 + 0.08 * v, sy: 1 - 0.06 * v + 0.04, tilt: Math.sin(f.t * 2) * 0.06, lookY: -0.06, open: blink(f.t) })
  },
  connecting: (f) => {
    const join = envelope(cycle(f.t, 2.8).phase, 0.45, 0.65)
    const x = 0.6 - 0.32 * join
    const squish = smooth((join - 0.85) / 0.15)
    for (const side of [-1, 1]) {
      body(f, { x: side * x, scale: 0.55, sx: 1 - 0.12 * squish, sy: 1 + 0.08 * squish, lookX: -side * 0.08, eyes: squish > 0.5 ? 'happy' : 'open' })
    }
  },
  weaving: (f) => {
    const beat = Math.sin(f.t * 3)
    body(f, { x: beat * 0.15, tilt: beat * 0.22, lift: Math.abs(Math.sin(f.t * 6)) * 0.08, eyes: 'happy' })
  },
  composing: (f) => {
    body(f, { lookY: 0.05, lift: Math.abs(Math.sin(f.t * 5)) * 0.03, open: 0.7 })
    const dots = Math.floor(f.t * 3) % 4
    for (let k = 0; k < 3; k++) disc(f, -0.18 + k * 0.18, -0.6, 0.06, k < dots ? 1 : 0.2)
  },
  breathing: (f) => {
    const b = breath(f.t)
    body(f, { eyes: 'closed', sy: 0.94 + 0.08 * b, sx: 1.02 - 0.03 * b })
    const rise = (f.t * 0.4) % 1
    f.ctx.globalAlpha = 1 - rise
    f.ctx.font = `bold ${f.size * 0.22}px ui-sans-serif, system-ui, sans-serif`
    const s = space(f)
    f.ctx.fillText('z', s.x(0.45 + rise * 0.15), s.y(-0.45 - rise * 0.4))
  },
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const a = SHAPES[index % SHAPES.length]
    const b = SHAPES[(index + 1) % SHAPES.length]
    body(f, { sx: lerp(a.sx, b.sx, blend), sy: lerp(a.sy, b.sy, blend), open: blink(f.t) })
  },
}

export const mochi: SpinnerSet = {
  id: 'mochi',
  label: 'Mochi',
  icon: { state: 'breathing', t: 0.6 },
  blurbs: {
    working: 'a little blob hops along',
    searching: 'it tilts its head, looking around',
    solving: 'a nervous sweat, then a happy hop',
    listening: 'it sways and listens',
    connecting: 'two friends bump into a hug',
    weaving: 'a happy side-to-side dance',
    composing: 'it looks down while dots type above',
    breathing: 'fast asleep, z z z',
    shaping: 'squished tall, wide, round',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.045, 0.09)
    MOCHIS[state](f)
  },
}
