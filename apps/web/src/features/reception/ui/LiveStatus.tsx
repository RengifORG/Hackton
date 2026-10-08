import { formatClock } from '../model/selectors'

interface LiveStatusProps {
  lastUpdated: Date | undefined
  stale: boolean
}

export function LiveStatus({ lastUpdated, stale }: LiveStatusProps) {
  if (!lastUpdated) return null
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
      <p>Actualizado {formatClock(lastUpdated)}</p>
      {stale && (
        <p role="status" className="text-amber-700">
          Sin conexión, reintentando…
        </p>
      )}
    </div>
  )
}
