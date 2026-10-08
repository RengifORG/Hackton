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
