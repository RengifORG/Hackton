import { create } from 'zustand'
import type { Hotspot } from '@/lib/api/types'

interface ViewerState {
  focusedHotspot: Hotspot | null
  autoRotate: boolean
  focusHotspot: (id: Hotspot) => void
  clearFocus: () => void
}

export const useViewerStore = create<ViewerState>()((set) => ({
  focusedHotspot: null,
  autoRotate: true,
  focusHotspot: (id) => set({ focusedHotspot: id, autoRotate: false }),
  // Sin foco activo no cambia nada (evita renders al interactuar con la órbita).
  clearFocus: () =>
    set((state) =>
      state.focusedHotspot === null
        ? state
        : { focusedHotspot: null, autoRotate: true },
    ),
}))
