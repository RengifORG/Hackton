// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { buildLeads } from '@/mocks/reception/fixtures'
import { receptionHandlers } from '@/mocks/reception/handlers'
import {
  fetchAppointments,
  fetchLeads,
  ReceptionApiError,
} from './receptionApi'

const API = 'http://localhost:8000'
const NOW = new Date('2026-10-08T15:00:00Z')

const server = setupServer(...receptionHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchLeads', () => {
  it('devuelve los leads validados', async () => {
    await expect(fetchLeads(API)).resolves.toHaveLength(8)
  })

  it('lanza ReceptionApiError si un lead trae `phone` (PII)', async () => {
    const [lead] = buildLeads(NOW)
    server.use(
      http.get('*/leads', () =>
        HttpResponse.json([{ ...lead, phone: '0991234567' }]),
      ),
    )
    await expect(fetchLeads(API)).rejects.toBeInstanceOf(ReceptionApiError)
  })

  it('lanza ReceptionApiError si la API responde 500', async () => {
    server.use(
      http.get('*/leads', () => new HttpResponse(null, { status: 500 })),
    )
    await expect(fetchLeads(API)).rejects.toBeInstanceOf(ReceptionApiError)
  })

  it('el error no filtra el contenido de la respuesta', async () => {
    const [lead] = buildLeads(NOW)
    server.use(
      http.get('*/leads', () =>
        HttpResponse.json([{ ...lead, phone: '0991234567' }]),
      ),
    )
    const error: unknown = await fetchLeads(API).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ReceptionApiError)
    expect(String(error)).not.toMatch(/0991234567/)
  })
})

describe('fetchAppointments', () => {
  it('sin tipo devuelve todas las citas', async () => {
    await expect(fetchAppointments(API)).resolves.toHaveLength(6)
  })

  it('con tipo service pide ?type=service y devuelve solo service', async () => {
    const urls: string[] = []
    server.events.on('request:start', ({ request }) => urls.push(request.url))
    const appointments = await fetchAppointments(API, 'service')
    expect(urls).toEqual([`${API}/appointments?type=service`])
    expect(appointments.every((a) => a.type === 'service')).toBe(true)
    server.events.removeAllListeners()
  })

  it('lanza ReceptionApiError si la API responde 500', async () => {
    server.use(
      http.get('*/appointments', () => new HttpResponse(null, { status: 500 })),
    )
    await expect(fetchAppointments(API)).rejects.toBeInstanceOf(
      ReceptionApiError,
    )
  })
})
