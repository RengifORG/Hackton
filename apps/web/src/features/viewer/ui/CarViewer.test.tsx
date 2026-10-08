import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { createApiClient } from '@/lib/api/client'
import type { Model } from '@/lib/api/types'
import { env } from '@/lib/env'
import { catalogHandlers } from '@/mocks/catalog/handlers'
import { useViewerStore } from '../model/viewerStore'
import { CarViewer } from './CarViewer'

const server = setupServer(...catalogHandlers)
let dolphin: Model

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' })
  dolphin = await createApiClient(env.apiUrl).getModel('dolphin')
})
afterEach(() => {
  server.resetHandlers()
  useViewerStore.getState().clearFocus()
})
afterAll(() => server.close())

describe('CarViewer sin WebGL (CA5.4)', () => {
  it('muestra el fallback con los 6 hotspots del catálogo', () => {
    render(
      <CarViewer
        model={dolphin}
        onHotspotSelect={vi.fn()}
        webglAvailable={false}
      />,
    )

    expect(screen.getByText('Tu navegador no soporta 3D')).toBeInTheDocument()
    for (const { label } of dolphin.hotspots ?? []) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  it('click en "Blade Battery" selecciona battery y enfoca el store', async () => {
    const onHotspotSelect = vi.fn()
    render(
      <CarViewer
        model={dolphin}
        onHotspotSelect={onHotspotSelect}
        webglAvailable={false}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Blade Battery' }))

    expect(onHotspotSelect).toHaveBeenCalledWith('battery')
    expect(useViewerStore.getState().focusedHotspot).toBe('battery')
  })
})
