import { lazy, Suspense, useState } from 'react'
import { isWebGLAvailable } from '../model/webgl'
import { ErrorBoundary } from './ErrorBoundary'
import type { ViewerProps } from './types'
import { ViewerFallback } from './ViewerFallback'

// three/fiber/drei van en un chunk aparte: solo se descargan si hay WebGL.
const ViewerCanvas = lazy(() =>
  import('./ViewerCanvas').then((module) => ({ default: module.ViewerCanvas })),
)

interface CarViewerProps extends ViewerProps {
  webglAvailable?: boolean
}

export function CarViewer({
  model,
  onHotspotSelect,
  webglAvailable,
}: CarViewerProps) {
  const [hasWebGL] = useState(() => webglAvailable ?? isWebGLAvailable())
  const fallback = (
    <ViewerFallback model={model} onHotspotSelect={onHotspotSelect} />
  )

  if (!hasWebGL) return fallback

  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense
        fallback={<p className="p-4 text-sm text-slate-500">Cargando 3D…</p>}
      >
        <ViewerCanvas model={model} onHotspotSelect={onHotspotSelect} />
      </Suspense>
    </ErrorBoundary>
  )
}
