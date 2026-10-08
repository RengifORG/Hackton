import {
  AppointmentSchema,
  LeadReadSchema,
  PhoneMaskedSchema,
  type Appointment,
  type LeadRead,
} from './schemas'

const validLead: LeadRead = {
  id: 'lead-001',
  name: 'Lucía Paredes',
  phoneMasked: '09****1234',
  source: 'web',
  interest: 'Busca un eléctrico para la ciudad con presupuesto de 25 mil',
  recommendedModels: ['dolphin', 'seagull'],
  createdAt: '2026-10-08T01:30:00Z',
  afterHours: true,
  crmStatus: 'pending',
}

const validAppointment: Appointment = {
  id: 'apt-001',
  leadId: 'lead-001',
  type: 'service',
  slotId: 'slot-001',
  vehicle: 'BYD Dolphin · PCX-1234',
  notes: 'Mantenimiento de 10.000 km',
  status: 'confirmed',
  createdAt: '2026-10-08T01:35:00Z',
  slot: {
    id: 'slot-001',
    start: '2026-10-08T14:00:00Z',
    end: '2026-10-08T15:00:00Z',
    location: 'Taller BYD Quito Norte',
    available: false,
  },
  leadName: 'Lucía Paredes',
  leadPhoneMasked: '09****1234',
}

describe('PhoneMaskedSchema', () => {
  it('acepta el formato 09****1234', () => {
    expect(PhoneMaskedSchema.safeParse('09****1234').success).toBe(true)
  })

  it.each(['0991234567', '09***1234', '08****1234', '+593****1234'])(
    'rechaza %s',
    (value) => {
      expect(PhoneMaskedSchema.safeParse(value).success).toBe(false)
    },
  )
})

describe('LeadReadSchema', () => {
  it('acepta un LeadRead válido', () => {
    expect(LeadReadSchema.safeParse(validLead).success).toBe(true)
  })

  it('rechaza un campo extra', () => {
    expect(LeadReadSchema.safeParse({ ...validLead, extra: 'x' }).success).toBe(
      false,
    )
  })

  it('rechaza el campo phone (PII)', () => {
    expect(
      LeadReadSchema.safeParse({ ...validLead, phone: '0991234567' }).success,
    ).toBe(false)
  })

  it.each(['0991234567', '09***1234', '08****1234', '+593****1234'])(
    'rechaza phoneMasked=%s',
    (phoneMasked) => {
      expect(
        LeadReadSchema.safeParse({ ...validLead, phoneMasked }).success,
      ).toBe(false)
    },
  )
})

describe('AppointmentSchema', () => {
  it('acepta una cita válida', () => {
    expect(AppointmentSchema.safeParse(validAppointment).success).toBe(true)
  })

  it.each(['0991234567', '09***1234', '08****1234', '+593****1234'])(
    'rechaza leadPhoneMasked=%s',
    (leadPhoneMasked) => {
      expect(
        AppointmentSchema.safeParse({ ...validAppointment, leadPhoneMasked })
          .success,
      ).toBe(false)
    },
  )

  it('acepta loyaltyNote opcional de hasta 200 caracteres (C3)', () => {
    expect(
      AppointmentSchema.safeParse({
        ...validAppointment,
        loyaltyNote: 'x'.repeat(200),
      }).success,
    ).toBe(true)
  })

  it('rechaza loyaltyNote de más de 200 caracteres (C3)', () => {
    expect(
      AppointmentSchema.safeParse({
        ...validAppointment,
        loyaltyNote: 'x'.repeat(201),
      }).success,
    ).toBe(false)
  })
})
