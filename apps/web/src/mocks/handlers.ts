import type { RequestHandler } from 'msw'
import { catalogHandlers } from './catalog/handlers'
import { receptionHandlers } from './reception/handlers'

export const handlers: RequestHandler[] = [
  ...receptionHandlers,
  ...catalogHandlers,
  // Un spread por línea: agrega aquí los handlers de cada feature.
]
