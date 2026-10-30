import { breath, cycle, level, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Look {
  /** Gaze offset in unit space, shared by both eyes unless `inward` is set. */
  x?: number
  y?: number
  /** Pulls the eyes toward each other (cross-eyed). */
  inward?: number
  /** 1 = wide open, 0 = shut. */
  open?: number
  /** Blends the oval into a smiling ^ arc. */
  happy?: number
  /** Vertical hop of the whole face. */
  lift?: number
}

const EYE_X = 0.44
const EYE_RX = 0.2
const EYE_RY = 0.32

/** Brief blink every few seconds; returns how open the eyes are. */
function blink(t: number) {
  const p = (t % 3.4) / 3.4
  return p > 0.94 ? Math.abs(p - 0.97) / 0.03 : 1
}

function eye(f: Frame, side: -1 | 1, look: Look) {
  const s = space(f)
  const { x = 0, y = 0, inward = 0, open = 1, happy = 0, lift = 0 } = look
  const zoom = f.compact ? 1.3 : 1
  const cx = (side * EYE_X + x - side * inward) * zoom
  const cy = (-0.05 + y - lift) * zoom
  if (happy > 0.5) {
    f.ctx.globalAlpha = (happy - 0.5) * 2
    f.ctx.beginPath()
    f.ctx.arc(s.x(cx), s.y(cy + 0.1), s.len(EYE_RX * 1.1 * zoom), Math.PI + 0.35, -0.35)
    f.ctx.stroke()
    return
  }
  f.ctx.globalAlpha = 1 - happy * 2
  f.ctx.beginPath()
  f.ctx.ellipse(s.x(cx), s.y(cy), s.len(EYE_RX * zoom), s.len(Math.max(0.04, EYE_RY * open) * zoom), 0, 0, Math.PI * 2)
  f.ctx.fill()
}

const SHAPES: Look[] = [{ open: 1 }, { happy: 1 }, { open: 0.06 }]

const LOOKS: Record<SpinnerState, (t: number) => Look> = {
  working: (t) => ({ x: Math.tanh(Math.sin(t * 2.5) * 4) * 0.13, open: blink(t) }),
  searching: (t) => ({ x: Math.cos(t * 2) * 0.13, y: Math.sin(t * 2) * 0.09, open: blink(t) }),
  solving: (t) => {
    const { phase } = cycle(t, 3)
    const aha = smooth((phase - 0.55) / 0.08)
    return { x: 0.1 * (1 - aha), y: -0.08 * (1 - aha), open: 0.4 + 0.6 * aha, happy: aha }
  },
  listening: (t) => ({ y: -0.06, lift: 0.12 * level(t, 0), open: blink(t) }),
  connecting: (t) => {
    const { phase } = cycle(t, 2.8)
    return { inward: 0.1 * Math.sin(Math.PI * smooth(phase / 0.8)) ** 2, open: blink(t + 1) }
  },
  weaving: (t) => ({ x: Math.sin(t * 2.2) * 0.12, y: Math.sin(t * 4.4) * 0.06, open: blink(t) }),
  composing: (t) => {
    const p = (t % 2.2) / 2.2
    return { x: p < 0.85 ? -0.12 + 0.24 * (p / 0.85) : 0.12 - 0.24 * smooth((p - 0.85) / 0.15), y: 0.08 }
  },
  breathing: (t) => ({ y: 0.04, open: 0.12 + 0.6 * (1 - breath(t)) }),
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.6)
    const shape = SHAPES[index % SHAPES.length]
    const swap = Math.min(smooth(phase / 0.12), 1 - smooth((phase - 0.88) / 0.12))
    return { ...shape, open: (shape.open ?? 1) * (0.15 + 0.85 * swap) }
  },
}

export const eyes: SpinnerSet = {
  id: 'eyes',
  label: 'Eyes',
  icon: { state: 'solving', t: 2.9 },
  blurbs: {
    working: 'busy glances from side to side',
    searching: 'eyes roll around looking for something',
    solving: 'a squint, then a happy ^ ^',
    listening: 'eyes up, bobbing along',
    connecting: 'eyes meet in the middle',
    weaving: 'a dizzy figure-eight gaze',
    composing: 'eyes read across a line and snap back',
    breathing: 'sleepy, heavy lids',
    shaping: 'open, smiling, closed',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.065, 0.12)
    const look = LOOKS[state](f.t)
    eye(f, -1, look)
    eye(f, 1, look)
  },
}
