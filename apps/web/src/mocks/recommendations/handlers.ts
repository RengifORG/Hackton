import { http, HttpResponse } from 'msw'
import { RecommendRequestSchema } from '@/lib/api/schemas'
import type { Recommendation } from '@/lib/api/types'
import { env } from '@/lib/env'
import { catalogModels, type CatalogModel } from '../catalog/data'
import { readJsonBody, validationError } from '../validation'

const RECOMMENDATION_COUNT = 3
const REASON_MAX_LENGTH = 200

// "30k" / "30.5k" → miles; "30000" / "$30.000" / "$30,000" → monto.
// Números cortos ("familia de 4") no cuentan como presupuesto.
function parseBudget(profile: string): number | undefined {
  const text = profile.toLowerCase()
  const thousands = /(\d+(?:[.,]\d+)?)\s*k\b/.exec(text)?.[1]
  if (thousands) return Number(thousands.replace(',', '.')) * 1000
  const amount = /(\d{1,3}(?:[.,]\d{3})+|\d{4,})/.exec(text)?.[1]
  if (amount) return Number(amount.replace(/[.,]/g, ''))
  return undefined
}

function rank(budget: number | undefined): CatalogModel[] {
  const distance = (model: CatalogModel) =>
    budget === undefined ? model.price : Math.abs(model.price - budget)
  return [...catalogModels]
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, RECOMMENDATION_COUNT)
}

function toRecommendation(
  model: CatalogModel,
  budget: number | undefined,
): Recommendation {
  const fit =
    budget === undefined
      ? 'Entre las opciones más accesibles.'
      : 'Cercano a tu presupuesto.'
  const reason = `${model.segment}: USD ${model.price}, ${model.rangeKm} km de autonomía. ${fit}`
  return {
    modelId: model.id,
    name: model.name,
    price: model.price,
    reason: reason.slice(0, REASON_MAX_LENGTH),
  }
}

export const recommendationHandlers = [
  http.post(`${env.apiUrl}/recommendations`, async ({ request }) => {
    const parsed = RecommendRequestSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) return validationError(parsed.error)

    const budget = parseBudget(parsed.data.profile)
    return HttpResponse.json({
      items: rank(budget).map((model) => toRecommendation(model, budget)),
    })
  }),
]
