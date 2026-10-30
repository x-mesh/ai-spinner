import { TAU, breath, cycle, hash, level, shapeMorph, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Water surface height (unit space, y down) at x. */
type Surface = (x: number) => number

interface Scene {
  surface: Surface
  /** Radius of the vessel along canvas angle; defaults to a round flask. */
  vessel?: (a: number) => number
  extra?: (f: Frame) => void
  /** A second, translucent layer of water. */
  under?: Surface
}

const RADIUS = 0.92

function vesselPath(f: Frame, radius: (a: number) => number) {
  const s = space(f)
  f.ctx.beginPath()
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU
    const r = RADIUS * radius(a)
    f.ctx.lineTo(s.x(Math.cos(a) * r), s.y(Math.sin(a) * r))
  }
  f.ctx.closePath()
}

function fillWater(f: Frame, surface: Surface, alpha: number) {
  const s = space(f)
  f.ctx.globalAlpha = alpha
  f.ctx.beginPath()
  f.ctx.moveTo(s.x(-1), s.y(1))
  for (let i = 0; i <= 32; i++) {
    const x = -1 + (i / 32) * 2
    f.ctx.lineTo(s.x(x), s.y(surface(x)))
  }
  f.ctx.lineTo(s.x(1), s.y(1))
  f.ctx.closePath()
  f.ctx.fill()
}

const round = () => 1

const TIDES: Record<SpinnerState, (t: number) => Scene> = {
  working: (t) => ({ surface: (x) => 0.1 + 0.08 * Math.sin(x * 4 - t * 3) }),
  searching: (t) => {
    const { phase } = cycle(t, 1.6)
    const ripple = phase > 0.45 ? (phase - 0.45) / 0.55 : 0
    return {
      surface: (x) => 0.2 + (ripple ? 0.09 * (1 - ripple) * Math.cos(Math.abs(x) * 12 - ripple * 14) * Math.exp(-Math.abs(x) * 2) : 0),
      extra: (f) => {
        if (phase < 0.45) disc(f, 0, -0.8 + smooth(phase / 0.45) * 0.98, 0.07)
      },
    }
  },
  solving: (t) => {
    const { index, phase } = cycle(t, 3)
    const chaos = 1 - smooth((phase - 0.3) / 0.5)
    const tilt = (hash(index) - 0.5) * 0.9 * chaos * Math.sin(t * 7)
    return { surface: (x) => 0.1 + tilt * x + chaos * 0.12 * Math.sin(x * 6 + t * 9) }
  },
  listening: (t) => ({ surface: (x) => 0.15 + (0.04 + 0.2 * level(t, 0)) * Math.sin(x * 6 - t * 5) }),
  connecting: (t) => {
    const tilt = 0.4 * Math.sin(t * 2)
    return { surface: (x) => 0.12 + tilt * x + 0.03 * Math.sin(x * 5 + t * 3) }
  },
  weaving: (t) => ({
    surface: (x) => 0.18 + 0.1 * Math.sin(x * 3.5 - t * 2.4),
    under: (x) => 0.05 + 0.1 * Math.sin(x * 3.5 + t * 2.4 + 1),
  }),
  composing: (t) => {
    const { phase } = cycle(t, 4.5)
    const filled = smooth(phase / 0.75)
    const drain = smooth((phase - 0.85) / 0.15)
    const height = 0.85 - 1.2 * filled * (1 - drain)
    const drop = ((phase * 6) % 1)
    return {
      surface: (x) => height + 0.025 * Math.sin(x * 9 - t * 6),
      extra: (f) => {
        if (phase < 0.75) disc(f, 0, -0.85 + drop * (height + 0.85), 0.05)
      },
    }
  },
  breathing: (t) => ({ surface: (x) => 0.35 - 0.6 * breath(t) + 0.03 * Math.sin(x * 4 - t * 1.5) }),
  shaping: (t) => ({ surface: (x) => 0.15 + 0.04 * Math.sin(x * 5 - t * 3), vessel: shapeMorph(t) }),
}

export const tide: SpinnerSet = {
  id: 'tide',
  label: 'Tide',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'waves roll inside a flask',
    searching: 'a drop falls and rings the surface',
    solving: 'choppy water calms to glass',
    listening: 'the surface ripples with the voice',
    connecting: 'water sloshes from side to side',
    weaving: 'two currents run against each other',
    composing: 'drop by drop the flask fills, then drains',
    breathing: 'a slow tide rises and falls',
    shaping: 'the vessel reshapes around the water',
  },
  draw(state, f) {
    const scene = TIDES[state](f.t)
    const vessel = scene.vessel ?? round
    f.ctx.save()
    vesselPath(f, vessel)
    f.ctx.clip()
    if (scene.under) fillWater(f, scene.under, 0.4)
    fillWater(f, scene.surface, f.compact ? 1 : 0.9)
    f.ctx.restore()
    scene.extra?.(f)
    f.ctx.lineWidth = strokeWidth(f, 0.035, 0.08)
    f.ctx.globalAlpha = 0.45
    vesselPath(f, vessel)
    f.ctx.stroke()
  },
}
