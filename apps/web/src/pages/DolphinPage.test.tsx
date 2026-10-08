import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { LOPDP_NOTICE, resetChatStore } from '@/features/chat'
import { useViewerStore } from '@/features/viewer'
import { handlers } from '@/mocks/handlers'
import { DolphinPage } from './DolphinPage'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetChatStore()
  useViewerStore.getState().clearFocus()
  // jsdom no implementa WebGL: getContext devuelve null.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

function renderPage() {
  render(
    <MemoryRouter>
      <DolphinPage />
    </MemoryRouter>,
  )
}

async function viewer() {
  const region = screen.getByRole('region', { name: 'Visor 3D' })
  await within(region).findByText('Tu navegador no soporta 3D')
  return within(region)
}

describe('DolphinPage', () => {
  it('muestra el heading y, sin WebGL, el fallback con los 6 hotspots', async () => {
    renderPage()

    expect(
      screen.getByRole('heading', { name: 'BYD Dolphin' }),
    ).toBeInTheDocument()
    expect((await viewer()).getAllByRole('button')).toHaveLength(6)
  })

  it('h) click en un hotspot pregunta en el chat y responde con datos del catálogo', async () => {
    renderPage()
    const chat = screen.getByRole('complementary', {
      name: 'Asesor virtual BYD',
    })
    expect(within(chat).getByText(LOPDP_NOTICE)).toBeInTheDocument()

    await userEvent.click(
      (await viewer()).getByRole('button', { name: 'Llantas y rines' }),
    )

    expect(
      await within(chat).findByText('Cuéntame de las llantas'),
    ).toBeInTheDocument()
    expect(await within(chat).findByText(/205\/55 R16/)).toBeInTheDocument()
    expect(within(chat).getByText(LOPDP_NOTICE)).toBeVisible()
  })

  it('el visor ocupa el alto disponible y el chat va después (debajo en móvil)', async () => {
    renderPage()

    const viewer = screen.getByRole('region', { name: 'Visor 3D' })
    const panel = screen.getByRole('complementary', {
      name: 'Asesor virtual BYD',
    })
    await screen.findByText('Tu navegador no soporta 3D')

    expect(viewer).toHaveClass('h-[calc(100dvh-3.5rem)]', 'w-full')
    expect(
      viewer.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
