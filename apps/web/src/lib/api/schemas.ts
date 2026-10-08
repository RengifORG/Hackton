import { z } from 'zod'
import type { Assert, MatchesContract } from './contract'
import type { components, paths } from './schema'
import { chatResponseSuggestedActionsValues, hotspotValues } from './schema'

type ApiSchemas = components['schemas']
type HotspotPoint = NonNullable<ApiSchemas['Model']['hotspots']>[number]
type RecommendOperation = paths['/recommendations']['post']
type RecommendRequest =
  RecommendOperation['requestBody']['content']['application/json']
type RecommendationsResponse =
  RecommendOperation['responses'][200]['content']['application/json']

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

export const ChatRequestSchema = z.strictObject({
  sessionId: z.string().min(8).max(64),
  message: z.string().min(1).max(1000),
  modelId: z.string().optional(),
})

export const ChatResponseSchema = z.object({
  reply: z.string(),
  suggestedActions: z.array(SuggestedActionSchema),
  hotspot: HotspotSchema.optional(),
})

export const RecommendationSchema = z.object({
  modelId: z.string(),
  name: z.string(),
  price: z.number(),
  reason: z.string().max(200),
})

export const RecommendRequestSchema = z.strictObject({
  profile: z.string().min(5).max(500),
  sessionId: z.string().optional(),
})

export const RecommendationsResponseSchema = z.object({
  items: z.array(RecommendationSchema).length(3),
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
  Assert<MatchesContract<typeof ChatRequestSchema, ApiSchemas['ChatRequest']>>,
  Assert<
    MatchesContract<typeof ChatResponseSchema, ApiSchemas['ChatResponse']>
  >,
  Assert<
    MatchesContract<typeof RecommendationSchema, ApiSchemas['Recommendation']>
  >,
  Assert<MatchesContract<typeof RecommendRequestSchema, RecommendRequest>>,
  Assert<
    MatchesContract<
      typeof RecommendationsResponseSchema,
      RecommendationsResponse
    >
  >,
]
