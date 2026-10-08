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
  /** "Test drive · Mañana 10:00" o "—". */
  appointmentLabel: string
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

export interface WorkshopDayGroup {
  /** YYYY-MM-DD en hora de Ecuador. */
  date: string
  label: string
  slots: WorkshopSlotGroup[]
}

/** La agenda muestra hoy y los próximos N días (las citas del demo suelen caer mañana). */
export const AGENDA_DAYS_AHEAD = 7

// Tabla propia para no depender de cómo abrevia cada ICU ("jue" vs "jue.").
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DAY_MS = 24 * 60 * 60 * 1000

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
  now: Date,
): AdvisorRow[] {
  const byLead = appointmentByLeadId(appointments)
  return leads.map((lead) => {
    const appointment = byLead.get(lead.id)
    return {
      lead,
      appointment,
      appointmentLabel: describeAppointment(appointment, now),
    }
  })
}

/** "Test drive · Hoy 10:00", "Taller · Mañana 09:00" o "Taller · Dom 11 09:00". */
export function describeAppointment(
  appointment: Appointment | undefined,
  now: Date,
): string {
  if (!appointment) return NO_VALUE
  const { start } = appointment.slot
  const dateKey = ecuadorDateKey(new Date(start))
  const day = formatRelativeDay(dateKey, dayOffsetFromKey(dateKey, now))
  return `${APPOINTMENT_TYPE_LABELS[appointment.type]} · ${day} ${formatTime(start)}`
}

export function isSameEcuadorDay(iso: string, now: Date): boolean {
  return ecuadorDate.format(new Date(iso)) === ecuadorDate.format(now)
}

/** Fecha YYYY-MM-DD en hora de Ecuador. */
function ecuadorDateKey(date: Date): string {
  return ecuadorDate.format(date)
}

/** Medianoche UTC de una fecha YYYY-MM-DD: sirve para restar días sin horario de verano. */
function dateKeyToUtc(key: string): number {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function dayOffsetFromKey(dateKey: string, now: Date): number {
  const diff = dateKeyToUtc(dateKey) - dateKeyToUtc(ecuadorDateKey(now))
  return Math.round(diff / DAY_MS)
}

/** Días entre la fecha (en Ecuador) de `iso` y la de `now`: 0 hoy, 1 mañana, -1 ayer. */
export function ecuadorDayOffset(iso: string, now: Date): number {
  return dayOffsetFromKey(ecuadorDateKey(new Date(iso)), now)
}

/** "Hoy · jue 8", "Mañana · vie 9" o "Sáb 10". */
export function formatAgendaDay(dateKey: string, offset: number): string {
  const relative = formatRelativeDay(dateKey, offset)
  return offset === 0 || offset === 1
    ? `${relative} · ${shortDay(dateKey)}`
    : relative
}

/** "jue 8": día de la semana abreviado y número. */
function shortDay(dateKey: string): string {
  const utc = new Date(dateKeyToUtc(dateKey))
  return `${WEEKDAYS[utc.getUTCDay()] ?? ''} ${utc.getUTCDate()}`
}

/** "Hoy", "Mañana" o "Dom 11". */
export function formatRelativeDay(dateKey: string, offset: number): string {
  if (offset === 0) return 'Hoy'
  if (offset === 1) return 'Mañana'
  const short = shortDay(dateKey)
  return short.charAt(0).toUpperCase() + short.slice(1)
}

function groupBySlot(
  appointments: readonly Appointment[],
  leadsById: Map<string, LeadRead>,
): WorkshopSlotGroup[] {
  const groups = new Map<string, WorkshopAgendaItem[]>()
  for (const appointment of appointments) {
    const label = `${formatTime(appointment.slot.start)}–${formatTime(appointment.slot.end)}`
    const items = groups.get(label) ?? []
    items.push(toAgendaItem(appointment, leadsById.get(appointment.leadId)))
    groups.set(label, items)
  }
  return [...groups].map(([label, items]) => ({ label, items }))
}

/** Citas service de hoy y los próximos AGENDA_DAYS_AHEAD días, por día y por franja. */
export function buildWorkshopAgenda(
  appointments: readonly Appointment[],
  leads: readonly LeadRead[],
  now: Date,
): WorkshopDayGroup[] {
  const leadsById = indexBy(leads)
  const upcoming = sortBySlotStart(
    appointments.filter((a) => {
      if (a.type !== 'service') return false
      const offset = ecuadorDayOffset(a.slot.start, now)
      return offset >= 0 && offset <= AGENDA_DAYS_AHEAD
    }),
  )

  const days = new Map<string, Appointment[]>()
  for (const appointment of upcoming) {
    const date = ecuadorDateKey(new Date(appointment.slot.start))
    days.set(date, [...(days.get(date) ?? []), appointment])
  }
  return [...days].map(([date, dayAppointments]) => ({
    date,
    label: formatAgendaDay(date, dayOffsetFromKey(date, now)),
    slots: groupBySlot(dayAppointments, leadsById),
  }))
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
