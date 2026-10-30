import { breath, cycle, envelope, hash, lerp, level, smooth } from '../math.js'
import { space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

interface Card {
  x: number
  y: number
  rotate?: number
  /** cos of the flip angle: ≥ 0 shows the face, < 0 the back; |flip| is the visible width. */
  flip?: number
  alpha?: number
  w?: number
  h?: number
  /** Corner radius as a fraction of the width. */
  round?: number
  mark?: 'dot' | 'check'
  /** Position of the dot mark on the face, in card-local units. */
  markAt?: [number, number]
}

function card(f: Frame, c: Card) {
  const { x, y, rotate = 0, flip = -1, alpha = 1, w = 0.5, h = 0.74, round = 0.14, mark, markAt = [0, 0] } = c
  const s = space(f)
  const pw = s.len(w)
  const ph = s.len(h)
  f.ctx.save()
  f.ctx.translate(s.x(x), s.y(y))
  f.ctx.rotate(rotate)
  f.ctx.scale(Math.max(0.03, Math.abs(flip)), 1)
  f.ctx.beginPath()
  f.ctx.roundRect(-pw / 2, -ph / 2, pw, ph, pw * round)
  if (flip < 0) {
    f.ctx.globalAlpha = alpha
    f.ctx.fill()
  } else {
    f.ctx.globalAlpha = alpha * 0.14
    f.ctx.fill()
    f.ctx.globalAlpha = alpha
    f.ctx.stroke()
    if (mark === 'dot') {
      f.ctx.beginPath()
      f.ctx.arc(s.len(markAt[0]), s.len(markAt[1]), pw * 0.16, 0, Math.PI * 2)
      f.ctx.fill()
    } else if (mark === 'check') {
      f.ctx.beginPath()
      f.ctx.moveTo(-pw * 0.22, 0)
      f.ctx.lineTo(-pw * 0.05, ph * 0.13)
      f.ctx.lineTo(pw * 0.24, -ph * 0.14)
      f.ctx.stroke()
    }
  }
  f.ctx.restore()
}

/** Cards fanned around a pivot below the center. */
function fan(count: number, spread: number, extra: Partial<Card> = {}): Card[] {
  return Array.from({ length: count }, (_, k) => {
    const a = (k - (count - 1) / 2) * spread
    return { x: Math.sin(a) * 0.4, y: 0.45 - Math.cos(a) * 0.4, rotate: a, ...extra }
  })
}

const SHAPES = [
  { w: 0.5, h: 0.74, round: 0.14 },
  { w: 0.62, h: 0.62, round: 0.12 },
  { w: 0.66, h: 0.66, round: 0.5 },
]

const DECKS: Record<SpinnerState, (t: number, compact: boolean) => Card[]> = {
  working: (t) => {
    const p = (t / 1.2) % 1
    const moving: Card = { x: Math.sin(p * Math.PI) * 0.62, y: 0, rotate: Math.sin(p * Math.PI) * 0.25 }
    const pile: Card[] = [{ x: 0.08, y: 0.06, alpha: 0.45 }, { x: 0.04, y: 0.03, alpha: 0.7 }]
    return p < 0.5 ? [...pile, moving] : [moving, ...pile]
  },
  searching: (t) => {
    const angle = t * 3.5
    const page = Math.floor((angle + Math.PI / 2) / Math.PI)
    const markAt: [number, number] = [(hash(page, 1) - 0.5) * 0.2, (hash(page, 2) - 0.5) * 0.4]
    return [{ x: 0, y: 0, flip: Math.cos(angle), mark: 'dot', markAt }]
  },
  solving: (t) => {
    const { phase } = cycle(t, 3)
    const turn = smooth((phase - 0.45) / 0.15)
    const shake = phase < 0.45 ? Math.sin(t * 28) * 0.06 : 0
    return [{ x: 0, y: 0, rotate: shake, flip: Math.cos(Math.PI * (1 - turn)), mark: 'check' }]
  },
  listening: (t) => fan(3, 0.15 + 0.45 * level(t, 0)),
  connecting: (t) => {
    const x = 0.08 + 0.5 * (1 - envelope(cycle(t, 3).phase, 0.4, 0.7))
    return [
      { x: -x, y: 0, flip: 1, mark: 'dot', rotate: -0.12 },
      { x, y: 0, flip: 1, mark: 'dot', rotate: 0.12 },
    ]
  },
  weaving: (t) => {
    const p = (t / 0.5) % 1
    const fromLeft = Math.floor(t / 0.5) % 2 === 0
    const side = fromLeft ? -0.45 : 0.45
    const slide = smooth(p)
    const small = { w: 0.4, h: 0.6 }
    return [
      { x: -0.45, y: 0.08, ...small, alpha: 0.55 },
      { x: 0.45, y: 0.08, ...small, alpha: 0.55 },
      { x: 0, y: -0.05, ...small },
      { x: lerp(side, 0, slide), y: lerp(0.08, -0.05, slide) - Math.sin(slide * Math.PI) * 0.2, ...small },
    ]
  },
  composing: (t, compact) => {
    const { phase } = cycle(t, 3.6)
    const fade = 1 - smooth((phase - 0.88) / 0.12)
    const slots = compact ? [-0.35, 0.35] : [-0.6, 0, 0.6]
    const size = compact ? { w: 0.5, h: 0.74 } : { w: 0.38, h: 0.56 }
    const reveal = smooth((phase - 0.65) / 0.15)
    return [
      { x: 0, y: 0.5, ...size, alpha: 0.3 * fade },
      ...slots.map((x, j): Card => {
        const deal = smooth((phase - j * 0.15) / 0.18)
        return {
          x: lerp(0, x, deal),
          y: lerp(0.5, -0.05, deal),
          rotate: (1 - deal) * 0.6,
          flip: Math.cos(Math.PI * (1 - reveal)),
          mark: 'dot',
          alpha: fade * (deal > 0 ? 1 : 0),
          ...size,
        }
      }),
    ]
  },
  breathing: (t, compact) => fan(compact ? 3 : 5, 0.1 + 0.35 * breath(t), { alpha: 0.9 }),
  shaping: (t) => {
    const { index, phase } = cycle(t, 1.8)
    const blend = smooth((phase - 0.6) / 0.4)
    const a = SHAPES[index % SHAPES.length]
    const b = SHAPES[(index + 1) % SHAPES.length]
    return [{ x: 0, y: 0, w: lerp(a.w, b.w, blend), h: lerp(a.h, b.h, blend), round: lerp(a.round, b.round, blend) }]
  },
}

export const cards: SpinnerSet = {
  id: 'cards',
  label: 'Cards',
  icon: { state: 'connecting', t: 2.9 },
  blurbs: {
    working: 'the top card shuffles to the bottom',
    searching: 'flipping card after card',
    solving: 'a card trembles, then turns up a check',
    listening: 'the hand fans out with the voice',
    connecting: 'two cards slide together and part',
    weaving: 'a riffle shuffle, left then right',
    composing: 'three cards dealt, then turned over',
    breathing: 'a hand of cards opens and closes',
    shaping: 'card, tile, chip',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.035, 0.08)
    DECKS[state](f.t, f.compact).forEach((c) => card(f, c))
  },
}
