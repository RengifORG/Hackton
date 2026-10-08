import { findCatalogModel } from '@/mocks/catalog/data'
import { cameraPoseFor, modelScale, toVec3, type Vec3 } from './camera'

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

describe('camera', () => {
  it('toVec3 lanza error si no hay exactamente 3 números', () => {
    expect(() => toVec3([1, 2])).toThrow()
  })

  it('cameraPoseFor del hotspot wheels apunta al hotspot desde 2.2 m', () => {
    const wheels = findCatalogModel('seagull')?.hotspots.find(
      ({ id }) => id === 'wheels',
    )
    if (!wheels) throw new Error('el catálogo debe tener el hotspot wheels')
    const hotspot = toVec3(wheels.position)

    const pose = cameraPoseFor(hotspot)

    expect(pose.target).toEqual(hotspot)
    expect(distance(pose.position, pose.target)).toBeCloseTo(2.2, 2)
  })

  it('cameraPoseFor de un hotspot en el eje vertical (battery) no da NaN', () => {
    const pose = cameraPoseFor([0, 0.3, 0])

    for (const value of [...pose.position, ...pose.target]) {
      expect(Number.isNaN(value)).toBe(false)
    }
  })

  it('modelScale escala el lado más largo a 4.28 m', () => {
    expect(modelScale({ x: 2, y: 1.5, z: 8 })).toBeCloseTo(0.535, 5)
  })
})
