import catalog from '@data/catalog.json'
import { http, HttpResponse } from 'msw'
import { ModelSchema, ModelSummarySchema } from '@/lib/api/schemas'
import { env } from '@/lib/env'

// Misma forma que la API F0: ModelSchema descarta los campos internos del
// catálogo (currency, idealFor, model3d, rangeStandard) y hotspots es []
// cuando el modelo no tiene.
const models = catalog.models.map((raw) => {
  const model = ModelSchema.parse(raw)
  return { ...model, hotspots: model.hotspots ?? [] }
})

// Rutas absolutas contra env.apiUrl, nunca comodines: `*/models/:modelId`
// también atraparía `/models/dolphin.glb` del front.
export const catalogHandlers = [
  http.get(`${env.apiUrl}/models`, () =>
    HttpResponse.json(models.map((model) => ModelSummarySchema.parse(model))),
  ),
  http.get<{ modelId: string }>(
    `${env.apiUrl}/models/:modelId`,
    ({ params }) => {
      const model = models.find(({ id }) => id === params.modelId)
      return model
        ? HttpResponse.json(model)
        : HttpResponse.json({ detail: 'Modelo no encontrado' }, { status: 404 })
    },
  ),
]
