import { HttpResponse } from 'msw'
import type { z } from 'zod'

// Lee el body sin lanzar: un JSON inválido llega como undefined y falla en zod.
export async function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined)
}

// 422 con la forma de FastAPI: { detail: [{ loc, msg }] }.
export function validationError(error: z.ZodError) {
  return HttpResponse.json(
    {
      detail: error.issues.map((issue) => ({
        loc: ['body', ...issue.path.map(String)],
        msg: issue.message,
      })),
    },
    { status: 422 },
  )
}
