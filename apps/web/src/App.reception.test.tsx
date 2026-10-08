import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './App'
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

async function renderLoadedAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
  // Espera a que termine la carga para no dejar requests colgados.
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
}

describe('AppRoutes · recepción', () => {
  it('muestra "Bandeja del asesor" en /asesor', async () => {
    await renderLoadedAt('/asesor')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bandeja del asesor' }),
    ).toBeInTheDocument()
  })

  it('muestra "Agenda del taller" en /taller', async () => {
    await renderLoadedAt('/taller')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Agenda del taller' }),
    ).toBeInTheDocument()
  })
})
