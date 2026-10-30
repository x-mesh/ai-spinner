import { subscribe } from './clock.js'
import { matrix } from './sets/matrix.js'
import type { SpinnerSet, SpinnerState } from './types.js'

export type SpinnerTheme = 'auto' | 'light' | 'dark'

export interface SpinnerOptions {
  state: SpinnerState
  /** Style set; only the sets you import end up in your bundle. */
  set?: SpinnerSet
  /** CSS pixels; below 32 each set switches to its coarser compact design. */
  size?: number
  /** `auto` inks with the canvas's CSS `color`, so it follows your page theme. */
  theme?: SpinnerTheme
  speed?: number
  paused?: boolean
  /** Animation time in seconds shown while paused, and where playback resumes from; unset follows the shared clock. */
  startAt?: number
}

export interface SpinnerHandle {
  /** Changes only the options given; the animation keeps its phase. */
  update: (options: Partial<SpinnerOptions>) => void
  destroy: () => void
}

const PINNED_INK: Record<Exclude<SpinnerTheme, 'auto'>, string> = {
  light: '#16161a',
  dark: '#f2f2f0',
}

const COMPACT_BELOW = 32
const REDUCED_MOTION_TIME = 1.3

const DEFAULTS = { set: matrix, size: 64, theme: 'auto', speed: 1, paused: false } as const

/** Animates a spinner on an existing canvas without any framework. */
export function mountSpinner(canvas: HTMLCanvasElement, options: SpinnerOptions): SpinnerHandle {
  const ctx = canvas.getContext('2d')
  let current: Required<Omit<SpinnerOptions, 'startAt'>> & Pick<SpinnerOptions, 'startAt'> = { ...DEFAULTS, ...options }
  const resize = () => {
    canvas.style.width = `${current.size}px`
    canvas.style.height = `${current.size}px`
  }
  resize()
  if (!ctx) return { update: () => {}, destroy: () => {} }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let visible = true
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
  })
  observer.observe(canvas)

  let time: number | null = null
  let anchor = 0
  let anchorSpeed = 0
  let drawn = ''

  const unsubscribe = subscribe((now) => {
    const { state, set, size, theme, speed, paused, startAt } = current
    const frozen = paused || reducedMotion.matches

    if (time === null || (frozen && startAt !== undefined)) {
      time = startAt ?? (now / 1000) * speed
    } else if (!frozen) {
      time += ((now - anchor) / 1000) * anchorSpeed
    }
    anchor = now
    anchorSpeed = speed
    if (!visible) return

    const ink = theme === 'auto' ? getComputedStyle(canvas).color : PINNED_INK[theme]
    const t = reducedMotion.matches ? (startAt ?? REDUCED_MOTION_TIME) : time
    const dpr = window.devicePixelRatio || 1
    const key = `${set.id}|${state}|${size}|${ink}|${dpr}|${t}`
    if (key === drawn) return
    drawn = key

    const pixels = Math.round(size * dpr)
    if (canvas.width !== pixels) {
      canvas.width = pixels
      canvas.height = pixels
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.fillStyle = ink
    ctx.strokeStyle = ink
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    set.draw(state, { ctx, size, compact: size < COMPACT_BELOW, t })
    ctx.restore()
  })

  return {
    update(next) {
      // Frameworks pass every prop, unset ones as undefined; those must not wipe the defaults.
      // `startAt` is the exception: passing it as undefined deliberately returns to the shared clock.
      const given = Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== undefined || key === 'startAt'))
      current = { ...current, ...given }
      resize()
    },
    destroy() {
      unsubscribe()
      observer.disconnect()
    },
  }
}
