// @vitest-environment node
import { setupServer } from 'msw/node'
import { z } from 'zod'
import { env } from '@/lib/env'
import { catalogHandlers } from '@/mocks/catalog/handlers'
import { ApiError, createApiClient } from './client'
import { hotspotValues } from './types'

const server = setupServer(...catalogHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const api = createApiClient(env.apiUrl)

describe('cliente API contra el mock de catálogo', () => {
  it('listModels devuelve los 6 modelos sin specs ni hotspots', async () => {
    const models = await api.listModels()

    expect(models.map((model) => model.id)).toEqual([
      'dolphin',
      'seagull',
      'yuan-up',
      'song-plus',
      'seal',
      'shark',
    ])
    for (const model of models) {
      expect(model).not.toHaveProperty('specs')
      expect(model).not.toHaveProperty('hotspots')
    }
  })

  it('getModel("dolphin") trae 6 hotspots con ids del contrato', async () => {
    const model = await api.getModel('dolphin')

    expect(model.hotspots).toHaveLength(6)
    for (const hotspot of model.hotspots ?? []) {
      expect(hotspotValues).toContain(hotspot.id)
    }
  })

  it('getModel("seagull") trae hotspots vacíos', async () => {
    const model = await api.getModel('seagull')

    expect(model.hotspots).toEqual([])
  })

  it('getModel con un id inexistente lanza ApiError 404', async () => {
    const error: unknown = await api.getModel('no-existe').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404 })
  })

  it('todos los catalogHandlers apuntan a env.apiUrl (sin comodines)', () => {
    expect(catalogHandlers.length).toBeGreaterThan(0)
    for (const handler of catalogHandlers) {
      expect(String(handler.info.path).startsWith(env.apiUrl)).toBe(true)
    }
  })
})

describe('mock de catálogo (forma exacta de la API F0)', () => {
  it('GET /models responde solo con campos de ModelSummary', async () => {
    const response = await fetch(`${env.apiUrl}/models`)
    const body = z
      .array(z.record(z.string(), z.unknown()))
      .parse(await response.json())

    for (const item of body) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'has3d',
          'id',
          'name',
          'price',
          'rangeKm',
          'segment',
          'thumbnail',
        ].sort(),
      )
    }
  })

  it('GET /models/dolphin no trae campos fuera del contrato', async () => {
    const response = await fetch(`${env.apiUrl}/models/dolphin`)
    const body: unknown = await response.json()

    for (const key of ['currency', 'idealFor', 'model3d', 'rangeStandard']) {
      expect(body).not.toHaveProperty(key)
    }
  })
})
