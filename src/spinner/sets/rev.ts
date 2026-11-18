import { TAU, breath, cycle, envelope, hash, level, shapeMorph, smooth } from '../math.js'
import { disc, line, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Angular speed in rad/s, `s` seconds into a cycle. */
type Profile = (s: number) => number

interface Spin {
  angle: number
  speed: number
}

const STEPS = 48

/** Angle turned between 0 and `s`, by the midpoint rule; profiles are smooth or piecewise flat, so this is accurate enough. */
function turned(profile: Profile, s: number) {
  const h = s / STEPS
  let sum = 0
  for (let k = 0; k < STEPS; k++) sum += profile((k + 0.5) * h)
  return sum * h
}

/** Repeats `profile` every `period` seconds; whole cycles add up so the angle never jumps between them. */
function spin(t: number, period: number, profile: Profile, reverseOdd = false): Spin {
  const { index, phase } = cycle(t, period)
  const s = phase * period
  const lap = turned(profile, period)
  const partial = turned(profile, s)
  if (reverseOdd) {
    const odd = ((index % 2) + 2) % 2 === 1
    return odd ? { angle: lap - partial, speed: -profile(s) } : { angle: partial, speed: profile(s) }
  }
  return { angle: index * lap + partial, speed: profile(s) }
}

/** Revs up, holds full speed, then brakes hard. */
function throttle(peak: number, rise: number, hold: number, brake: number): Profile {
  return (s) => peak * smooth(s / rise) * (1 - smooth((s - rise - hold) / brake))
}

/** After a hard brake the rotor rocks back a little before it settles. */
function recoil(t: number, period: number, stop: number) {
  const s = cycle(t, period).phase * period - stop
  return s > 0 ? -0.3 * Math.exp(-7 * s) * Math.sin(18 * s) : 0
}

interface Rotor {
  x?: number
  spin: Spin
  blades: number
  reach: number
  /** Opacity of a blade being added; the newest blade fades in. */
  fresh?: number
}

/** Faster spin smears each blade over a wider arc, until at full speed it reads as a blurred disc. */
function rotor(f: Frame, { x = 0, spin: { angle, speed }, blades, reach, fresh = 1 }: Rotor) {
  const s = space(f)
  const copies = f.compact ? 4 : 9
  const fast = smooth((Math.abs(speed) - 12) / 30)
  const arc = Math.min((TAU / blades) * 0.85, Math.abs(speed) * 0.028) * Math.sign(speed)
  const hub = reach * 0.18
  if (fast > 0) disc(f, x, 0, reach, 0.12 * fast)
  f.ctx.lineWidth = s.len(f.compact ? 0.17 : 0.1)
  for (let j = copies; j >= 0; j--) {
    const back = angle - (arc * j) / copies
    const alpha = j === 0 ? 1 : 0.32 * (1 - j / (copies + 1))
    for (let b = 0; b < blades; b++) {
      const a = back + (b * TAU) / blades
      const own = b === blades - 1 ? fresh : 1
      line(f, [[x + Math.cos(a) * hub, Math.sin(a) * hub], [x + Math.cos(a) * reach, Math.sin(a) * reach]], alpha * own)
    }
  }
  disc(f, x, 0, hub * 1.3, 1)
}

const WORK = throttle(42, 0.55, 0.9, 0.22)
const WORK_PERIOD = 2.6
const WORK_STOP = 0.55 + 0.9 + 0.22

const SOLVE_PERIOD = 3.6
/** The first half jerks between random speeds, both ways; the second half hums at one steady speed. */
const SOLVE: Profile = (s) => (s < SOLVE_PERIOD / 2 ? (hash(Math.floor(s / 0.16), 9) - 0.35) * 40 : 30)

const SPINS: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    const sp = spin(f.t, WORK_PERIOD, WORK)
    rotor(f, { spin: { ...sp, angle: sp.angle + recoil(f.t, WORK_PERIOD, WORK_STOP) }, blades: 3, reach: 0.75 })
  },
  searching: (f) => {
    const period = 1.4
    rotor(f, { spin: spin(f.t, period, (s) => 28 * envelope(s / period, 0.25, 0.55), true), blades: 2, reach: 0.75 })
  },
  solving: (f) => {
    rotor(f, { spin: spin(f.t, SOLVE_PERIOD, SOLVE), blades: 3, reach: 0.75 })
  },
  listening: (f) => {
    // Speed follows the voice; integrating `level` from zero is unbounded work, so the turn stays steady and the blur and reach carry the voice.
    const v = level(f.t, 0)
    rotor(f, { spin: { angle: f.t * 9, speed: 8 + 36 * v }, blades: 4, reach: 0.45 + 0.32 * v })
  },
  connecting: (f) => {
    const period = 3.2
    const drive = throttle(34, 0.4, 2.2, 0.4)
    // The second rotor engages like a clutch, then lets go again.
    const follow: Profile = (s) => -drive(s) * envelope(s / period, 0.4, 0.7)
    const reach = f.compact ? 0.42 : 0.38
    rotor(f, { x: -0.44, spin: spin(f.t, period, drive), blades: 3, reach })
    rotor(f, { x: 0.44, spin: spin(f.t, period, follow), blades: 3, reach })
  },
  weaving: (f) => {
    const outer = spin(f.t, WORK_PERIOD, (s) => -WORK(s))
    const inner = spin(f.t + WORK_PERIOD / 2, WORK_PERIOD, WORK)
    rotor(f, { spin: outer, blades: 4, reach: 0.78 })
    rotor(f, { spin: inner, blades: 2, reach: 0.45 })
  },
  composing: (f) => {
    const { index, phase } = cycle(f.t, WORK_PERIOD)
    const blades = (((index % 4) + 4) % 4) + 1
    rotor(f, { spin: spin(f.t, WORK_PERIOD, WORK), blades, reach: 0.75, fresh: blades === 1 ? 1 : smooth(phase / 0.2) })
  },
  breathing: (f) => {
    // ∫ (1 + 6 breath) dt in closed form.
    const angle = f.t + 6 * (0.5 * f.t - (0.5 * Math.sin(f.t * 1.2)) / 1.2)
    rotor(f, { spin: { angle, speed: 1 + 6 * breath(f.t) }, blades: 3, reach: 0.75 })
  },
  shaping: (f) => {
    const s = space(f)
    const { angle, speed } = spin(f.t, WORK_PERIOD, WORK)
    const shape = shapeMorph(f.t)
    const copies = f.compact ? 4 : 9
    const arc = Math.min(1.2, Math.abs(speed) * 0.028)
    f.ctx.lineWidth = strokeWidth(f, 0.06, 0.1)
    for (let j = copies; j >= 0; j--) {
      const turn = angle - (arc * j) / copies
      f.ctx.globalAlpha = j === 0 ? 1 : 0.3 * (1 - j / (copies + 1))
      f.ctx.beginPath()
      for (let k = 0; k <= 72; k++) {
        const a = -Math.PI / 2 + (k * TAU) / 72
        const r = 0.7 * shape(a)
        f.ctx.lineTo(s.x(Math.cos(a + turn) * r), s.y(Math.sin(a + turn) * r))
      }
      f.ctx.closePath()
      f.ctx.stroke()
    }
    disc(f, 0, 0, 0.14, 1)
  },
}

export const rev: SpinnerSet = {
  id: 'rev',
  label: 'Rev',
  icon: { state: 'working', t: 1.1 },
  blurbs: {
    working: 'a rotor revs up to a blur, then brakes hard',
    searching: 'it whips one way, then back the other',
    solving: 'jerky stop-start turns smooth into a steady hum',
    listening: 'the blades blur and reach with the voice',
    connecting: 'a second rotor clutches in and lets go',
    weaving: 'two rotors spin against each other',
    composing: 'a blade is added with every rev',
    breathing: 'a slow spin that speeds and eases',
    shaping: 'a spinning circle, triangle, square',
  },
  draw(state, f) {
    SPINS[state](f)
  },
}
