import { Mesh, MeshPhysicalMaterial, type Material, type Object3D } from 'three'

function isSeeThrough(material: Material): boolean {
  return (
    material.transparent ||
    (material instanceof MeshPhysicalMaterial && material.transmission > 0)
  )
}

// Meshes que tapan los hotspots. Los vidrios no cuentan: un hotspot dentro
// de la cabina (asientos, pantalla) debe verse a través del parabrisas.
export function opaqueMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material]
    if (!materials.some(isSeeThrough)) meshes.push(object)
  })
  return meshes
}
