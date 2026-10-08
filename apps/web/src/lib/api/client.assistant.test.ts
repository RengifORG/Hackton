// @vitest-environment node
import { HttpHandler } from 'msw'
import { setupServer } from 'msw/node'
import { env } from '@/lib/env'
import { handlers } from '@/mocks/handlers'
import { ApiError, createApiClient } from './client'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const api = createApiClient(env.apiUrl)

function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${env.apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  )
}

describe('chat contra el mock (H3)', () => {
  it('"Cuéntame de las llantas" del dolphin enfoca wheels con datos del catálogo', async () => {
    const response = await api.chat({
      sessionId: 'session-llantas-01',
      message: 'Cuéntame de las llantas',
      modelId: 'dolphin',
    })

    expect(response.hotspot).toBe('wheels')
    expect(response.suggestedActions).toContain('view_3d')
    expect(response.reply).toContain('205/55 R16')
  })

  it('el aviso LOPDP sale solo en el primer mensaje de la sesión', async () => {
    const sessionId = 'session-lopdp-0001'

    const first = await api.chat({ sessionId, message: 'Hola' })
    const second = await api.chat({ sessionId, message: 'Hola de nuevo' })

    expect(first.reply).toContain('LOPDP')
    expect(second.reply).not.toContain('LOPDP')
  })

  it('una pregunta sin dato en el catálogo no inventa specs', async () => {
    const sessionId = 'session-techo-0001'
    await api.chat({ sessionId, message: 'Hola' })

    const response = await api.chat({
      sessionId,
      message: '¿tiene techo panorámico?',
    })

    expect(response.hotspot).toBeUndefined()
    expect(response.reply).toBe('No tengo ese dato, un asesor te confirma.')
  })

  it('POST /chat con message vacío responde 422', async () => {
    const response = await postJson('/chat', {
      sessionId: 'session-vacio-0001',
      message: '',
    })

    expect(response.status).toBe(422)
  })

  it('POST /chat con un campo extra responde 422', async () => {
    const response = await postJson('/chat', {
      sessionId: 'session-extra-0001',
      message: 'Hola',
      action: 'create_appointment',
    })

    expect(response.status).toBe(422)
  })

  it('el cliente lanza ApiError 422 con message vacío', async () => {
    const error = await rejectionOf(
      api.chat({ sessionId: 'session-vacio-0002', message: '' }),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422 })
  })
})

describe('recomendaciones contra el mock (H2)', () => {
  it('con presupuesto de 30k devuelve los 3 modelos de precio más cercano', async () => {
    const items = await api.recommend(
      'familia de 4, ciudad, presupuesto 30k',
      'session-reco-0001',
    )

    expect(items.map((item) => item.modelId)).toEqual([
      'yuan-up',
      'dolphin',
      'song-plus',
    ])
  })

  it('sin presupuesto devuelve los 3 modelos más baratos', async () => {
    const items = await api.recommend('ciudad, primer auto')

    expect(items.map((item) => item.modelId)).toEqual([
      'seagull',
      'dolphin',
      'yuan-up',
    ])
  })

  it('un profile demasiado corto lanza ApiError 422', async () => {
    const error = await rejectionOf(api.recommend('abc'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422 })
  })
})

describe('guarda de seguridad de los mocks', () => {
  it('todos los handlers apuntan a env.apiUrl (sin comodines)', () => {
    expect(handlers.length).toBeGreaterThan(0)
    for (const handler of handlers) {
      expect(handler).toBeInstanceOf(HttpHandler)
      const path = handler instanceof HttpHandler ? handler.info.path : ''
      expect(String(path).startsWith(env.apiUrl)).toBe(true)
    }
  })
})
