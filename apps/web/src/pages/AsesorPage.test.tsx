import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { LeadRead } from '@/features/reception/model/schemas'
import { buildAppointments, buildLeads } from '@/mocks/reception/fixtures'
import { receptionHandlers } from '@/mocks/reception/handlers'
import { AsesorPage } from './AsesorPage'

const server = setupServer(...receptionHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

async function renderLoaded() {
  render(<AsesorPage />)
  await screen.findByRole('table', { name: 'Leads en bandeja' })
}

function dataRows() {
  const table = screen.getByRole('table', { name: 'Leads en bandeja' })
  // La primera fila es la de encabezados.
  return within(table).getAllByRole('row').slice(1)
}

describe('AsesorPage', () => {
  it('muestra el heading "Bandeja del asesor"', async () => {
    await renderLoaded()
    expect(
      screen.getByRole('heading', { name: 'Bandeja del asesor' }),
    ).toBeInTheDocument()
  })

  it('muestra 8 filas de leads', async () => {
    await renderLoaded()
    expect(dataRows()).toHaveLength(8)
  })

  it('muestra exactamente 5 badges "Capturado fuera de horario"', async () => {
    await renderLoaded()
    expect(screen.getAllByText('Capturado fuera de horario')).toHaveLength(5)
  })

  it.each([
    ['Leads en bandeja', '8'],
    ['Fuera de horario', '5'],
    ['Citas test drive', '3'],
    ['Pendientes en CRM', '5'],
  ])('KPI "%s" = %s', async (label, value) => {
    await renderLoaded()
    expect(screen.getByRole('group', { name: label })).toHaveTextContent(value)
  })

  it('muestra la cita de cada lead (con el día) o "—"', async () => {
    await renderLoaded()
    const diego = screen.getByText('Diego Salazar').closest('tr')
    expect(diego).toHaveTextContent('Test drive · Hoy 10:00')
    const martin = screen.getByText('Martín Cevallos').closest('tr')
    expect(martin).toHaveTextContent('—')
  })

  it('una cita agendada para mañana dice "Mañana" en la columna Cita', async () => {
    const day = 24 * 60 * 60 * 1000
    const shift = (iso: string) => new Date(Date.parse(iso) + day).toISOString()
    server.use(
      http.get('*/appointments', () =>
        HttpResponse.json(
          buildAppointments(new Date()).map((appointment) => ({
            ...appointment,
            slot: {
              ...appointment.slot,
              start: shift(appointment.slot.start),
              end: shift(appointment.slot.end),
            },
          })),
        ),
      ),
    )

    await renderLoaded()

    const diego = screen.getByText('Diego Salazar').closest('tr')
    expect(diego).toHaveTextContent('Test drive · Mañana 10:00')
  })

  it('al hacer click en "Diego Salazar" abre el detalle', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    expect(
      screen.queryByRole('complementary', { name: 'Detalle del lead' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByText('Diego Salazar'))

    const panel = screen.getByRole('complementary', {
      name: 'Detalle del lead',
    })
    expect(within(panel).getByText('Seal')).toBeInTheDocument()
    expect(within(panel).getByText('Shark')).toBeInTheDocument()
    expect(within(panel).getByText('Resumen del chat')).toBeInTheDocument()
    expect(
      within(panel).getByText(
        'Compara Seal y Shark para uso mixto ciudad-carretera',
      ),
    ).toBeInTheDocument()
    expect(within(panel).getByText('Enviado a HubSpot')).toBeInTheDocument()
    expect(
      within(panel).getByRole('link', { name: 'Ver en HubSpot (simulado)' }),
    ).toHaveAttribute('href', '#hubspot/lead-002')
  })

  it('ningún texto contiene un teléfono completo (PII)', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.click(screen.getByText('Diego Salazar'))
    expect(document.body.textContent).not.toMatch(/09\d{8}/)
  })

  it('muestra un estado de carga', () => {
    render(<AsesorPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  })

  it('si /leads responde 500 muestra el mensaje de error', async () => {
    server.use(
      http.get('*/leads', () => new HttpResponse(null, { status: 500 })),
    )
    render(<AsesorPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar la bandeja',
    )
  })
})

describe('AsesorPage · en vivo', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('tras 5 s muestra el lead nuevo con "Nuevo" sin volver a cargar', async () => {
    await renderLoaded()
    expect(dataRows()).toHaveLength(8)
    expect(screen.queryByText('Nuevo')).toBeNull()

    const newLead: LeadRead = {
      id: 'lead-009',
      name: 'Renata Ortiz',
      phoneMasked: '09****1177',
      source: 'whatsapp',
      interest: 'Quiere cotizar un Dolphin para trabajar con apps',
      recommendedModels: ['dolphin'],
      createdAt: new Date().toISOString(),
      afterHours: false,
      crmStatus: 'pending',
    }
    server.use(
      http.get('*/leads', () =>
        HttpResponse.json([...buildLeads(new Date()), newLead]),
      ),
    )

    await act(() => vi.advanceTimersByTimeAsync(5000))
    // Sin estado de carga intermedio: la tabla sigue a la vista.
    expect(screen.queryByText('Cargando bandeja…')).toBeNull()
    expect(
      screen.getByRole('table', { name: 'Leads en bandeja' }),
    ).toBeInTheDocument()

    const newRow = await screen.findByRole('row', { name: /Renata Ortiz/ })
    expect(within(newRow).getByText('Nuevo')).toBeInTheDocument()
    expect(dataRows()).toHaveLength(9)
    expect(screen.getAllByText('Nuevo')).toHaveLength(1)
    expect(screen.queryByText('Cargando bandeja…')).toBeNull()
  })
})
