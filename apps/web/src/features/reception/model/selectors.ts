import { APPOINTMENT_TYPE_LABELS } from './labels'
import type { Appointment, LeadRead } from './schemas'

const ECUADOR_TIME_ZONE = 'America/Guayaquil'
const NO_VALUE = '—'

const ecuadorDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: ECUADOR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const ecuadorClock = new Intl.DateTimeFormat('en-US', {
  timeZone: ECUADOR_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const ecuadorClockWithSeconds = new Intl.DateTimeFormat('en-US', {
  timeZone: ECUADOR_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export interface AdvisorKpis {
  leadsInInbox: number
  afterHours: number
  testDrives: number
  crmPending: number
}

export interface AdvisorRow {
  lead: LeadRead
  appointment: Appointment | undefined
}

export interface WorkshopAgendaItem {
  id: string
  leadName: string
  phoneMasked: string
  model: string
  plate: string
  reason: string
  loyaltyNote: string | undefined
  afterHours: boolean
}

export interface WorkshopSlotGroup {
  label: string
  items: WorkshopAgendaItem[]
}

export interface Vehicle {
  model: string
  plate: string
}

export function buildAdvisorKpis(
  leads: readonly LeadRead[],
  appointments: readonly Appointment[],
): AdvisorKpis {
  return {
    leadsInInbox: leads.length,
    afterHours: leads.filter((lead) => lead.afterHours).length,
    testDrives: appointments.filter((a) => a.type === 'test_drive').length,
    crmPending: leads.filter((lead) => lead.crmStatus !== 'pushed').length,
  }
}

export function indexBy<T extends { id: string }>(
  items: readonly T[],
): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

/** Primera cita (por inicio de slot) de cada lead. */
export function appointmentByLeadId(
  appointments: readonly Appointment[],
): Map<string, Appointment> {
  const byLead = new Map<string, Appointment>()
  for (const appointment of sortBySlotStart(appointments)) {
    if (!byLead.has(appointment.leadId)) {
      byLead.set(appointment.leadId, appointment)
    }
  }
  return byLead
}

export function buildAdvisorRows(
  leads: readonly LeadRead[],
  appointments: readonly Appointment[],
): AdvisorRow[] {
  const byLead = appointmentByLeadId(appointments)
  return leads.map((lead) => ({ lead, appointment: byLead.get(lead.id) }))
}

export function describeAppointment(
  appointment: Appointment | undefined,
): string {
  if (!appointment) return NO_VALUE
  return `${APPOINTMENT_TYPE_LABELS[appointment.type]} · ${formatTime(appointment.slot.start)}`
}

export function isSameEcuadorDay(iso: string, now: Date): boolean {
  return ecuadorDate.format(new Date(iso)) === ecuadorDate.format(now)
}

export function buildWorkshopAgenda(
  appointments: readonly Appointment[],
  leads: readonly LeadRead[],
  now: Date,
): WorkshopSlotGroup[] {
  const leadsById = indexBy(leads)
  const todayService = sortBySlotStart(
    appointments.filter(
      (a) => a.type === 'service' && isSameEcuadorDay(a.slot.start, now),
    ),
  )

  const groups = new Map<string, WorkshopAgendaItem[]>()
  for (const appointment of todayService) {
    const label = `${formatTime(appointment.slot.start)}–${formatTime(appointment.slot.end)}`
    const items = groups.get(label) ?? []
    items.push(toAgendaItem(appointment, leadsById.get(appointment.leadId)))
    groups.set(label, items)
  }
  return [...groups].map(([label, items]) => ({ label, items }))
}

function toAgendaItem(
  appointment: Appointment,
  lead: LeadRead | undefined,
): WorkshopAgendaItem {
  const { model, plate } = parseVehicle(appointment.vehicle ?? NO_VALUE)
  return {
    id: appointment.id,
    leadName: appointment.leadName ?? lead?.name ?? NO_VALUE,
    phoneMasked: appointment.leadPhoneMasked ?? lead?.phoneMasked ?? NO_VALUE,
    model,
    plate,
    reason: appointment.notes ?? NO_VALUE,
    loyaltyNote: appointment.loyaltyNote,
    afterHours: lead?.afterHours ?? false,
  }
}

function sortBySlotStart(appointments: readonly Appointment[]): Appointment[] {
  return [...appointments].sort(
    (a, b) => Date.parse(a.slot.start) - Date.parse(b.slot.start),
  )
}

export function parseVehicle(vehicle: string): Vehicle {
  const separator = ' · '
  const index = vehicle.indexOf(separator)
  if (index === -1) return { model: vehicle, plate: NO_VALUE }
  return {
    model: vehicle.slice(0, index),
    plate: vehicle.slice(index + separator.length),
  }
}

export function formatModelId(modelId: string): string {
  return modelId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatTime(iso: string): string {
  const parts = ecuadorClock.formatToParts(new Date(iso))
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

/** "HH:mm:ss" en hora de Ecuador. */
export function formatClock(date: Date): string {
  const parts = ecuadorClockWithSeconds.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00'
  return `${part('hour')}:${part('minute')}:${part('second')}`
}

/**
 * Ids de `currentIds` que no estaban en `previousIds`.
 * Sin `previousIds` (primera carga) no marca nada.
 */
export function markNewIds(
  previousIds: Iterable<string> | null | undefined,
  currentIds: Iterable<string>,
): Set<string> {
  if (!previousIds) return new Set()
  const known = new Set(previousIds)
  return new Set([...currentIds].filter((id) => !known.has(id)))
}
