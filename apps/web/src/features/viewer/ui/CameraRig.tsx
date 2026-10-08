import type { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, type ComponentRef, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { Model } from '@/lib/api/types'
import {
  cameraPoseFor,
  dampingAlpha,
  findHotspotPosition,
} from '../model/camera'
import { useViewerStore } from '../model/viewerStore'

interface CameraRigProps {
  hotspots: NonNullable<Model['hotspots']>
  controls: RefObject<ComponentRef<typeof OrbitControls> | null>
}

export function CameraRig({ hotspots, controls }: CameraRigProps) {
  const focusedHotspot = useViewerStore((state) => state.focusedHotspot)
  const pose = useMemo(() => {
    const position = findHotspotPosition(hotspots, focusedHotspot)
    return position ? cameraPoseFor(position) : null
  }, [hotspots, focusedHotspot])
  const [position, target] = useMemo(() => [new Vector3(), new Vector3()], [])

  useFrame(({ camera }, delta) => {
    const orbit = controls.current
    if (!pose || !orbit) return
    const alpha = dampingAlpha(delta)
    camera.position.lerp(position.set(...pose.position), alpha)
    orbit.target.lerp(target.set(...pose.target), alpha)
    orbit.update()
  })

  return null
}
