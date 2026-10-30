import { breath, cycle, envelope, hash, level, smooth } from '../math.js'
import { disc, space, strokeWidth } from '../space.js'
import type { Frame, SpinnerSet, SpinnerState } from '../types.js'

type V3 = [number, number, number]
type Edge = [number, number]

interface Mesh {
  verts: V3[]
  edges: Edge[]
}

const CAMERA = 2.4

function edgesWhere(verts: V3[], test: (a: V3, b: V3) => boolean): Edge[] {
  const edges: Edge[] = []
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (test(verts[i], verts[j])) edges.push([i, j])
    }
  }
  return edges
}

function distance(a: V3, b: V3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

const CUBE_VERTS: V3[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5])
const CUBE: Mesh = { verts: CUBE_VERTS, edges: edgesWhere(CUBE_VERTS, (a, b) => Math.abs(distance(a, b) - 1) < 1e-6) }

const TETRA_VERTS: V3[] = [0, 3, 5, 6].map((i) => CUBE_VERTS[i].map((c) => c * 1.2) as V3)
const TETRA: Mesh = { verts: TETRA_VERTS, edges: edgesWhere(TETRA_VERTS, () => true) }

const OCTA_VERTS: V3[] = [
  [0.75, 0, 0],
  [-0.75, 0, 0],
  [0, 0.75, 0],
  [0, -0.75, 0],
  [0, 0, 0.75],
  [0, 0, -0.75],
]
const OCTA: Mesh = { verts: OCTA_VERTS, edges: edgesWhere(OCTA_VERTS, (a, b) => distance(a, b) < 1.2) }

interface Pose {
  yaw: number
  pitch: number
  scale?: number
  dx?: number
  alpha?: number
  /** Number of edges drawn; fractional values draw part of the last one. */
  progress?: number
  /** Per-vertex displacement before rotation. */
  jitter?: (i: number) => V3
}

function project([x, y, z]: V3, { yaw, pitch, scale = 1, dx = 0 }: Pose): V3 {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw)
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw)
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch)
  const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch)
  const persp = CAMERA / (CAMERA + z2 * scale)
  return [x1 * scale * persp + dx, y2 * scale * persp, z2]
}

/** Strokes each edge; edges nearer the camera are darker. */
function mesh(f: Frame, { verts, edges }: Mesh, pose: Pose) {
  const s = space(f)
  const points = verts.map((v, i) => {
    const d = pose.jitter?.(i) ?? [0, 0, 0]
    return project([v[0] + d[0], v[1] + d[1], v[2] + d[2]], pose)
  })
  const limit = pose.progress ?? edges.length
  edges.forEach(([i, j], e) => {
    const amount = Math.min(1, limit - e)
    if (amount <= 0) return
    const a = points[i]
    const b = points[j]
    f.ctx.globalAlpha = (pose.alpha ?? 1) * (0.3 + 0.7 * (1 - ((a[2] + b[2]) / 2 + 0.8) / 1.6))
    f.ctx.beginPath()
    f.ctx.moveTo(s.x(a[0]), s.y(a[1]))
    f.ctx.lineTo(s.x(a[0] + (b[0] - a[0]) * amount), s.y(a[1] + (b[1] - a[1]) * amount))
    f.ctx.stroke()
  })
  return points
}

const SHAPES = [TETRA, CUBE, OCTA]

const WIRES: Record<SpinnerState, (f: Frame) => void> = {
  working: (f) => {
    mesh(f, CUBE, { yaw: f.t * 0.8, pitch: 0.5 + Math.sin(f.t * 0.5) * 0.3, scale: 1.1 })
  },
  searching: (f) => {
    const points = mesh(f, OCTA, { yaw: f.t * 1.2, pitch: f.t * 0.5, scale: 1.1 })
    const [x, y] = points[Math.floor(f.t * 3) % points.length]
    disc(f, x, y, f.compact ? 0.12 : 0.07)
  },
  solving: (f) => {
    const { index, phase } = cycle(f.t, 3.2)
    const scatter = 1 - smooth((phase - 0.3) / 0.45)
    mesh(f, CUBE, {
      yaw: f.t * 0.6,
      pitch: 0.5,
      scale: 1.1,
      jitter: (i) => [0, 1, 2].map((axis) => (hash(index, i, axis) - 0.5) * 0.9 * scatter) as V3,
    })
  },
  listening: (f) => mesh(f, CUBE, { yaw: f.t * 0.6, pitch: 0.5, scale: 0.85 + 0.4 * level(f.t, 0) }),
  connecting: (f) => {
    const gap = 0.6 * (1 - envelope(cycle(f.t, 3.2).phase, 0.4, 0.7))
    const pose = { yaw: f.t * 0.6, pitch: 0.4, scale: 1 }
    mesh(f, TETRA, { ...pose, dx: -gap })
    mesh(f, { verts: TETRA.verts.map((v) => v.map((c) => -c) as V3), edges: TETRA.edges }, { ...pose, dx: gap, alpha: 0.7 })
  },
  weaving: (f) => {
    mesh(f, CUBE, { yaw: f.t * 0.7, pitch: 0.5, scale: 1.15 })
    mesh(f, CUBE, { yaw: -f.t * 0.9, pitch: -0.4, scale: 0.6, alpha: 0.7 })
  },
  composing: (f) => {
    const { phase } = cycle(f.t, 3.6)
    mesh(f, CUBE, {
      yaw: f.t * 0.5,
      pitch: 0.5,
      scale: 1.1,
      progress: smooth(phase / 0.75) * CUBE.edges.length,
      alpha: 1 - smooth((phase - 0.88) / 0.12),
    })
  },
  breathing: (f) => {
    const pose = { yaw: f.t * 0.3, pitch: 0.45 }
    const inner = 0.45 + 0.3 * breath(f.t)
    const outerPoints = mesh(f, CUBE, { ...pose, scale: 1.1 })
    const innerPoints = mesh(f, CUBE, { ...pose, scale: inner, alpha: 0.7 })
    const s = space(f)
    f.ctx.globalAlpha = 0.35
    outerPoints.forEach((a, i) => {
      const b = innerPoints[i]
      f.ctx.beginPath()
      f.ctx.moveTo(s.x(a[0]), s.y(a[1]))
      f.ctx.lineTo(s.x(b[0]), s.y(b[1]))
      f.ctx.stroke()
    })
  },
  shaping: (f) => {
    const { index, phase } = cycle(f.t, 1.8)
    const swap = Math.min(smooth(phase / 0.2), 1 - smooth((phase - 0.8) / 0.2))
    mesh(f, SHAPES[index % SHAPES.length], { yaw: f.t * 0.8, pitch: 0.5, scale: 1.1 * (0.6 + 0.4 * swap), alpha: swap })
  },
}

export const wire: SpinnerSet = {
  id: 'wire',
  label: 'Wire',
  icon: { state: 'working', t: 0.9 },
  blurbs: {
    working: 'a wireframe cube tumbles',
    searching: 'a point hops between octahedron corners',
    solving: 'scattered corners snap into a cube',
    listening: 'the cube swells with the voice',
    connecting: 'two tetrahedra slide into a star',
    weaving: 'nested cubes turn against each other',
    composing: 'a cube draws itself edge by edge',
    breathing: 'a tesseract breathes in and out',
    shaping: 'tetrahedron, cube, octahedron',
  },
  draw(state, f) {
    f.ctx.lineWidth = strokeWidth(f, 0.03, 0.07)
    WIRES[state](f)
  },
}
