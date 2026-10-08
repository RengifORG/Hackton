import { setupServer } from 'msw/node'
import { useViewerStore } from '@/features/viewer'
import { handlers } from '@/mocks/handlers'
import { resetChatStore, useChatStore } from './chatStore'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetChatStore()
  useViewerStore.getState().clearFocus()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const chat = () => useChatStore.getState()

describe('chatStore · submitLead (H1)', () => {
  it('g) un lead válido se registra y el teléfono no queda en el store', async () => {
    const result = await chat().submitLead({
      name: 'Ana',
      phone: '0991234567',
      consent: true,
    })

    expect(result.ok).toBe(true)
    expect(chat().leadId).toBeTruthy()
    expect(chat().leadFormOpen).toBe(false)
    expect(chat().messages.at(-1)?.text).toBe(
      '¡Listo, Ana! Un asesor de BYD te contactará pronto.',
    )
    expect(JSON.stringify(chat())).not.toContain('0991234567')
  })

  it('g) un teléfono inválido devuelve error de campo sin llamar a la API', async () => {
    const result = await chat().submitLead({
      name: 'Ana',
      phone: '123',
      consent: true,
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? undefined : result.fieldErrors.phone).toBeTruthy()
    expect(chat().leadId).toBeUndefined()
  })
})
