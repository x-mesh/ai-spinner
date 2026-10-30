import { cycle, hash, level } from '../math.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

/** Characters to show, one per slot; compact layouts have a single slot. */
type Line = (t: number, slots: number) => string[]

const BRAILLE = [...'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏']
const NOISE = [...'#%&@$*?!']
const BLOCKS = [...'▁▂▃▄▅▆▇█']

function frames(list: string[], fps: number, offset = 0): Line {
  return (t, slots) =>
    Array.from({ length: slots }, (_, i) => list[(Math.floor(t * fps) + i * offset) % list.length])
}

/** Whole-line animations, with a separate one-character version for compact layouts. */
function rows(wide: string[], compact: string[], fps: number): Line {
  return (t, slots) => {
    const list = slots === 1 ? compact : wide
    return [...list[Math.floor(t * fps) % list.length]]
  }
}

const LINES: Record<SpinnerState, Line> = {
  working: frames(BRAILLE, 12, 3),
  searching: frames([...'◐◓◑◒'], 6, 1),
  solving: (t, slots) => {
    const { index, phase } = cycle(t, 3)
    const target = slots === 1 ? ['✓'] : [...'[✓]']
    return target.map((ch, i) =>
      phase >= 0.3 + 0.15 * i ? ch : NOISE[Math.floor(hash(index, i, Math.floor(t / 0.08)) * NOISE.length)],
    )
  },
  listening: (t, slots) =>
    Array.from({ length: slots }, (_, i) => BLOCKS[Math.min(7, Math.floor(level(t, i) * 8))]),
  connecting: rows(['●  ', '●· ', '●·●', '●─●', '●─●', '   '], ['·', '•', '●', '●', ' '], 4),
  weaving: rows(['╱╲╱', '╲╱╲', '╳╳╳'], ['╱', '╳', '╲', '╳'], 4),
  composing: rows(['▌  ', '·▌ ', '··▌', '···', '···', '   '], ['▌', ' '], 3),
  breathing: frames([...'·∘○◯○∘'], 4, 1),
  shaping: frames([...'●▲■'], 1.2, 1),
}

/** Draws a braille cell as real dots: font braille sits small and off-center in the em box, and varies by OS. */
function braille(f: Frame, ch: string, x: number, y: number, em: number) {
  const bits = ch.charCodeAt(0) - 0x2800
  const pitch = em * 0.38
  for (let dot = 0; dot < 6; dot++) {
    if (!(bits & (1 << dot))) continue
    const col = dot < 3 ? 0 : 1
    const row = dot % 3
    f.ctx.beginPath()
    f.ctx.arc(x + (col - 0.5) * pitch, y + (row - 1) * pitch, em * 0.12, 0, Math.PI * 2)
    f.ctx.fill()
  }
}

function draw(state: SpinnerState, f: Frame) {
  const slots = f.compact ? 1 : 3
  const pitch = f.size * 0.3
  const em = f.size * (f.compact ? 0.9 : 0.36)
  f.ctx.font = `${em}px ui-monospace, Menlo, Consolas, monospace`
  f.ctx.textAlign = 'center'
  f.ctx.textBaseline = 'middle'
  LINES[state](f.t, slots).forEach((ch, i) => {
    const x = f.size / 2 + (i - (slots - 1) / 2) * pitch
    if (BRAILLE.includes(ch)) braille(f, ch, x, f.size / 2, em)
    else f.ctx.fillText(ch, x, f.size / 2)
  })
}

export const glyph: SpinnerSet = {
  id: 'glyph',
  label: 'Glyph',
  icon: { state: 'working', t: 0.2 },
  blurbs: {
    working: 'braille spinners in staggered step',
    searching: 'half-moons turn like a lens',
    solving: 'noise locks into a checked box',
    listening: 'block characters as a level meter',
    connecting: 'two nodes, then a wire',
    weaving: 'slashes cross into an X',
    composing: 'a cursor types out a line',
    breathing: 'a dot inflates to a ring',
    shaping: 'circle, triangle, square as text',
  },
  draw,
}
