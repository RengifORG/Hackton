import type { CameraPose, Vec3 } from './camera'

export type CameraView = 'front' | 'side' | 'back' | 'interior'
type ExteriorView = Exclude<CameraView, 'interior'>

export const BASE_FOV = 40
// Ancho visible mínimo: en móvil vertical el fov se abre para que el auto
// entre completo sin alejar la cámara más allá de MAX_CAMERA_DISTANCE.
const MIN_HORIZONTAL_FOV = 45
// Dentro del auto un fov de 40° es un primer plano: se abre para ver el tablero.
const INTERIOR_FOV = 75
export const MIN_CAMERA_DISTANCE = 0.3
export const MAX_CAMERA_DISTANCE = 8
// Más que el 1.15 de <Bounds>: la cámara mira desde arriba al centro del auto
// y la cara cercana se proyecta más abajo.
const VIEW_MARGIN = 1.35

// Medidas del .glb ya escalado (m): largo 4.28, ancho con espejos 2.28, alto 1.82.
const CAR = { length: 4.28, width: 2.28, height: 1.82 }
const CAR_CENTER: Vec3 = [0, CAR.height / 2, 0]

const INTERIOR_POSE: CameraPose = {
  position: [0.35, 1.0, 0.1],
  target: [0, 0.9, 0.9],
}

// Dirección desde el centro del auto, con una leve elevación.
const EXTERIOR_DIRECTIONS: Record<ExteriorView, Vec3> = {
  front: [0, 0.18, 1],
  side: [1, 0.18, 0],
  back: [0, 0.18, -1],
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const toDegrees = (radians: number) => (radians * 180) / Math.PI

export function horizontalFov(verticalFov: number, aspect: number): number {
  return toDegrees(2 * Math.atan(Math.tan(toRadians(verticalFov) / 2) * aspect))
}

export function fovForAspect(aspect: number): number {
  const needed = toDegrees(
    2 * Math.atan(Math.tan(toRadians(MIN_HORIZONTAL_FOV) / 2) / aspect),
  )
  return Math.max(BASE_FOV, needed)
}

export function fovForView(view: CameraView | null, aspect: number): number {
  const responsive = fovForAspect(aspect)
  return view === 'interior' ? Math.max(INTERIOR_FOV, responsive) : responsive
}

interface Viewport {
  aspect: number
  fov: number
}

function exteriorPose(
  view: ExteriorView,
  { aspect, fov }: Viewport,
): CameraPose {
  const facesSide = view === 'side'
  const visibleWidth = facesSide ? CAR.length : CAR.width
  const depth = facesSide ? CAR.width : CAR.length
  const tanHalf = Math.tan(toRadians(fov) / 2)
  const fitHeight = CAR.height / 2 / tanHalf
  const fitWidth = visibleWidth / 2 / (tanHalf * aspect)
  const distance = Math.min(
    depth / 2 + VIEW_MARGIN * Math.max(fitHeight, fitWidth),
    MAX_CAMERA_DISTANCE,
  )

  const [dx, dy, dz] = EXTERIOR_DIRECTIONS[view]
  const length = Math.hypot(dx, dy, dz)
  const [cx, cy, cz] = CAR_CENTER
  return {
    position: [
      cx + (dx / length) * distance,
      cy + (dy / length) * distance,
      cz + (dz / length) * distance,
    ],
    target: CAR_CENTER,
  }
}

export function cameraPoseForView(
  view: CameraView,
  viewport: Viewport,
): CameraPose {
  return view === 'interior' ? INTERIOR_POSE : exteriorPose(view, viewport)
}
