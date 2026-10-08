import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CameraView } from '../model/views'
import { useViewerStore } from '../model/viewerStore'
import { ViewControls } from './ViewControls'

describe('ViewControls', () => {
  beforeEach(() => {
    useViewerStore.getState().focusView('front')
    useViewerStore.getState().clearFocus()
  })

  it('"Ver interior" entra al auto y el botón cambia a "Ver exterior"', async () => {
    render(<ViewControls />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver interior' }))

    expect(useViewerStore.getState().activeView).toBe('interior')
    expect(
      screen.getByRole('button', { name: 'Ver exterior' }),
    ).toBeInTheDocument()
  })

  it('"Ver exterior" sale del interior a la vista de frente', async () => {
    useViewerStore.getState().focusView('interior')
    render(<ViewControls />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver exterior' }))

    expect(useViewerStore.getState().activeView).toBe('front')
  })

  it.each<[string, CameraView]>([
    ['Frente', 'front'],
    ['Lateral', 'side'],
    ['Atrás', 'back'],
    ['Interior', 'interior'],
  ])('el botón rápido "%s" llama a focusView("%s")', async (label, view) => {
    render(<ViewControls />)

    await userEvent.click(screen.getByRole('button', { name: label }))

    expect(useViewerStore.getState().activeView).toBe(view)
  })
})
