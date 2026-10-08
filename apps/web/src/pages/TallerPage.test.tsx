import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { buildAppointments, buildLeads } from '@/mocks/reception/fixtures'
import { receptionHandlers } from '@/mocks/reception/handlers'
import { TallerPage } from './TallerPage'

const NOW = new Date('2026-10-08T15:00:00Z')
const leads = buildLeads(NOW)
const appointments = buildAppointments(NOW)
const serviceAppointments = appointments.filter((a) => a.type === 'service')
const testDriveAppointments = appointments.filter(
  (a) => a.type === 'test_drive',
)

const server = setupServer(...receptionHandlers)
const requestedUrls: string[] = []

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  server.events.on('request:start', ({ request }) => {
    requestedUrls.push(request.url)
  })
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
  requestedUrls.length = 0
})
afterAll(() => {
  server.close()
  vi.useRealTimers()
})

async function renderLoaded() {
  render(<TallerPage />)
  await screen.findAllByRole('article')
}

function articleOf(leadName: string | undefined) {
  return screen.getByRole('article', { name: leadName })
}

describe('TallerPage', () => {
  it('muestra el heading "Agenda del taller"', async () => {
    await renderLoaded()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Agenda del taller' }),
    ).toBeInTheDocument()
  })

  it('muestra las 3 citas service y ninguna test_drive', async () => {
    await renderLoaded()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    for (const appointment of testDriveAppointments) {
      expect(screen.queryByText(appointment.leadName ?? '')).toBeNull()
    }
  })

  it('pide las citas con type=service', async () => {
    await renderLoaded()
    const appointmentUrls = requestedUrls
      .map((url) => new URL(url))
      .filter((url) => url.pathname === '/appointments')
    expect(appointmentUrls).toHaveLength(1)
    expect(appointmentUrls[0]?.searchParams.get('type')).toBe('service')
  })

  it('agrupa por franja horaria', async () => {
    await renderLoaded()
    for (const label of ['09:00–10:00', '11:00–12:00', '15:00–16:00']) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument()
    }
  })

  it('agrupa las franjas bajo el encabezado del día "Hoy · jue 8"', async () => {
    await renderLoaded()
    const today = screen.getByRole('region', { name: 'Hoy · jue 8' })
    expect(
      within(today).getByRole('heading', { level: 2, name: 'Hoy · jue 8' }),
    ).toBeInTheDocument()
    expect(within(today).getAllByRole('article')).toHaveLength(3)
  })

  it('una cita de mañana aparece bajo "Mañana · vie 9"', async () => {
    const base = serviceAppointments[0]
    if (!base) throw new Error('los fixtures deben tener citas service')
    const tomorrow = {
      ...base,
      id: 'apt-tomorrow',
      leadName: 'Cliente de Mañana',
      slot: {
        ...base.slot,
        start: '2026-10-09T15:00:00Z',
        end: '2026-10-09T16:00:00Z',
      },
    }
    server.use(
      http.get('*/appointments', () =>
        HttpResponse.json([...serviceAppointments, tomorrow]),
      ),
    )

    await renderLoaded()

    const tomorrowSection = screen.getByRole('region', {
      name: 'Mañana · vie 9',
    })
    expect(
      within(tomorrowSection).getByRole('article', {
        name: 'Cliente de Mañana',
      }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Hoy · jue 8' })).queryByText(
        'Cliente de Mañana',
      ),
    ).toBeNull()
  })

  it('muestra cliente, teléfono, vehículo, placa y motivo', async () => {
    await renderLoaded()
    const article = articleOf('Valeria Chiriboga')
    expect(article).toHaveTextContent('09****4821')
    expect(article).toHaveTextContent('BYD Dolphin')
    expect(article).toHaveTextContent('PCX-1234')
    expect(article).toHaveTextContent('Mantenimiento de 10.000 km')
  })

  it('los badges "Capturado fuera de horario" coinciden con afterHours del lead', async () => {
    await renderLoaded()
    const leadsById = new Map(leads.map((lead) => [lead.id, lead]))
    for (const appointment of serviceAppointments) {
      const lead = leadsById.get(appointment.leadId)
      const badge = within(articleOf(appointment.leadName)).queryByText(
        'Capturado fuera de horario',
      )
      expect(badge !== null, appointment.id).toBe(lead?.afterHours)
    }
  })

  it('muestra 1 "Beneficio SmartClub" con su texto', async () => {
    await renderLoaded()
    expect(screen.getAllByText('Beneficio SmartClub')).toHaveLength(1)
    expect(
      screen.getByText('Acumulas cashback SmartClub canjeable en Farmaenlace'),
    ).toBeInTheDocument()
  })

  it('"Confirmar recepción" cambia solo en esa cita', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    const article = articleOf('Valeria Chiriboga')

    await user.click(
      within(article).getByRole('button', { name: 'Confirmar recepción' }),
    )

    expect(
      within(article).getByRole('button', { name: 'Recepción confirmada' }),
    ).toBeDisabled()
    const pending = screen.getAllByRole('button', {
      name: 'Confirmar recepción',
    })
    expect(pending).toHaveLength(2)
    for (const button of pending) expect(button).toBeEnabled()
  })

  it('ningún texto contiene un teléfono completo (PII)', async () => {
    await renderLoaded()
    expect(document.body.textContent).not.toMatch(/09\d{8}/)
  })

  it('muestra un estado de carga', () => {
    render(<TallerPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  })

  it('muestra el estado vacío "Sin citas de taller en los próximos 7 días"', async () => {
    server.use(http.get('*/appointments', () => HttpResponse.json([])))
    render(<TallerPage />)
    expect(
      await screen.findByText('Sin citas de taller en los próximos 7 días'),
    ).toBeInTheDocument()
  })

  it('si /appointments responde 500 muestra el mensaje de error', async () => {
    server.use(
      http.get('*/appointments', () => new HttpResponse(null, { status: 500 })),
    )
    render(<TallerPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar la agenda',
    )
  })
})

describe('TallerPage · en vivo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    // Vuelve al reloj fijo del resto del archivo.
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  it('una cita confirmada sigue confirmada después de una recarga', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderLoaded()
    await user.click(
      within(articleOf('Valeria Chiriboga')).getByRole('button', {
        name: 'Confirmar recepción',
      }),
    )

    const appointmentRequests = () =>
      requestedUrls.filter((url) => new URL(url).pathname === '/appointments')
        .length
    expect(appointmentRequests()).toBe(1)

    await act(() => vi.advanceTimersByTimeAsync(5000))
    await waitFor(() => expect(appointmentRequests()).toBe(2))
    await screen.findByText(/^Actualizado 10:00:0[5-9]$/)

    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(
      within(articleOf('Valeria Chiriboga')).getByRole('button', {
        name: 'Recepción confirmada',
      }),
    ).toBeDisabled()
    expect(
      screen.getAllByRole('button', { name: 'Confirmar recepción' }),
    ).toHaveLength(2)
  })
})
