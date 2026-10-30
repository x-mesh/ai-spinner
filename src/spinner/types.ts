export const SPINNER_STATES = [
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'breathing',
  'shaping',
] as const

export type SpinnerState = (typeof SPINNER_STATES)[number]

export interface Frame {
  ctx: CanvasRenderingContext2D
  size: number
  /** Compact layouts (inline text) get their own coarser design instead of a scaled-down large one. */
  compact: boolean
  t: number
}

export interface SpinnerSet {
  id: string
  label: string
  /** Representative frame for pickers: the state and animation time that read best at icon size. */
  icon: { state: SpinnerState; t: number }
  blurbs: Record<SpinnerState, string>
  draw: (state: SpinnerState, f: Frame) => void
}
