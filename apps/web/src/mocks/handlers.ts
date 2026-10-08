import type { RequestHandler } from 'msw'
import { receptionHandlers } from './reception/handlers'

export const handlers: RequestHandler[] = [
  ...receptionHandlers,
  // Un spread por línea: agrega aquí los handlers de cada feature.
]
