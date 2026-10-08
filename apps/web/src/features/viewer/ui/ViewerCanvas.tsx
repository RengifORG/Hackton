import {
  Bounds,
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
import {
  DRACO_DECODER_PATH,
  ENVIRONMENT_MAP_URL,
  glbUrlFor,
} from '../model/assets'
import { MODEL_ROTATION_Y, modelScale, toVec3 } from '../model/camera'
import { useViewerStore } from '../model/viewerStore'
import { CameraRig } from './CameraRig'
import { HotspotMarker } from './HotspotMarker'
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

function CarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH)
  const scale = useMemo(
    () => modelScale(new Box3().setFromObject(scene).getSize(new Vector3())),
    [scene],
  )

  return (
    <group scale={scale} rotation-y={MODEL_ROTATION_Y}>
      <primitive object={scene} />
    </group>
  )
}

export function ViewerCanvas({ model, onHotspotSelect }: ViewerProps) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const autoRotate = useViewerStore((state) => state.autoRotate)
  const focusedHotspot = useViewerStore((state) => state.focusedHotspot)
  const clearFocus = useViewerStore((state) => state.clearFocus)
  const selectHotspot = useSelectHotspot(onHotspotSelect)
  const hotspots = model.hotspots ?? []

  return (
    <Canvas camera={{ position: [5, 2.5, 6], fov: 40 }} dpr={[1, 2]}>
      <hemisphereLight args={['#ffffff', '#b0b0b0', 0.6]} />
      <Suspense fallback={<Loader />}>
        <Bounds fit clip observe margin={1.2}>
          <Center top>
            <CarModel url={glbUrlFor(model.id)} />
            {hotspots.map(({ id, label, position }) => (
              <HotspotMarker
                key={id}
                id={id}
                label={label}
                position={toVec3(position)}
                active={id === focusedHotspot}
                onSelect={selectHotspot}
              />
            ))}
          </Center>
        </Bounds>
        <Environment files={ENVIRONMENT_MAP_URL} />
      </Suspense>
      <OrbitControls
        ref={controls}
        makeDefault
        enableZoom
        enableDamping
        autoRotate={autoRotate}
        autoRotateSpeed={1}
        minDistance={1.5}
        maxDistance={12}
        onStart={clearFocus}
      />
      <CameraRig hotspots={hotspots} controls={controls} />
    </Canvas>
  )
}
