import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { disc, paintField } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Width multiplier along the flame, s = 0 at the base to 1 at the tip. */
type Profile = (s: number) => number

interface Fire {
  x?: number
  height?: number
  width?: number
  /** Sideways lean at the tip. */
  lean?: number
  flicker?: number
  profile?: Profile
}

const BASE = 0.7

const TEARDROP: Profile = (s) => (1 - s) ** 1.5
const CONE: Profile = (s) => 1 - s
const COLUMN: Profile = (s) => smooth((1 - s) / 0.2)
const PROFILES = [TEARDROP, CONE, COLUMN]

/** Half-width at height s, with a rounded bottom below the base. */
function halfWidth(s: number, width: number, profile: Profile) {
  if (s < -0.25 || s > 1) return 0
  if (s < 0) return width * Math.sqrt(1 - (s / 0.25) ** 2)
  return width * profile(s)
}

/** Ink coverage of one flame; the inner core is paler, like the hottest part of a real flame. */
function flameAt(u: number, v: number, t: number, soft: number, { x = 0, height = 1.3, width = 0.42, lean = 0, flicker = 1, profile = TEARDROP }: Fire) {
  const s = (BASE - v) / height
  if (s < -0.3 || s > 1.05) return 0
  const sway = lean * s * s + flicker * 0.08 * s * s * Math.sin(v * 5 + t * 7)
  const dx = Math.abs(u - x - sway)
  const outer = halfWidth(s, width * (1 + flicker * 0.12 * Math.sin(v * 11 - t * 13)), profile)
  const inner = halfWidth((BASE - 0.1 - v) / (height * 0.5), width * 0.42, profile)
  return smooth((outer - dx) / soft + 0.5) * (1 - 0.6 * smooth((inner - dx) / soft + 0.5))
}

function burn(f: Frame, fires: Fire[]) {
  const soft = f.compact ? 0.05 : 0.025
  paintField(f, (u, v) => {
    let ink = 0
    for (const fire of fires) ink = Math.max(ink, flameAt(u, v, f.t, soft, fire))
    return ink
  })
}

function sparks(f: Frame, count: number) {
  for (let k = 0; k < count; k++) {
    const { index, phase } = cycle(f.t + hash(k) * 2, 1.4)
    disc(f, (hash(index, k) - 0.5) * 0.5 + Math.sin(phase * 6 + k) * 0.05, lerp(0.1, -0.9, phase), f.compact ? 0.06 : 0.03, 1 - phase)
  }
}

const FIRES: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    burn(f, [{}])
    sparks(f, f.compact ? 1 : 3)
  },
  searching: (f) => burn(f, [{ lean: Math.sin(f.t * 1.2) * 0.35 }]),
  solving: (f) => {
    const settle = smooth((cycle(f.t, 3.2).phase - 0.3) / 0.45)
    burn(f, [{ flicker: lerp(3, 0.3, settle), height: lerp(1.4, 1.1, settle) }])
  },
  listening: (f) => burn(f, [{ height: 0.7 + 0.8 * level(f.t, 0) }]),
  connecting: (f) => {
    const e = envelope(cycle(f.t, 3.4).phase, 0.4, 0.7)
    const x = lerp(0.45, 0.12, e)
    burn(f, [{ x: -x, lean: 0.25 * e, height: 1, width: 0.3 }, { x, lean: -0.25 * e, height: 1, width: 0.3 }])
  },
  weaving: (f) => burn(f, [-1, 1].map((side) => ({ x: side * 0.12, lean: side * 0.25 * Math.sin(f.t * 2), width: 0.3 }))),
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    const grow = smooth(phase / 0.5) * (1 - smooth((phase - 0.85) / 0.15))
    burn(f, [{ height: 0.15 + 1.15 * grow, width: 0.12 + 0.3 * grow }])
  },
  breathing: (f) => burn(f, [{ height: 0.9 + 0.4 * breath(f.t), flicker: 0.4 }]),
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const from = PROFILES[index % 3]
    const to = PROFILES[(index + 1) % 3]
    burn(f, [{ flicker: 0.5, profile: (s) => lerp(from(s), to(s), blend) }])
  },
}

export const flame: SpinnerSet = {
  id: 'flame',
  label: 'Flame',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'a flame flickers and throws sparks',
    searching: 'the flame leans with a shifting draft',
    solving: 'a wild fire calms into a candle flame',
    listening: 'the flame leaps with the voice',
    connecting: 'two flames lean in and burn as one',
    weaving: 'two flames sway around each other',
    composing: 'an ember catches and grows into a flame',
    breathing: 'the flame rises and sinks slowly',
    shaping: 'a teardrop, a cone, a column of fire',
  },
  draw(state, f) {
    FIRES[state](f)
  },
}
