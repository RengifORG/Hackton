import { z } from 'zod'
import type { components } from '@/lib/api/schema'

type ApiSchemas = components['schemas']

export type LeadRead = ApiSchemas['LeadRead']
export type Appointment = ApiSchemas['Appointment']
export type Slot = ApiSchemas['Slot']
export type AppointmentType = ApiSchemas['AppointmentType']

export const PhoneMaskedSchema = z.string().regex(/^09\*{4}\d{4}$/)

// RFC 3339 (format: date-time) admite offset además de "Z".
const DateTimeSchema = z.iso.datetime({ offset: true })

export const AppointmentTypeSchema = z.enum(['test_drive', 'service'])

export const LeadReadSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  phoneMasked: PhoneMaskedSchema,
  source: z.enum(['web', 'whatsapp']),
  interest: z.string().max(200).optional(),
  recommendedModels: z.array(z.string()).max(3).optional(),
  createdAt: DateTimeSchema,
  afterHours: z.boolean(),
  crmStatus: z.enum(['pending', 'pushed', 'failed']).optional(),
})

export const SlotSchema = z.strictObject({
  id: z.string(),
  start: DateTimeSchema,
  end: DateTimeSchema,
  location: z.string(),
  available: z.boolean(),
})

export const AppointmentSchema = z.strictObject({
  id: z.string(),
  leadId: z.string(),
  type: AppointmentTypeSchema,
  slotId: z.string(),
  vehicle: z.string().max(80).optional(),
  notes: z.string().max(300).optional(),
  status: z.enum(['confirmed', 'cancelled']),
  createdAt: DateTimeSchema,
  slot: SlotSchema,
  leadName: z.string().optional(),
  leadPhoneMasked: PhoneMaskedSchema.optional(),
})

// Guardas de contrato: `tsc -b` falla si un esquema zod se desvía del tipo
// generado desde openapi.yaml. La asignabilidad mutua no detecta un opcional
// de más o de menos, por eso también se comparan las claves.
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false
type MatchesContract<Schema extends z.ZodType, Contract> =
  MutuallyAssignable<z.infer<Schema>, Contract> extends true
    ? MutuallyAssignable<keyof z.infer<Schema>, keyof Contract>
    : false
type Assert<T extends true> = T

export type ContractChecks = [
  Assert<MatchesContract<typeof LeadReadSchema, LeadRead>>,
  Assert<MatchesContract<typeof AppointmentSchema, Appointment>>,
  Assert<MatchesContract<typeof SlotSchema, Slot>>,
  Assert<MatchesContract<typeof AppointmentTypeSchema, AppointmentType>>,
]
