import { useViewerStore } from './viewerStore'

describe('viewerStore', () => {
  beforeEach(() => {
    useViewerStore.getState().clearFocus()
  })

  it('focusHotspot fija el foco y detiene la auto-rotación', () => {
    useViewerStore.getState().focusHotspot('wheels')

    const { focusedHotspot, autoRotate } = useViewerStore.getState()
    expect(focusedHotspot).toBe('wheels')
    expect(autoRotate).toBe(false)
  })

  it('clearFocus quita el foco y reactiva la auto-rotación', () => {
    useViewerStore.getState().focusHotspot('wheels')
    useViewerStore.getState().clearFocus()

    const { focusedHotspot, autoRotate } = useViewerStore.getState()
    expect(focusedHotspot).toBeNull()
    expect(autoRotate).toBe(true)
  })
})

describe('viewerStore · vistas de cámara', () => {
  beforeEach(() => {
    useViewerStore.getState().focusView('front')
    useViewerStore.getState().clearFocus()
  })

  it('focusView("interior") fija la vista, quita el hotspot y detiene la rotación', () => {
    useViewerStore.getState().focusHotspot('wheels')
    useViewerStore.getState().focusView('interior')

    const state = useViewerStore.getState()
    expect(state.activeView).toBe('interior')
    expect(state.focusedHotspot).toBeNull()
    expect(state.autoRotate).toBe(false)
    expect(state.animating).toBe(true)
  })

  it('focusHotspot sale de la vista activa', () => {
    useViewerStore.getState().focusView('side')
    useViewerStore.getState().focusHotspot('trunk')

    expect(useViewerStore.getState().activeView).toBeNull()
  })

  it('interactuar dentro del auto suelta la cámara pero sigue en interior y sin rotar', () => {
    useViewerStore.getState().focusView('interior')
    useViewerStore.getState().clearFocus()

    const state = useViewerStore.getState()
    expect(state.activeView).toBe('interior')
    expect(state.animating).toBe(false)
    expect(state.autoRotate).toBe(false)
  })

  it('interactuar en una vista exterior vuelve a la órbita libre con rotación', () => {
    useViewerStore.getState().focusView('back')
    useViewerStore.getState().clearFocus()

    const state = useViewerStore.getState()
    expect(state.activeView).toBeNull()
    expect(state.animating).toBe(false)
    expect(state.autoRotate).toBe(true)
  })
})
