import { create } from 'zustand'
import type { Hotspot } from '@/lib/api/types'
import type { CameraView } from './views'

interface ViewerState {
  focusedHotspot: Hotspot | null
  activeView: CameraView | null
  // true mientras CameraRig lleva la cámara hacia el foco; la interacción del
  // usuario lo apaga para no pelear con OrbitControls.
  animating: boolean
  autoRotate: boolean
  focusHotspot: (id: Hotspot) => void
  focusView: (view: CameraView) => void
  clearFocus: () => void
}

export const useViewerStore = create<ViewerState>()((set) => ({
  focusedHotspot: null,
  activeView: null,
  animating: false,
  autoRotate: true,
  focusHotspot: (id) =>
    set({
      focusedHotspot: id,
      activeView: null,
      animating: true,
      autoRotate: false,
    }),
  focusView: (view) =>
    set({
      focusedHotspot: null,
      activeView: view,
      animating: true,
      autoRotate: false,
    }),
  // Sin foco activo no cambia nada (evita renders al interactuar con la órbita).
  // Dentro del auto se suelta la cámara pero se sigue en interior y sin rotar.
  clearFocus: () =>
    set((state) => {
      if (state.focusedHotspot === null && !state.animating) return state
      const inside = state.activeView === 'interior'
      return {
        focusedHotspot: null,
        activeView: inside ? 'interior' : null,
        animating: false,
        autoRotate: !inside,
      }
    }),
}))
