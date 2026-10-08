import { http, HttpResponse } from 'msw'
import { isAfterHours } from '@/features/reception/model/afterHours'
import { LeadCreateSchema } from '@/lib/api/schemas'
import type { Lead } from '@/lib/api/types'
import { env } from '@/lib/env'
import { readJsonBody, validationError } from '../validation'

export const leadHandlers = [
  http.post(`${env.apiUrl}/leads`, async ({ request }) => {
    const parsed = LeadCreateSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) return validationError(parsed.error)

    const createdAt = new Date().toISOString()
    const lead: Lead = {
      ...parsed.data,
      id: crypto.randomUUID(),
      createdAt,
      afterHours: isAfterHours(createdAt),
      crmStatus: 'pending',
    }
    return HttpResponse.json(lead, { status: 201 })
  }),
]
