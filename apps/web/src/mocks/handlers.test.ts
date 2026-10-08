// @vitest-environment node
import { server } from './server'

const API = 'http://localhost:8000'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// `server` y el worker del navegador comparten `handlers`.
describe('handlers registrados en MSW', () => {
  it('GET /leads devuelve 8 leads', async () => {
    const response = await fetch(`${API}/leads`)
    expect(response.status).toBe(200)
    expect(await response.json()).toHaveLength(8)
  })

  it('GET /appointments?type=service devuelve 3 citas', async () => {
    const response = await fetch(`${API}/appointments?type=service`)
    expect(response.status).toBe(200)
    expect(await response.json()).toHaveLength(3)
  })
})
