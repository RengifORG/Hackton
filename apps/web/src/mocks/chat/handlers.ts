import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { ChatRequestSchema } from '@/lib/api/schemas'
import { hotspotValues, type ChatResponse, type Hotspot } from '@/lib/api/types'
import { env } from '@/lib/env'
import { findCatalogModel, type CatalogModel } from '../catalog/data'
import { readJsonBody, validationError } from '../validation'

const DEFAULT_MODEL_ID = 'dolphin'
const LOPDP_NOTICE =
  'Tus datos se tratan según la LOPDP de Ecuador solo para atender tu solicitud.'
const GREETING = '¡Hola! Soy el asesor virtual de BYD Ecuador. ¿Qué buscas hoy?'
const NO_DATA = 'No tengo ese dato, un asesor te confirma.'
const UNVERIFIED_NOTE = '(dato por confirmar con un asesor)'

// Sesiones que ya recibieron el aviso LOPDP (memoria del módulo).
const seenSessions = new Set<string>()

const HOTSPOT_PATTERNS = {
  wheels: /llanta|rueda|neumatico|rin/,
  seats: /asiento|interior/,
  screen: /pantalla|infotainment/,
  battery: /bateria|autonomia|carga/,
  trunk: /maletero|baul|cajuela/,
  lights: /luz|luces|faro/,
} satisfies Record<Hotspot, RegExp>

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function detectHotspot(message: string): Hotspot | undefined {
  const text = normalize(message)
  return hotspotValues.find((hotspot) => HOTSPOT_PATTERNS[hotspot].test(text))
}

// --- Lectura de specs (llegan como unknown desde el catálogo) ---

const verifiedFlag = { verified: z.boolean().optional() }

const WheelsSpecSchema = z.object({
  tire: z.string().optional(),
  rimInches: z.number().optional(),
  type: z.string().optional(),
  ...verifiedFlag,
})
const SeatsSpecSchema = z.object({
  count: z.number().optional(),
  material: z.string().optional(),
  frontAdjustment: z.string().optional(),
  rearFold: z.string().optional(),
  ...verifiedFlag,
})
const ScreenSpecSchema = z.object({
  sizeInches: z.number().optional(),
  type: z.string().optional(),
  voice: z.string().optional(),
  usbPorts: z.number().optional(),
  ...verifiedFlag,
})
const BatterySpecSchema = z.object({
  type: z.string().optional(),
  capacityKwh: z.number().optional(),
  ...verifiedFlag,
})
const DimensionsSpecSchema = z.object({
  trunkL: z.number().optional(),
  ...verifiedFlag,
})
const SpecsRootSchema = z.object(verifiedFlag)

interface SpecFacts {
  facts: string[]
  verified: boolean
}

const NO_FACTS: SpecFacts = { facts: [], verified: true }

function fact<T>(
  value: T | undefined,
  format: (value: T) => string,
): string | undefined {
  return value === undefined ? undefined : format(value)
}

function readSpec<T extends { verified?: boolean }>(
  schema: z.ZodType<T>,
  raw: unknown,
  toFacts: (spec: T) => (string | undefined)[],
): SpecFacts {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return NO_FACTS
  return {
    facts: toFacts(parsed.data).filter((item) => item !== undefined),
    verified: parsed.data.verified !== false,
  }
}

const SPEC_READERS = {
  wheels: (model) =>
    readSpec(WheelsSpecSchema, model.specs?.wheels, (spec) => [
      fact(spec.tire, (tire) => `llantas ${tire}`),
      fact(spec.rimInches, (inches) => `rin de ${inches} pulgadas`),
      fact(spec.type, (type) => `rines de ${type.toLowerCase()}`),
    ]),
  seats: (model) =>
    readSpec(SeatsSpecSchema, model.specs?.seats, (spec) => [
      fact(spec.count, (count) => `${count} plazas`),
      fact(spec.material, (material) => `tapizado ${material.toLowerCase()}`),
      fact(spec.frontAdjustment, (adj) => `ajuste ${adj.toLowerCase()}`),
      fact(spec.rearFold, (fold) => `respaldo trasero abatible ${fold}`),
    ]),
  screen: (model) =>
    readSpec(ScreenSpecSchema, model.specs?.screen, (spec) => [
      fact(spec.sizeInches, (inches) => `pantalla de ${inches} pulgadas`),
      fact(spec.type, (type) => type),
      fact(spec.voice, (voice) => `asistente de voz "${voice}"`),
      fact(spec.usbPorts, (ports) => `${ports} puertos USB`),
    ]),
  battery: (model) => {
    const battery = readSpec(
      BatterySpecSchema,
      model.specs?.battery,
      (spec) => [
        fact(spec.type, (type) => type),
        fact(spec.capacityKwh, (kwh) => `${kwh} kWh`),
      ],
    )
    return {
      facts: [...battery.facts, `autonomía de ${model.rangeKm} km`],
      verified: battery.verified,
    }
  },
  trunk: (model) =>
    readSpec(DimensionsSpecSchema, model.specs?.dimensions, (spec) => [
      fact(spec.trunkL, (liters) => `${liters} litros de capacidad`),
    ]),
  lights: () => NO_FACTS,
} satisfies Record<Hotspot, (model: CatalogModel) => SpecFacts>

function hotspotReply(hotspot: Hotspot, modelId: string): string {
  const model = findCatalogModel(modelId)
  if (!model) return NO_DATA

  const { facts, verified } = SPEC_READERS[hotspot](model)
  if (facts.length === 0) return NO_DATA

  const specsVerified =
    SpecsRootSchema.safeParse(model.specs).data?.verified !== false
  const label = model.hotspots.find(({ id }) => id === hotspot)?.label
  const subject = label ? `${label} del ${model.name}` : model.name
  const note = verified && specsVerified ? '' : ` ${UNVERIFIED_NOTE}`
  return `${subject}: ${facts.join(', ')}.${note}`
}

// --- Respuesta ---

function answer(
  message: string,
  modelId: string | undefined,
  isFirstMessage: boolean,
): ChatResponse {
  const hotspot = detectHotspot(message)
  if (hotspot) {
    return {
      reply: hotspotReply(hotspot, modelId ?? DEFAULT_MODEL_ID),
      suggestedActions: ['view_3d', 'book_test_drive'],
      hotspot,
    }
  }
  if (isFirstMessage) {
    return {
      reply: GREETING,
      suggestedActions: [
        'recommend',
        'view_3d',
        'book_test_drive',
        'book_service',
      ],
    }
  }
  return {
    reply: NO_DATA,
    suggestedActions: ['leave_contact', 'book_test_drive'],
  }
}

export const chatHandlers = [
  http.post(`${env.apiUrl}/chat`, async ({ request }) => {
    const parsed = ChatRequestSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) return validationError(parsed.error)

    const { sessionId, message, modelId } = parsed.data
    const isFirstMessage = !seenSessions.has(sessionId)
    seenSessions.add(sessionId)

    const response = answer(message, modelId, isFirstMessage)
    return HttpResponse.json({
      ...response,
      reply: isFirstMessage
        ? `${LOPDP_NOTICE}\n${response.reply}`
        : response.reply,
    } satisfies ChatResponse)
  }),
]
