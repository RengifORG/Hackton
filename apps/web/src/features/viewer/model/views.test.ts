import {
  MAX_CAMERA_DISTANCE,
  type CameraView,
  cameraPoseForView,
  fovForAspect,
  fovForView,
  horizontalFov,
} from './views'

function distance(a: number[], b: number[]): number {
  return Math.hypot(...a.map((value, i) => value - (b[i] ?? 0)))
}

const EXTERIOR_VIEWS: CameraView[] = ['front', 'side', 'back']

const DESKTOP = { aspect: 1056 / 844, fov: fovForAspect(1056 / 844) }
const MOBILE = { aspect: 390 / 788, fov: fovForAspect(390 / 788) }

describe('fovForAspect', () => {
  it('en escritorio mantiene el fov base de 40°', () => {
    expect(fovForAspect(DESKTOP.aspect)).toBe(40)
  })

  it('en móvil vertical abre el fov hasta 45° horizontales', () => {
    expect(MOBILE.fov).toBeGreaterThan(40)
    expect(horizontalFov(MOBILE.fov, MOBILE.aspect)).toBeCloseTo(45, 5)
  })
})

describe('fovForView', () => {
  it('dentro del auto abre el fov a 75° también en escritorio', () => {
    expect(fovForView('interior', DESKTOP.aspect)).toBe(75)
  })

  it('afuera usa el fov responsivo', () => {
    expect(fovForView('front', DESKTOP.aspect)).toBe(40)
    expect(fovForView(null, MOBILE.aspect)).toBe(MOBILE.fov)
  })
})

describe('cameraPoseForView', () => {
  it('interior: cámara en [0.35, 1.0, 0.1] mirando a [0, 0.9, 0.9]', () => {
    expect(cameraPoseForView('interior', DESKTOP)).toEqual({
      position: [0.35, 1.0, 0.1],
      target: [0, 0.9, 0.9],
    })
  })

  it('frente, lateral y atrás miran al auto desde +Z, +X y -Z', () => {
    const [front, side, back] = EXTERIOR_VIEWS.map(
      (view) => cameraPoseForView(view, DESKTOP).position,
    )
    expect(front?.[2]).toBeGreaterThan(2)
    expect(side?.[0]).toBeGreaterThan(2)
    expect(back?.[2]).toBeLessThan(-2)
  })

  it('la vista de atrás deja aire: la cara cercana ocupa ≤ 80% del alto visible', () => {
    const pose = cameraPoseForView('back', DESKTOP)
    const nearFace = distance(pose.position, pose.target) - 4.28 / 2
    const visibleHeight = 2 * Math.tan((DESKTOP.fov * Math.PI) / 360) * nearFace

    expect(1.82 / visibleHeight).toBeLessThanOrEqual(0.8)
  })

  it.each(EXTERIOR_VIEWS)(
    'la vista %s entra completa en móvil sin pasar maxDistance',
    (view) => {
      const pose = cameraPoseForView(view, MOBILE)
      expect(distance(pose.position, pose.target)).toBeLessThanOrEqual(
        MAX_CAMERA_DISTANCE,
      )
    },
  )
})
