import { render, screen } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { handlers } from '@/mocks/handlers'
import { AppRoutes } from './App'

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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it('muestra la landing en /', () => {
    renderAt('/')
    expect(
      screen.getByRole('heading', { name: 'Tu BYD, a cualquier hora' }),
    ).toBeInTheDocument()
  })

  it('muestra el BYD Dolphin en /modelos/dolphin', async () => {
    renderAt('/modelos/dolphin')
    expect(
      screen.getByRole('heading', { name: 'BYD Dolphin' }),
    ).toBeInTheDocument()
    // Espera a que termine la carga del modelo para no dejar updates colgando.
    expect(
      await screen.findByText('Tu navegador no soporta 3D'),
    ).toBeInTheDocument()
  })
})
