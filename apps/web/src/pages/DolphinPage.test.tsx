import { render, screen } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { handlers } from '@/mocks/handlers'
import { DolphinPage } from './DolphinPage'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  // jsdom no implementa WebGL: getContext devuelve null.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

describe('DolphinPage', () => {
  it('muestra el heading y, sin WebGL, el fallback con los 6 hotspots', async () => {
    render(
      <MemoryRouter>
        <DolphinPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'BYD Dolphin' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Tu navegador no soporta 3D'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  it('el visor ocupa el alto disponible y el panel va después (debajo en móvil)', async () => {
    render(
      <MemoryRouter>
        <DolphinPage />
      </MemoryRouter>,
    )

    const viewer = screen.getByRole('region', { name: 'Visor 3D' })
    const panel = screen.getByRole('complementary', { name: 'Asesor virtual' })
    await screen.findByText('Tu navegador no soporta 3D')

    expect(viewer).toHaveClass('h-[calc(100dvh-3.5rem)]', 'w-full')
    expect(
      viewer.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
