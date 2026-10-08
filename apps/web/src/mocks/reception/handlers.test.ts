// @vitest-environment node
import { setupServer } from 'msw/node'
import {
  AppointmentSchema,
  LeadReadSchema,
} from '@/features/reception/model/schemas'
import { receptionHandlers } from './handlers'

const API = 'http://localhost:8000'
const NOW = new Date('2026-10-08T15:00:00Z')

const server = setupServer(...receptionHandlers)

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => server.resetHandlers())
afterAll(() => {
  server.close()
  vi.useRealTimers()
})

describe('GET /leads', () => {
  it('devuelve 8 leads válidos', async () => {
    const response = await fetch(`${API}/leads`)
    expect(response.status).toBe(200)
    const body = LeadReadSchema.array().parse(await response.json())
    expect(body).toHaveLength(8)
  })
})

describe('GET /appointments', () => {
  it('sin filtro devuelve todas las citas', async () => {
    const response = await fetch(`${API}/appointments`)
    expect(response.status).toBe(200)
    const body = AppointmentSchema.array().parse(await response.json())
    expect(body).toHaveLength(6)
  })

  it('con type=service devuelve solo citas service', async () => {
    const response = await fetch(`${API}/appointments?type=service`)
    expect(response.status).toBe(200)
    const body = AppointmentSchema.array().parse(await response.json())
    expect(body.length).toBeGreaterThan(0)
    expect(body.every((appointment) => appointment.type === 'service')).toBe(
      true,
    )
  })

  it.each(['foo', ''])('con type=%j devuelve 422', async (type) => {
    const response = await fetch(`${API}/appointments?type=${type}`)
    expect(response.status).toBe(422)
  })
})
