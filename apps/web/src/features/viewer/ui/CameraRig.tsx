import type { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, type ComponentRef, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { Model } from '@/lib/api/types'
import {
  cameraPoseFor,
  dampingAlpha,
  findHotspotPosition,
  type CameraPose,
} from '../model/camera'
import { cameraPoseForView, fovForView } from '../model/views'
import { useViewerStore } from '../model/viewerStore'

interface CameraRigProps {
  hotspots: NonNullable<Model['hotspots']>
  controls: RefObject<ComponentRef<typeof OrbitControls> | null>
}

export function CameraRig({ hotspots, controls }: CameraRigProps) {
  const focusedHotspot = useViewerStore((state) => state.focusedHotspot)
  const activeView = useViewerStore((state) => state.activeView)
  const animating = useViewerStore((state) => state.animating)
  const size = useThree((state) => state.size)

  const pose = useMemo((): CameraPose | null => {
    if (!animating) return null
    const hotspot = findHotspotPosition(hotspots, focusedHotspot)
    if (hotspot) return cameraPoseFor(hotspot)
    if (!activeView) return null
    // Mismo fov que aplica ResponsiveFov (no se lee de la cámara: en este
    // render todavía puede tener el de la vista anterior).
    const aspect = size.width / size.height
    return cameraPoseForView(activeView, {
      aspect,
      fov: fovForView(activeView, aspect),
    })
  }, [animating, hotspots, focusedHotspot, activeView, size])
  const [position, target] = useMemo(() => [new Vector3(), new Vector3()], [])

  useFrame((state, delta) => {
    const orbit = controls.current
    if (!pose || !orbit) return
    const alpha = dampingAlpha(delta)
    state.camera.position.lerp(position.set(...pose.position), alpha)
    orbit.target.lerp(target.set(...pose.target), alpha)
    orbit.update()
  })

  return null
}
