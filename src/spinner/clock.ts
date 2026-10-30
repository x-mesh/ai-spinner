type Tick = (now: number) => void

const subscribers = new Set<Tick>()
let frame = 0

function loop(now: number) {
  subscribers.forEach((tick) => tick(now))
  frame = subscribers.size > 0 ? requestAnimationFrame(loop) : 0
}

/** One rAF loop for every spinner, so instances with the same speed stay in phase. */
export function subscribe(tick: Tick) {
  subscribers.add(tick)
  if (frame === 0) frame = requestAnimationFrame(loop)
  return () => {
    subscribers.delete(tick)
  }
}
