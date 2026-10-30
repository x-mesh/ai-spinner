import { TAU, breath, cycle, hash, level, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Ring {
  r: number
  /** Rotation about the horizontal axis, then about the vertical one. */
  tilt: number
  turn: number
  /** Fraction of the ring drawn. */
  progress?: number
  alpha?: number
}

type V3 = [number, number, number]

function point({ r, tilt, turn }: Ring, u: number): V3 {
  const x0 = r * Math.cos(u)
  const y0 = r * Math.sin(u)
  const y1 = y0 * Math.cos(tilt)
  const z1 = y0 * Math.sin(tilt)
  return [x0 * Math.cos(turn) + z1 * Math.sin(turn), y1, -x0 * Math.sin(turn) + z1 * Math.cos(turn)]
}

/** The far half is drawn faint and the near half solid, so each ring reads as a tilted hoop. */
function ring(f: Frame, spec: Ring) {
  const s = space(f)
  const samples = f.compact ? 36 : 72
  const count = Math.round(samples * (spec.progress ?? 1))
  const points = Array.from({ length: count + 1 }, (_, i) => point(spec, (i / samples) * TAU - Math.PI / 2))
  for (const near of [false, true]) {
    f.ctx.globalAlpha = (spec.alpha ?? 1) * (near ? 1 : 0.28)
    f.ctx.beginPath()
    let open = false
    for (let i = 0; i < count; i++) {
      const [a, b] = [points[i], points[i + 1]]
      if ((a[2] + b[2] <= 0) === near) {
        if (!open) f.ctx.moveTo(s.x(a[0]), s.y(a[1]))
        f.ctx.lineTo(s.x(b[0]), s.y(b[1]))
        open = true
      } else open = false
    }
    f.ctx.stroke()
  }
}

const NESTED = [0.8, 0.6, 0.4]
const CAGE: Ring[] = [
  { r: 0.75, tilt: Math.PI / 2, turn: 0 },
  { r: 0.75, tilt: Math.PI / 2, turn: Math.PI / 2 },
  { r: 0.75, tilt: 0, turn: 0 },
]

const RINGS: Record<SpinnerState, (t: number) => Ring[]> = {
  working: (t) => NESTED.map((r, k) => ({ r, tilt: t * (0.9 + 0.35 * k) + k, turn: t * (0.5 - 0.2 * k) + k * 0.7 })),
  searching: (t) => [{ r: 0.75, tilt: 1.2, turn: t * 1.2 }],
  solving: (t) => {
    const { index, phase } = cycle(t, 3.2)
    const chaos = smooth(phase / 0.2) * (1 - smooth((phase - 0.3) / 0.4))
    return NESTED.map((r, k) => ({ r, tilt: chaos * (hash(index, k) * 4 - 2), turn: chaos * (hash(index, k, 1) * 4 - 2) }))
  },
  listening: (t) => NESTED.map((r, k) => ({ r: r * (0.8 + 0.3 * level(t, k)), tilt: 1.1, turn: t * 0.6 + k })),
  connecting: (t) => {
    const align = smooth(cycle(t, 3.2).phase / 0.4) * (1 - smooth((cycle(t, 3.2).phase - 0.7) / 0.3))
    return [
      { r: 0.72, tilt: 1.2, turn: t * 0.8 },
      { r: 0.72, tilt: 1.2 + (1 - align) * (Math.PI / 2), turn: t * 0.8 },
    ]
  },
  weaving: (t) => [
    { r: 0.75, tilt: 1.1, turn: t * 0.9 },
    { r: 0.75, tilt: 1.1, turn: -t * 0.9 },
  ],
  composing: (t) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return NESTED.map((r, k) => ({ r, tilt: 1 + k * 0.4, turn: t * 0.5 + k, progress: smooth((phase - k * 0.18) / 0.25), alpha: fade }))
  },
  breathing: (t) => {
    const b = breath(t)
    return [
      { r: 0.8, tilt: 0.2 + 1.2 * b, turn: 0.3 },
      { r: 0.5, tilt: -(0.2 + 1.2 * b), turn: 0.3 },
    ]
  },
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    return CAGE.slice(0, (index % 3) + 1).map((spec) => ({ ...spec, tilt: spec.tilt + 0.5, turn: spec.turn + t * 0.6, alpha: swap }))
  },
}

export const gyro: SpinnerSet = {
  id: 'gyro',
  label: 'Gyro',
  icon: { state: 'working', t: 1.4 },
  blurbs: {
    working: 'nested gimbals tumble on their own axes',
    searching: 'a bead races around a precessing ring',
    solving: 'tumbling rings settle into a target',
    listening: 'rings widen with the voice',
    connecting: 'two crossed rings swing into one',
    weaving: 'two hoops turn through each other',
    composing: 'rings draw themselves one by one',
    breathing: 'rings open and close like an eyelid',
    shaping: 'one, two, three great circles',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.03, 0.08)
    const rings = RINGS[state](f.t)
    rings.forEach((spec) => ring(f, spec))
    if (state === 'searching') {
      const [x, y] = point(rings[0], f.t * 2.5)
      disc(f, x, y, f.compact ? 0.13 : 0.07)
    }
    disc(f, 0, 0, f.compact ? 0.13 : 0.07)
  },
}
