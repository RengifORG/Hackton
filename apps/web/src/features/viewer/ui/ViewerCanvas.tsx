import {
  Bounds,
  Bvh,
  Center,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
  useProgress,
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo, useRef, type ComponentRef } from 'react'
import { Box3, Vector3 } from 'three'
import type { Hotspot } from '@/lib/api/types'
import {
  DRACO_DECODER_PATH,
  ENVIRONMENT_MAP_URL,
  glbUrlFor,
} from '../model/assets'
import { MODEL_ROTATION_Y, modelScale, toVec3 } from '../model/camera'
import { opaqueMeshes } from '../model/occlusion'
import {
  BASE_FOV,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
} from '../model/views'
import { useViewerStore } from '../model/viewerStore'
import { CameraRig } from './CameraRig'
import { HotspotMarker } from './HotspotMarker'
import { ResponsiveFov } from './ResponsiveFov'
import type { ViewerProps } from './types'
import { useSelectHotspot } from './useSelectHotspot'

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center className="whitespace-nowrap text-sm text-slate-600">
      Cargando 3D… {Math.round(progress)}%
    </Html>
  )
}

interface CarSceneProps {
  model: ViewerProps['model']
  onSelect: (id: Hotspot) => void
}

function CarScene({ model, onSelect }: CarSceneProps) {
  const { scene } = useGLTF(glbUrlFor(model.id), DRACO_DECODER_PATH)
  const focusedHotspot = useViewerStore((state) => state.focusedHotspot)
  const scale = useMemo(
    () => modelScale(new Box3().setFromObject(scene).getSize(new Vector3())),
    [scene],
  )
  // Html.occlude espera refs; los vidrios quedan fuera para ver la cabina.
  const occluders = useMemo(
    () => opaqueMeshes(scene).map((mesh) => ({ current: mesh })),
    [scene],
  )

  return (
    <Bounds fit clip observe margin={1.15}>
      <Center top>
        {/* BVH: el raycast de oclusión corre cada frame con la cámara en movimiento. */}
        <Bvh firstHitOnly>
          <group scale={scale} rotation-y={MODEL_ROTATION_Y}>
            <primitive object={scene} />
          </group>
        </Bvh>
        {model.hotspots?.map(({ id, label, position }) => (
          <HotspotMarker
            key={id}
            id={id}
            label={label}
            position={toVec3(position)}
            active={id === focusedHotspot}
            occluders={occluders}
            onSelect={onSelect}
          />
        ))}
      </Center>
    </Bounds>
  )
}

export function ViewerCanvas({ model, onHotspotSelect }: ViewerProps) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const autoRotate = useViewerStore((state) => state.autoRotate)
  const clearFocus = useViewerStore((state) => state.clearFocus)
  const selectHotspot = useSelectHotspot(onHotspotSelect)

  return (
    <Canvas camera={{ position: [5, 2.5, 6], fov: BASE_FOV }} dpr={[1, 2]}>
      <ResponsiveFov />
      <hemisphereLight args={['#ffffff', '#b0b0b0', 0.6]} />
      <Suspense fallback={<Loader />}>
        <CarScene model={model} onSelect={selectHotspot} />
        <Environment files={ENVIRONMENT_MAP_URL} />
      </Suspense>
      <OrbitControls
        ref={controls}
        makeDefault
        enableZoom
        enableDamping
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={1}
        minDistance={MIN_CAMERA_DISTANCE}
        maxDistance={MAX_CAMERA_DISTANCE}
        onStart={clearFocus}
      />
      <CameraRig hotspots={model.hotspots ?? []} controls={controls} />
    </Canvas>
  )
}
