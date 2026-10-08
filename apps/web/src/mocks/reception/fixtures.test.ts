// @vitest-environment node
import { z } from 'zod'
import { isAfterHours } from '@/features/reception/model/afterHours'
import {
  AppointmentSchema,
  LeadReadSchema,
} from '@/features/reception/model/schemas'
import { buildAppointments, buildLeads } from './fixtures'
// `?raw` (tipado por vite/client) evita depender de @types/node en tsconfig.app.
import catalogJson from '../../../../../data/catalog.json?raw'

const NOW = new Date('2026-10-08T15:00:00Z')

const CatalogSchema = z.object({
  models: z.array(z.object({ id: z.string() })),
})

function readCatalogIds(): Set<string> {
  const raw: unknown = JSON.parse(catalogJson)
  return new Set(CatalogSchema.parse(raw).models.map((model) => model.id))
}

describe('buildLeads', () => {
  const leads = buildLeads(NOW)

  it('devuelve 8 leads y exactamente 5 fuera de horario', () => {
    expect(leads).toHaveLength(8)
    expect(leads.filter((lead) => lead.afterHours)).toHaveLength(5)
  })

  it('afterHours coincide con isAfterHours(createdAt) en cada lead', () => {
    for (const lead of leads) {
      expect(lead.afterHours, lead.id).toBe(isAfterHours(lead.createdAt))
    }
  })

  it('cada lead valida contra LeadReadSchema', () => {
    for (const lead of leads) {
      expect(LeadReadSchema.safeParse(lead).success, lead.id).toBe(true)
    }
  })

  it('mezcla los estados de CRM pending, pushed y failed', () => {
    const statuses = new Set(leads.map((lead) => lead.crmStatus))
    expect(statuses).toEqual(new Set(['pending', 'pushed', 'failed']))
  })

  it('solo recomienda modelos del catálogo', () => {
    const catalogIds = readCatalogIds()
    for (const lead of leads) {
      for (const modelId of lead.recommendedModels ?? []) {
        expect(catalogIds.has(modelId), `${lead.id}: ${modelId}`).toBe(true)
      }
    }
  })

  it('no expone la clave "phone" (PII)', () => {
    expect(JSON.stringify(leads)).not.toContain('"phone"')
  })
})

describe('buildAppointments', () => {
  const leads = buildLeads(NOW)
  const appointments = buildAppointments(NOW)

  it('devuelve 6 citas: 3 test_drive y 3 service', () => {
    expect(appointments).toHaveLength(6)
    expect(appointments.filter((a) => a.type === 'test_drive')).toHaveLength(3)
    expect(appointments.filter((a) => a.type === 'service')).toHaveLength(3)
  })

  it('cada cita valida contra AppointmentSchema', () => {
    for (const appointment of appointments) {
      expect(
        AppointmentSchema.safeParse(appointment).success,
        appointment.id,
      ).toBe(true)
    }
  })

  it('cada cita referencia un slot coherente', () => {
    for (const appointment of appointments) {
      expect(appointment.slotId).toBe(appointment.slot.id)
      expect(Date.parse(appointment.slot.start)).toBeLessThan(
        Date.parse(appointment.slot.end),
      )
    }
  })

  it('cada leadId existe entre los leads, con su nombre y teléfono enmascarado', () => {
    const leadsById = new Map(leads.map((lead) => [lead.id, lead]))
    for (const appointment of appointments) {
      const lead = leadsById.get(appointment.leadId)
      expect(lead, appointment.id).toBeDefined()
      expect(appointment.leadName).toBe(lead?.name)
      expect(appointment.leadPhoneMasked).toBe(lead?.phoneMasked)
    }
  })

  it('las citas service indican vehículo "modelo · placa" y motivo', () => {
    for (const appointment of appointments.filter(
      (a) => a.type === 'service',
    )) {
      expect(appointment.vehicle).toMatch(/^BYD .+ · [A-Z]{3}-\d{4}$/)
      expect(appointment.notes).toBeTruthy()
    }
  })

  it('exactamente 1 cita service lleva el beneficio SmartClub (reto 1)', () => {
    const withLoyalty = appointments.filter((a) => a.loyaltyNote !== undefined)
    expect(withLoyalty).toHaveLength(1)
    expect(withLoyalty[0]?.type).toBe('service')
    expect(withLoyalty[0]?.loyaltyNote).toBe(
      'Acumulas cashback SmartClub canjeable en Farmaenlace',
    )
  })
})
