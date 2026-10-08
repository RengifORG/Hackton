import { buildAppointments, buildLeads } from '@/mocks/reception/fixtures'
import type { Appointment } from './schemas'
import {
  appointmentByLeadId,
  buildAdvisorKpis,
  buildAdvisorRows,
  buildWorkshopAgenda,
  describeAppointment,
  formatModelId,
  formatTime,
  indexBy,
  isSameEcuadorDay,
  parseVehicle,
} from './selectors'

const NOW = new Date('2026-10-08T15:00:00Z')
const leads = buildLeads(NOW)
const appointments = buildAppointments(NOW)

function appointmentById(id: string): Appointment {
  const appointment = appointments.find((a) => a.id === id)
  if (!appointment) throw new Error(`No existe ${id} en los fixtures`)
  return appointment
}

describe('buildAdvisorKpis', () => {
  it('cuenta 8 leads, 5 fuera de horario, 3 test drive y 5 pendientes en CRM', () => {
    expect(buildAdvisorKpis(leads, appointments)).toEqual({
      leadsInInbox: 8,
      afterHours: 5,
      testDrives: 3,
      crmPending: 5,
    })
  })
})

describe('indexBy / appointmentByLeadId', () => {
  it('indexBy indexa por id', () => {
    const byId = indexBy(leads)
    expect(byId.size).toBe(8)
    expect(byId.get('lead-002')?.name).toBe('Diego Salazar')
  })

  it('appointmentByLeadId asocia cada cita a su lead', () => {
    const byLead = appointmentByLeadId(appointments)
    expect(byLead.get('lead-002')?.type).toBe('test_drive')
    expect(byLead.get('lead-001')?.type).toBe('service')
    expect(byLead.has('lead-004')).toBe(false)
  })
})

describe('buildAdvisorRows', () => {
  it('une cada lead con su cita, si la tiene', () => {
    const rows = buildAdvisorRows(leads, appointments)
    expect(rows).toHaveLength(8)
    const diego = rows.find((row) => row.lead.id === 'lead-002')
    expect(diego?.appointment?.id).toBe(appointmentById('apt-002').id)
    const martin = rows.find((row) => row.lead.id === 'lead-004')
    expect(martin?.appointment).toBeUndefined()
  })
})

describe('describeAppointment', () => {
  it('muestra tipo y hora de Ecuador', () => {
    expect(describeAppointment(appointmentById('apt-002'))).toBe(
      'Test drive · 10:00',
    )
    expect(describeAppointment(appointmentById('apt-001'))).toBe(
      'Taller · 09:00',
    )
  })

  it('muestra "—" si no hay cita', () => {
    expect(describeAppointment(undefined)).toBe('—')
  })
})

describe('isSameEcuadorDay', () => {
  it('compara el día calendario en hora de Ecuador', () => {
    // 23:59 del 8 de octubre en Ecuador
    expect(isSameEcuadorDay('2026-10-09T04:59:00Z', NOW)).toBe(true)
    // 00:00 del 9 de octubre en Ecuador
    expect(isSameEcuadorDay('2026-10-09T05:00:00Z', NOW)).toBe(false)
  })
})

describe('buildWorkshopAgenda', () => {
  const tomorrowService: Appointment = {
    ...appointmentById('apt-003'),
    id: 'apt-tomorrow',
    slot: {
      ...appointmentById('apt-003').slot,
      start: '2026-10-09T14:00:00Z',
      end: '2026-10-09T15:00:00Z',
    },
  }
  const sameSlotUnknownLead: Appointment = {
    ...appointmentById('apt-001'),
    id: 'apt-extra',
    leadId: 'lead-999',
    loyaltyNote: undefined,
  }
  const input = [
    ...appointments,
    tomorrowService,
    sameSlotUnknownLead,
  ].reverse()
  const agenda = buildWorkshopAgenda(input, leads, NOW)
  const items = agenda.flatMap((group) => group.items)

  it('solo trae citas service del día', () => {
    expect(items.map((item) => item.id).sort()).toEqual([
      'apt-001',
      'apt-003',
      'apt-005',
      'apt-extra',
    ])
  })

  it('ordena por inicio y agrupa por franja HH:mm–HH:mm', () => {
    expect(agenda.map((group) => group.label)).toEqual([
      '09:00–10:00',
      '11:00–12:00',
      '15:00–16:00',
    ])
    expect(agenda[0]?.items.map((item) => item.id).sort()).toEqual([
      'apt-001',
      'apt-extra',
    ])
  })

  it('toma afterHours del lead y usa false si el lead no existe', () => {
    const byId = new Map(items.map((item) => [item.id, item]))
    expect(byId.get('apt-001')?.afterHours).toBe(true)
    expect(byId.get('apt-003')?.afterHours).toBe(false)
    expect(byId.get('apt-005')?.afterHours).toBe(true)
    expect(byId.get('apt-extra')?.afterHours).toBe(false)
  })

  it('separa modelo y placa, y expone motivo y beneficio', () => {
    const first = items.find((item) => item.id === 'apt-001')
    expect(first).toMatchObject({
      leadName: 'Valeria Chiriboga',
      phoneMasked: '09****4821',
      model: 'BYD Dolphin',
      plate: 'PCX-1234',
      reason: 'Mantenimiento de 10.000 km',
      loyaltyNote: 'Acumulas cashback SmartClub canjeable en Farmaenlace',
    })
  })
})

describe('parseVehicle', () => {
  it('separa modelo y placa', () => {
    expect(parseVehicle('BYD Dolphin · PCX-1234')).toEqual({
      model: 'BYD Dolphin',
      plate: 'PCX-1234',
    })
  })

  it('usa "—" como placa si no hay separador', () => {
    expect(parseVehicle('BYD Seal')).toEqual({ model: 'BYD Seal', plate: '—' })
  })
})

describe('formatModelId', () => {
  it.each([
    ['song-plus', 'Song Plus'],
    ['yuan-up', 'Yuan Up'],
    ['seal', 'Seal'],
  ])('%s → %s', (id, expected) => {
    expect(formatModelId(id)).toBe(expected)
  })
})

describe('formatTime', () => {
  it('formatea HH:mm en hora de Ecuador', () => {
    expect(formatTime('2026-10-08T14:00:00Z')).toBe('09:00')
    expect(formatTime('2026-10-08T23:05:00Z')).toBe('18:05')
    expect(formatTime('2026-10-09T04:59:00Z')).toBe('23:59')
  })
})
