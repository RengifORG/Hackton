import { http, HttpResponse, type RequestHandler } from 'msw'
import { AppointmentTypeSchema } from '@/features/reception/model/schemas'
import { env } from '@/lib/env'
import { buildAppointments, buildLeads } from './fixtures'

// Rutas absolutas contra env.apiUrl, sin comodines (guarda en client.assistant.test.ts).
export const receptionHandlers: RequestHandler[] = [
  http.get(`${env.apiUrl}/leads`, () =>
    HttpResponse.json(buildLeads(new Date())),
  ),

  http.get(`${env.apiUrl}/appointments`, ({ request }) => {
    const appointments = buildAppointments(new Date())
    const type = new URL(request.url).searchParams.get('type')
    if (type === null) return HttpResponse.json(appointments)

    const parsed = AppointmentTypeSchema.safeParse(type)
    if (!parsed.success) return new HttpResponse(null, { status: 422 })

    return HttpResponse.json(
      appointments.filter((appointment) => appointment.type === parsed.data),
    )
  }),
]
