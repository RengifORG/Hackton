import { useWorkshopAgenda } from '@/features/reception/hooks/useWorkshopAgenda'
import { LiveStatus } from '@/features/reception/ui/LiveStatus'
import { WorkshopAppointmentCard } from '@/features/reception/ui/WorkshopAppointmentCard'

const REFRESH_MS = 5000

export function TallerPage() {
  const { status, groups, isConfirmed, confirmReception, lastUpdated, stale } =
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

      {status === 'success' && groups.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-600">
          Sin citas de taller hoy
        </p>
      )}

      {groups.map((group) => (
        <section key={group.label} aria-label={`Franja ${group.label}`}>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">
            {group.label}
          </h2>
          <div className="space-y-3">
            {group.items.map((item) => (
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
    </main>
  )
}
