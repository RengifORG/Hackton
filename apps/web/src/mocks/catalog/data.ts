import catalog from '@data/catalog.json'
import { ModelSchema } from '@/lib/api/schemas'

// Misma forma que la API F0: ModelSchema descarta los campos internos del
// catálogo (currency, idealFor, model3d, rangeStandard) y hotspots es []
// cuando el modelo no tiene.
export const catalogModels = catalog.models.map((raw) => {
  const model = ModelSchema.parse(raw)
  return { ...model, hotspots: model.hotspots ?? [] }
})

export type CatalogModel = (typeof catalogModels)[number]

export function findCatalogModel(modelId: string): CatalogModel | undefined {
  return catalogModels.find(({ id }) => id === modelId)
}
