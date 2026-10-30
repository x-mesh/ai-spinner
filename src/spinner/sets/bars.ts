import { breath, clamp01, cycle, hash, lerp, level, smooth } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Height 0..1 and opacity 0..1 of bar i out of count. */
type Bar = (i: number, count: number, t: number) => [height: number, alpha?: number]

const MIN_HEIGHT = 0.12

const BARS: Record<SpinnerState, Bar> = {
  working: (i, _, t) => [0.2 + 0.8 * Math.max(0, Math.sin(t * 4 - i * 0.9)) ** 2],
  searching: (i, count, t) => {
    const at = (count - 1) * (0.5 - 0.5 * Math.cos(t * 2.2))
    const near = Math.exp(-((i - at) ** 2) * 0.8)
    return [0.15 + 0.85 * near, 0.3 + 0.7 * near]
  },
  solving: (i, count, t) => {
    const { index, phase } = cycle(t, 3)
    const scrambled = 0.15 + 0.85 * hash(index, i, Math.floor(t / 0.12))
    return [lerp(scrambled, (i + 1) / count, smooth((phase - 0.4) / 0.3))]
  },
  listening: (i, _, t) => [0.15 + 0.85 * level(t, i)],
  connecting: (i, count, t) => {
    const { phase } = cycle(t, 2.4)
    const reached = clamp01(smooth(phase / 0.55) * (count + 1) - i)
    const linked = smooth((phase - 0.6) / 0.1)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return [lerp(0.2, 0.2 + 0.55 * reached + 0.25 * linked, fade), 0.3 + 0.7 * reached * fade]
  },
  weaving: (i, _, t) => {
    const s = Math.sin(t * 3 + i * 0.7)
    return i % 2 === 0 ? [0.25 + 0.6 * (1 + s) * 0.5, 0.95] : [0.25 + 0.6 * (1 - s) * 0.5, 0.5]
  },
  composing: (i, count, t) => {
    const { index, phase } = cycle(t, 3.6)
    const grown = clamp01(smooth(phase / 0.65) * count - i)
    const fade = 1 - smooth((phase - 0.85) / 0.15)
    return [MIN_HEIGHT + (0.35 + 0.6 * hash(index, i)) * grown * fade]
  },
  breathing: (i, count, t) => {
    const c = (count - 1) / 2
    const bell = Math.exp(-(((i - c) / (count * 0.35)) ** 2))
    return [0.2 + 0.75 * bell * (0.4 + 0.6 * breath(t))]
  },
  shaping: (i, count, t) => {
    const c = (count - 1) / 2
    const d = Math.abs(i - c) / c
    const profiles = [1 - d * 0.8, 0.2 + d * 0.8, 0.75]
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    return [lerp(profiles[index % 3], profiles[(index + 1) % 3], blend)]
  },
}

function draw(state: SpinnerState, f: Frame) {
  const count = f.compact ? 4 : 7
  const span = f.size * 0.84
  const pitch = span / count
  const width = pitch * (f.compact ? 0.62 : 0.55)
  const left = (f.size - span) / 2
  for (let i = 0; i < count; i++) {
    const [h, alpha = 1] = BARS[state](i, count, f.t)
    const height = Math.max(width, clamp01(h) * f.size * 0.8)
    f.ctx.globalAlpha = alpha
    f.ctx.beginPath()
    f.ctx.roundRect(left + i * pitch + (pitch - width) / 2, (f.size - height) / 2, width, height, width / 2)
    f.ctx.fill()
  }
}

export const bars: SpinnerSet = {
  id: 'bars',
  label: 'Bars',
  icon: { state: 'working', t: 2.9 },
  blurbs: {
    working: 'a loading wave rolls left to right',
    searching: 'a lamp glides back and forth',
    solving: 'random heights sort into a staircase',
    listening: 'a voice meter',
    connecting: 'a signal hops bar to bar, then locks',
    weaving: 'even and odd bars trade places',
    composing: 'bars rise one by one, then drop',
    breathing: 'a bell curve swells and relaxes',
    shaping: 'peak, valley, plateau',
  },
  draw,
}
