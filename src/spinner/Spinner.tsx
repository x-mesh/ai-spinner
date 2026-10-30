'use client'

import { useEffect, useRef } from 'react'
import { mountSpinner, type SpinnerHandle, type SpinnerOptions } from './core.js'

export interface SpinnerProps extends SpinnerOptions {
  'aria-label'?: string
  /** Hides the spinner from assistive tech when nearby text already names it, as in an icon. */
  decorative?: boolean
}

const DEFAULT_SIZE = 64

export function Spinner({ 'aria-label': ariaLabel, decorative = false, ...options }: SpinnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handle = useRef<SpinnerHandle | null>(null)
  const { state, set, size = DEFAULT_SIZE, theme, speed, paused, startAt } = options

  useEffect(() => {
    if (!canvasRef.current) return
    // Mounts once so the animation keeps its phase; the effect below applies the real props
    // before the first frame, which waits for the next animation frame.
    handle.current = mountSpinner(canvasRef.current, { state: 'working' })
    return () => {
      handle.current?.destroy()
      handle.current = null
    }
  }, [])

  useEffect(() => {
    handle.current?.update({ state, set, size, theme, speed, paused, startAt })
  }, [state, set, size, theme, speed, paused, startAt])

  return (
    <canvas
      ref={canvasRef}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : (ariaLabel ?? `Assistant is ${state}`)}
      aria-hidden={decorative || undefined}
      style={{ width: size, height: size, flex: 'none' }}
    />
  )
}
