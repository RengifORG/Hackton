import type { Model } from '@/lib/api/types'

export type Vec3 = [number, number, number]

export interface CameraPose {
  position: Vec3
  target: Vec3
}

type HotspotPoint = NonNullable<Model['hotspots']>[number]

// Rotación del .glb para que su frente mire a +Z, como el catálogo
// (lights en z=+2.1, trunk en z=-1.9).
export const MODEL_ROTATION_Y = 0

export const DEFAULT_FOCUS_DISTANCE = 2.2
const MIN_CAMERA_HEIGHT = 0.8
const VERTICAL_AXIS_DIRECTION: Vec3 = [1, 0.6, 1]
const DOLPHIN_LENGTH_M = 4.28
const CAMERA_DAMPING = 4

export function toVec3(position: readonly number[]): Vec3 {
  const [x, y, z] = position
  if (
    position.length !== 3 ||
    x === undefined ||
    y === undefined ||
    z === undefined
  ) {
    throw new Error(`Se esperaban 3 coordenadas y llegaron ${position.length}`)
  }
  return [x, y, z]
}

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

// La cámara se aleja del hotspot en la dirección origen→hotspot (plano XZ),
// a `distance` exacta y sin bajar de MIN_CAMERA_HEIGHT.
export function cameraPoseFor(
  hotspot: Vec3,
  distance = DEFAULT_FOCUS_DISTANCE,
): CameraPose {
  const [hx, hy, hz] = hotspot
  const horizontal = Math.hypot(hx, hz)

  if (horizontal < 1e-6) {
    const [dx, dy, dz] = normalize(VERTICAL_AXIS_DIRECTION)
    return {
      position: [hx + dx * distance, hy + dy * distance, hz + dz * distance],
      target: hotspot,
    }
  }

  const rise = Math.min(Math.max(MIN_CAMERA_HEIGHT - hy, 0), distance)
  const radial = Math.sqrt(distance ** 2 - rise ** 2)
  return {
    position: [
      hx + (hx / horizontal) * radial,
      hy + rise,
      hz + (hz / horizontal) * radial,
    ],
    target: hotspot,
  }
}

export function modelScale(
  size: { x: number; y: number; z: number },
  targetLengthM = DOLPHIN_LENGTH_M,
): number {
  const length = Math.max(size.x, size.z)
  return length > 0 ? targetLengthM / length : 1
}

// Factor de lerp independiente del framerate.
export function dampingAlpha(delta: number, damping = CAMERA_DAMPING): number {
  return 1 - Math.exp(-damping * delta)
}

export function findHotspotPosition(
  hotspots: readonly HotspotPoint[],
  id: HotspotPoint['id'] | null,
): Vec3 | null {
  const hotspot = hotspots.find((point) => point.id === id)
  return hotspot ? toVec3(hotspot.position) : null
}
