import type { Hotspot } from '@/lib/api/types'
import { useViewerStore } from '../model/viewerStore'

// Markers 3D y botones del fallback hacen lo mismo: enfocar y avisar.
export function useSelectHotspot(onHotspotSelect: (id: Hotspot) => void) {
  const focusHotspot = useViewerStore((state) => state.focusHotspot)
  return (id: Hotspot) => {
    focusHotspot(id)
    onHotspotSelect(id)
  }
}
