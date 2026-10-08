import type {
  Appointment,
  AppointmentType,
  LeadRead,
} from '@/features/reception/model/schemas'

// America/Guayaquil: UTC-5 fijo, sin horario de verano.
const ECUADOR_UTC_OFFSET_HOURS = 5
const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

/** ISO UTC de una hora local de Ecuador, `daysOffset` días respecto a la fecha de Ecuador de `now`. */
function ecuadorTime(
  now: Date,
  daysOffset: number,
  hours: number,
  minutes = 0,
): string {
  const local = new Date(now.getTime() - ECUADOR_UTC_OFFSET_HOURS * HOUR_MS)
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + daysOffset,
      hours + ECUADOR_UTC_OFFSET_HOURS,
      minutes,
    ),
  ).toISOString()
}

/** Leads capturados el día anterior (hora de Ecuador): 5 fuera de horario. */
export function buildLeads(now: Date): LeadRead[] {
  const yesterday = (hours: number, minutes: number) =>
    ecuadorTime(now, -1, hours, minutes)

  return [
    {
      id: 'lead-001',
      name: 'Valeria Chiriboga',
      phoneMasked: '09****4821',
      source: 'whatsapp',
      interest:
        'Mantenimiento de 10.000 km de su Dolphin; pidió turno en taller',
      createdAt: yesterday(6, 40),
      afterHours: true,
      crmStatus: 'pushed',
    },
    {
      id: 'lead-002',
      name: 'Diego Salazar',
      phoneMasked: '09****3307',
      source: 'web',
      interest: 'Compara Seal y Shark para uso mixto ciudad-carretera',
      recommendedModels: ['seal', 'shark'],
      createdAt: yesterday(9, 15),
      afterHours: false,
      crmStatus: 'pushed',
    },
    {
      id: 'lead-003',
      name: 'Gabriela Moncayo',
      phoneMasked: '09****7719',
      source: 'whatsapp',
      interest: 'Ruido en la suspensión delantera de su Yuan Up',
      createdAt: yesterday(12, 30),
      afterHours: false,
      crmStatus: 'failed',
    },
    {
      id: 'lead-004',
      name: 'Martín Cevallos',
      phoneMasked: '09****2154',
      source: 'web',
      interest: 'Primer eléctrico para la ciudad, presupuesto menor a 25 mil',
      recommendedModels: ['dolphin', 'seagull'],
      createdAt: yesterday(16, 50),
      afterHours: false,
      crmStatus: 'pending',
    },
    {
      id: 'lead-005',
      name: 'Paula Jaramillo',
      phoneMasked: '09****6683',
      source: 'web',
      interest:
        'Familia de cinco con viajes a la Costa; pregunta autonomía real',
      recommendedModels: ['song-plus', 'shark', 'seal'],
      createdAt: yesterday(18, 20),
      afterHours: true,
      crmStatus: 'pending',
    },
    {
      id: 'lead-006',
      name: 'Andrés Benítez',
      phoneMasked: '09****9046',
      source: 'whatsapp',
      interest: 'Revisión de batería y actualización de software de su Seal',
      createdAt: yesterday(20, 5),
      afterHours: true,
      crmStatus: 'pending',
    },
    {
      id: 'lead-007',
      name: 'Sofía Paredes',
      phoneMasked: '09****5132',
      source: 'web',
      interest: 'Quiere probar el Dolphin y conocer opciones de financiamiento',
      recommendedModels: ['dolphin'],
      createdAt: yesterday(22, 45),
      afterHours: true,
      crmStatus: 'failed',
    },
    {
      id: 'lead-008',
      name: 'Javier Loor',
      phoneMasked: '09****8270',
      source: 'whatsapp',
      interest: 'Consulta precio del Seagull y puntos de carga en Quito',
      recommendedModels: ['seagull', 'dolphin'],
      createdAt: yesterday(23, 30),
      afterHours: true,
      crmStatus: 'pushed',
    },
  ]
}

const LOCATIONS: Record<AppointmentType, string> = {
  test_drive: 'Concesionario BYD Quito Norte',
  service: 'Taller BYD Quito Norte',
}

type AppointmentSeed = {
  leadId: string
  type: AppointmentType
  hour: number
  vehicle: string
  notes?: string
}

const APPOINTMENT_SEEDS: AppointmentSeed[] = [
  {
    leadId: 'lead-001',
    type: 'service',
    hour: 9,
    vehicle: 'BYD Dolphin · PCX-1234',
    notes: 'Mantenimiento de 10.000 km',
  },
  { leadId: 'lead-002', type: 'test_drive', hour: 10, vehicle: 'BYD Seal' },
  {
    leadId: 'lead-003',
    type: 'service',
    hour: 11,
    vehicle: 'BYD Yuan Up · PBA-5678',
    notes: 'Ruido en la suspensión delantera',
  },
  {
    leadId: 'lead-005',
    type: 'test_drive',
    hour: 14,
    vehicle: 'BYD Song Plus',
  },
  {
    leadId: 'lead-006',
    type: 'service',
    hour: 15,
    vehicle: 'BYD Seal · PDQ-9012',
    notes: 'Revisión de batería y actualización de software',
  },
  { leadId: 'lead-007', type: 'test_drive', hour: 16, vehicle: 'BYD Dolphin' },
]

/** Citas de hoy (fecha de Ecuador de `now`), agendadas por los leads de buildLeads. */
export function buildAppointments(now: Date): Appointment[] {
  const leadsById = new Map(buildLeads(now).map((lead) => [lead.id, lead]))

  return APPOINTMENT_SEEDS.map(({ hour, ...seed }, index) => {
    const lead = leadsById.get(seed.leadId)
    if (!lead) throw new Error(`Fixture inválido: no existe ${seed.leadId}`)
    const slotId = `slot-${seed.type}-${String(hour).padStart(2, '0')}00`

    return {
      ...seed,
      id: `apt-${String(index + 1).padStart(3, '0')}`,
      slotId,
      status: 'confirmed',
      createdAt: new Date(
        Date.parse(lead.createdAt) + 6 * MINUTE_MS,
      ).toISOString(),
      slot: {
        id: slotId,
        start: ecuadorTime(now, 0, hour),
        end: ecuadorTime(now, 0, hour + 1),
        location: LOCATIONS[seed.type],
        available: false,
      },
      leadName: lead.name,
      leadPhoneMasked: lead.phoneMasked,
    }
  })
}
