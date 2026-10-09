import { http, HttpResponse } from 'msw'
import { ModelSummarySchema } from '@/lib/api/schemas'
import { env } from '@/lib/env'
import { catalogModels, findCatalogModel } from './data'

// Rutas absolutas contra env.apiUrl, nunca comodines: `*/models/:modelId`
// también atraparía `/models/seagull.glb` del front.
export const catalogHandlers = [
  http.get(`${env.apiUrl}/models`, () =>
    HttpResponse.json(
      catalogModels.map((model) => ModelSummarySchema.parse(model)),
    ),
  ),
  http.get<{ modelId: string }>(
    `${env.apiUrl}/models/:modelId`,
    ({ params }) => {
      const model = findCatalogModel(params.modelId)
      return model
        ? HttpResponse.json(model)
        : HttpResponse.json({ detail: 'Modelo no encontrado' }, { status: 404 })
    },
  ),
]
