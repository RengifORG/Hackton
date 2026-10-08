import { useWorkshopAgenda } from '@/features/reception/hooks/useWorkshopAgenda'
import { LiveStatus } from '@/features/reception/ui/LiveStatus'
import { WorkshopAppointmentCard } from '@/features/reception/ui/WorkshopAppointmentCard'

const REFRESH_MS = 5000

export function TallerPage() {
  const { status, days, isConfirmed, confirmReception, lastUpdated, stale } =
    useWorkshopAgenda({ refreshMs: REFRESH_MS })

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Agenda del taller</h1>
        <LiveStatus lastUpdated={lastUpdated} stale={stale} />
      </div>

      {status === 'loading' && (
        <p role="status" className="text-slate-600">
          Cargando agenda…
        </p>
      )}

      {status === 'error' && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
        >
          No se pudo cargar la agenda. Intenta de nuevo más tarde.
        </p>
      )}

      {status === 'success' && days.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-600">
          Sin citas de taller en los próximos 7 días
        </p>
      )}

      {days.map((day) => (
        <section key={day.date} aria-label={day.label} className="space-y-4">
          <h2 className="border-b border-slate-200 pb-1 text-xl font-bold text-slate-900">
            {day.label}
          </h2>
          {day.slots.map((slot) => (
            <section key={slot.label} aria-label={`Franja ${slot.label}`}>
              <h3 className="mb-2 text-lg font-semibold text-slate-800">
                {slot.label}
              </h3>
              <div className="space-y-3">
                {slot.items.map((item) => (
                  <WorkshopAppointmentCard
                    key={item.id}
                    item={item}
                    isNew={item.isNew}
                    confirmed={isConfirmed(item.id)}
                    onConfirm={confirmReception}
                  />
                ))}
              </div>
            </section>
          ))}
        </section>
      ))}
    </main>
  )
}
