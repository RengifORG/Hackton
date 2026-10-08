import { z } from 'zod'
import {
  AppointmentSchema,
  LeadReadSchema,
  type Appointment,
  type AppointmentType,
  type LeadRead,
} from '../model/schemas'

// TODO: migrar al cliente tipado de T1 cuando esté en main.

export class ReceptionApiError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ReceptionApiError'
    this.status = status
  }
}

const LeadListSchema = z.array(LeadReadSchema)
const AppointmentListSchema = z.array(AppointmentSchema)

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

// Los mensajes no incluyen el cuerpo ni los issues de zod: podrían llevar PII.
async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new ReceptionApiError('No se pudo conectar con el servidor')
  }
  if (!response.ok) {
    throw new ReceptionApiError(
      `El servidor respondió ${response.status}`,
      response.status,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ReceptionApiError('La respuesta no es JSON', response.status)
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ReceptionApiError(
      'La respuesta no cumple el contrato',
      response.status,
    )
  }
  return parsed.data
}

export function fetchLeads(baseUrl: string): Promise<LeadRead[]> {
  return getJson(buildUrl(baseUrl, '/leads'), LeadListSchema)
}

export function fetchAppointments(
  baseUrl: string,
  type?: AppointmentType,
): Promise<Appointment[]> {
  const query = type ? `?${new URLSearchParams({ type })}` : ''
  return getJson(
    buildUrl(baseUrl, `/appointments${query}`),
    AppointmentListSchema,
  )
}
