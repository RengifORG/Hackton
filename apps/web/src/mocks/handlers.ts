import type { RequestHandler } from 'msw'
import { catalogHandlers } from './catalog/handlers'
import { chatHandlers } from './chat/handlers'
import { receptionHandlers } from './reception/handlers'
import { recommendationHandlers } from './recommendations/handlers'

export const handlers: RequestHandler[] = [
  ...receptionHandlers,
  ...catalogHandlers,
  ...chatHandlers,
  ...recommendationHandlers,
  // Un spread por línea: agrega aquí los handlers de cada feature.
]
