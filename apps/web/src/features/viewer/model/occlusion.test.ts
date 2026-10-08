import {
  BoxGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three'
import { opaqueMeshes } from './occlusion'

function mesh(name: string, material: MeshStandardMaterial): Mesh {
  const object = new Mesh(new BoxGeometry(), material)
  object.name = name
  return object
}

describe('opaqueMeshes', () => {
  it('ocluye solo con carrocería opaca: ignora vidrios (blend o transmission)', () => {
    const car = new Group()
    car.add(
      mesh('body', new MeshStandardMaterial()),
      mesh('blend-glass', new MeshStandardMaterial({ transparent: true })),
      mesh('transmission-glass', new MeshPhysicalMaterial({ transmission: 1 })),
    )
    const nested = new Group()
    nested.add(mesh('wheel', new MeshStandardMaterial()))
    car.add(nested)

    expect(opaqueMeshes(car).map(({ name }) => name)).toEqual(['body', 'wheel'])
  })
})
