import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { resetChatStore } from '@/features/chat'
import { useViewerStore } from '@/features/viewer'
import { handlers } from '@/mocks/handlers'
import { SeagullPage } from './SeagullPage'

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
      <SeagullPage />
    </MemoryRouter>,
  )
}

describe('SeagullPage · lead (H1)', () => {
  it('i) "Dejar mis datos" → formulario con consentimiento → confirmación', async () => {
    const user = userEvent.setup()
    renderPage()
    const chat = within(
      screen.getByRole('complementary', { name: 'Asesor virtual BYD' }),
    )
    const input = chat.getByRole('textbox', { name: 'Escribe tu pregunta' })

    await user.type(input, 'Hola')
    await user.click(chat.getByRole('button', { name: 'Enviar' }))
    await chat.findByText(/¿Qué buscas hoy\?/)
    await user.type(input, '¿tiene techo panorámico?')
    await user.click(chat.getByRole('button', { name: 'Enviar' }))
    await user.click(
      await chat.findByRole('button', { name: 'Dejar mis datos' }),
    )

    await user.type(chat.getByLabelText('Nombre'), 'Ana')
    await user.type(chat.getByLabelText('Teléfono'), '0991234567')
    const submit = chat.getByRole('button', { name: 'Enviar mis datos' })
    expect(submit).toBeDisabled()

    await user.click(chat.getByRole('checkbox'))
    expect(submit).toBeEnabled()
    await user.click(submit)

    expect(
      await chat.findByText(/Un asesor de BYD te contactará pronto\./),
    ).toBeInTheDocument()
  })
})
