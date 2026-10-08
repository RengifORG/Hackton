import { useId } from 'react'
import { Badge } from '@/components/ui'
import type { WorkshopAgendaItem } from '../model/selectors'
import { AfterHoursBadge } from './AfterHoursBadge'

interface WorkshopAppointmentCardProps {
  item: WorkshopAgendaItem
  isNew?: boolean
  confirmed: boolean
  onConfirm: (appointmentId: string) => void
}

export function WorkshopAppointmentCard({
  item,
  isNew = false,
  confirmed,
  onConfirm,
}: WorkshopAppointmentCardProps) {
  const titleId = useId()

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 id={titleId} className="font-semibold text-slate-900">
          {item.leadName}
        </h4>
        {isNew && <Badge variant="success">Nuevo</Badge>}
        <AfterHoursBadge afterHours={item.afterHours} />
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-600">Teléfono</dt>
          <dd className="font-mono">{item.phoneMasked}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Vehículo</dt>
          <dd>{item.model}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Placa</dt>
          <dd className="font-mono">{item.plate}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Motivo</dt>
          <dd>{item.reason}</dd>
        </div>
      </dl>

      {item.loyaltyNote && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-emerald-900">
          <Badge variant="success">Beneficio SmartClub</Badge>
          <span>{item.loyaltyNote}</span>
        </p>
      )}

      <button
        type="button"
        disabled={confirmed}
        onClick={() => onConfirm(item.id)}
        className="mt-4 rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 focus:outline-2 focus:outline-offset-2 focus:outline-sky-600 disabled:cursor-not-allowed disabled:bg-emerald-700"
      >
        {confirmed ? 'Recepción confirmada' : 'Confirmar recepción'}
      </button>
    </article>
  )
}
