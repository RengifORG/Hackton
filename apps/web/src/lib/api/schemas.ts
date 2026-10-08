import { z } from 'zod'
import type { Assert, MatchesContract } from './contract'
import type { components } from './schema'
import { chatResponseSuggestedActionsValues, hotspotValues } from './schema'

type ApiSchemas = components['schemas']
type HotspotPoint = NonNullable<ApiSchemas['Model']['hotspots']>[number]

export const HotspotSchema = z.enum(hotspotValues)
export const SuggestedActionSchema = z.enum(chatResponseSuggestedActionsValues)

export const HotspotPointSchema = z.object({
  id: HotspotSchema,
  label: z.string(),
  position: z.array(z.number()).length(3),
})

export const ModelSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  segment: z.string(),
  rangeKm: z.int(),
  thumbnail: z.string(),
  has3d: z.boolean().optional(),
})

export const ModelSchema = ModelSummarySchema.extend({
  specs: z.record(z.string(), z.unknown()).optional(),
  hotspots: z.array(HotspotPointSchema).optional(),
})

export type ContractChecks = [
  Assert<MatchesContract<typeof HotspotSchema, ApiSchemas['Hotspot']>>,
  Assert<
    MatchesContract<
      typeof SuggestedActionSchema,
      ApiSchemas['ChatResponse']['suggestedActions'][number]
    >
  >,
  Assert<MatchesContract<typeof HotspotPointSchema, HotspotPoint>>,
  Assert<
    MatchesContract<typeof ModelSummarySchema, ApiSchemas['ModelSummary']>
  >,
  Assert<MatchesContract<typeof ModelSchema, ApiSchemas['Model']>>,
]
