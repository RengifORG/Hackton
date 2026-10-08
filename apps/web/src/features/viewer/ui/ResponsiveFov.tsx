import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { PerspectiveCamera } from 'three'
import { fovForView } from '../model/views'
import { useViewerStore } from '../model/viewerStore'

// Ajusta el fov al aspecto del canvas (y a la vista interior) antes de que
// <Bounds> encuadre el auto, para que en móvil vertical no se corte sin pasar
// maxDistance.
export function ResponsiveFov() {
  const get = useThree((state) => state.get)
  const size = useThree((state) => state.size)
  const activeView = useViewerStore((state) => state.activeView)

  useLayoutEffect(() => {
    const { camera } = get()
    if (!(camera instanceof PerspectiveCamera) || size.height === 0) return
    camera.fov = fovForView(activeView, size.width / size.height)
    camera.updateProjectionMatrix()
  }, [get, size, activeView])

  return null
}
