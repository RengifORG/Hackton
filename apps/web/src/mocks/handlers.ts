import type { RequestHandler } from 'msw'
import { catalogHandlers } from './catalog/handlers'
import { chatHandlers } from './chat/handlers'
import { leadHandlers } from './leads/handlers'
import { receptionHandlers } from './reception/handlers'
import { recommendationHandlers } from './recommendations/handlers'

export const handlers: RequestHandler[] = [
  ...receptionHandlers,
  ...catalogHandlers,
  ...chatHandlers,
  ...recommendationHandlers,
  ...leadHandlers,
  // Un spread por línea: agrega aquí los handlers de cada feature.
]
