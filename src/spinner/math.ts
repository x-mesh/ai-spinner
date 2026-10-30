export const TAU = Math.PI * 2

export function clamp01(x: number) {
  return Math.min(1, Math.max(0, x))
}

export function smooth(x: number) {
  const c = clamp01(x)
  return c * c * (3 - 2 * c)
}

export function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k
}

export function hash(...parts: number[]) {
  const s = Math.sin(parts.reduce((acc, p, i) => acc + p * (12.9898 + i * 78.233), 0)) * 43758.5453
  return s - Math.floor(s)
}

export function cycle(t: number, period: number) {
  const index = Math.floor(t / period)
  return { index, phase: t / period - index }
}

/** 0 → 1 → 0 over a cycle: rises until `inEnd`, holds, falls after `outStart`. */
export function envelope(phase: number, inEnd: number, outStart: number) {
  return smooth(phase / inEnd) * (1 - smooth((phase - outStart) / (1 - outStart)))
}

/** Speech-like level 0..1 for channel `i`; channels drift in and out of sync. */
export function level(t: number, i: number) {
  return Math.abs(Math.sin(t * 3.1 + i * 0.9) * Math.sin(t * 1.3 + i * 0.45))
}

export function breath(t: number) {
  return 0.5 - 0.5 * Math.cos(t * 1.2)
}

/** Radius of a regular polygon (0 sides = circle) along canvas angle `a`, circumradius 1, vertex up. */
export function polygonRadius(sides: number, a: number) {
  if (sides === 0) return 1
  const sector = TAU / sides
  const local = (((a + Math.PI / 2) % sector) + sector) % sector
  return Math.cos(Math.PI / sides) / Math.cos(local - Math.PI / sides)
}

/** Cycles circle → triangle → square, holding each before morphing to the next. */
export function shapeMorph(t: number) {
  const sides = [0, 3, 4]
  const hold = 1.1
  const morph = 0.7
  const { index, phase } = cycle(t, hold + morph)
  const blend = smooth((phase * (hold + morph) - hold) / morph)
  const from = sides[index % sides.length]
  const to = sides[(index + 1) % sides.length]
  return (a: number) => lerp(polygonRadius(from, a), polygonRadius(to, a), blend)
}
