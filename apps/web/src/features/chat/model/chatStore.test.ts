import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { useViewerStore } from '@/features/viewer'
import { env } from '@/lib/env'
import { handlers } from '@/mocks/handlers'
import { resetChatStore, useChatStore } from './chatStore'
import { ACTION_PROMPTS } from './prompts'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetChatStore()
  useViewerStore.getState().clearFocus()
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const chat = () => useChatStore.getState()

describe('chatStore (H3)', () => {
  it('a) sessionId tiene 8–64 caracteres y no cambia entre dos ask()', async () => {
    const { sessionId } = chat()
    await chat().ask('Hola')
    await chat().ask('¿Qué autonomía tiene?')

    expect(sessionId.length).toBeGreaterThanOrEqual(8)
    expect(sessionId.length).toBeLessThanOrEqual(64)
    expect(chat().sessionId).toBe(sessionId)
  })

  it('b) ask("Cuéntame de las llantas") responde y enfoca wheels', async () => {
    await chat().ask('Cuéntame de las llantas')

    expect(chat().messages).toHaveLength(2)
    expect(chat().status).toBe('idle')
    expect(useViewerStore.getState().focusedHotspot).toBe('wheels')
  })

  it('c) askAboutHotspot("battery") abre el panel y pregunta por la batería', async () => {
    await chat().askAboutHotspot('battery')

    expect(chat().isOpen).toBe(true)
    expect(chat().messages[0]).toMatchObject({
      role: 'user',
      text: 'Cuéntame de la batería',
    })
    expect(useViewerStore.getState().focusedHotspot).toBe('battery')
  })

  it('d) si /chat responde 500 avisa del error y no enfoca la cámara', async () => {
    server.use(
      http.post(
        `${env.apiUrl}/chat`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    )

    await chat().ask('Cuéntame de las llantas')

    expect(chat().messages.at(-1)?.text).toBe(
      'No pude responder, intenta de nuevo.',
    )
    expect(chat().status).toBe('error')
    expect(useViewerStore.getState().focusedHotspot).toBeNull()
  })

  it('d) si /chat responde 429 pide esperar', async () => {
    server.use(
      http.post(
        `${env.apiUrl}/chat`,
        () => new HttpResponse(null, { status: 429 }),
      ),
    )

    await chat().ask('Hola')

    expect(chat().messages.at(-1)?.text).toBe(
      'Demasiadas consultas, espera un momento.',
    )
  })

  it('e) runAction("leave_contact") abre el formulario de lead', async () => {
    await chat().runAction('leave_contact')

    expect(chat().leadFormOpen).toBe(true)
  })

  it('e) runAction("recommend") envía el prompt de la acción', async () => {
    await chat().runAction('recommend')

    expect(chat().messages[0]?.text).toBe(ACTION_PROMPTS.recommend)
  })
})
