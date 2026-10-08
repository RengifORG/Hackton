import { resetChatStore, useChatStore } from '@/features/chat'
import { newId } from './id'

// Contexto no seguro (demo por IP en http://): el navegador no expone
// crypto.randomUUID, pero sí crypto.getRandomValues.
function stubInsecureCrypto() {
  const real = globalThis.crypto
  vi.stubGlobal('crypto', {
    getRandomValues: real.getRandomValues.bind(real),
  })
}

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa randomUUID cuando existe', () => {
    expect(newId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('sin randomUUID devuelve 32 caracteres hex', () => {
    stubInsecureCrypto()

    expect(newId()).toMatch(/^[0-9a-f]{32}$/)
    expect(newId()).not.toBe(newId())
  })

  it('sin randomUUID el sessionId del chat sigue entre 8 y 64 caracteres', () => {
    stubInsecureCrypto()

    resetChatStore()
    const { sessionId } = useChatStore.getState()

    expect(sessionId.length).toBeGreaterThanOrEqual(8)
    expect(sessionId.length).toBeLessThanOrEqual(64)
  })
})
