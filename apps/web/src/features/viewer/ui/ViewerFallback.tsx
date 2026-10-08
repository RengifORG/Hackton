import { useState } from 'react'
import type { ViewerProps } from './types'
import { useSelectHotspot } from './useSelectHotspot'

export function ViewerFallback({ model, onHotspotSelect }: ViewerProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const selectHotspot = useSelectHotspot(onHotspotSelect)

  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 rounded-xl bg-slate-100 p-4">
      {!imageFailed && (
        <img
          src={model.thumbnail}
          alt={model.name}
          className="max-h-48 object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
      <p className="text-sm text-slate-600">Tu navegador no soporta 3D</p>
      <ul className="flex flex-wrap justify-center gap-2">
        {model.hotspots?.map(({ id, label }) => (
          <li key={id}>
            <button
              type="button"
              className="rounded-full bg-white px-3 py-1 text-sm shadow hover:bg-slate-50"
              onClick={() => selectHotspot(id)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
