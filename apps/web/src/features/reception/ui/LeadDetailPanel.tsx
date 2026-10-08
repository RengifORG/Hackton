import { crmStatusLabel } from '../model/labels'
import {
  describeAppointment,
  formatModelId,
  type AdvisorRow,
} from '../model/selectors'

interface LeadDetailPanelProps {
  row: AdvisorRow
  onClose: () => void
}

export function LeadDetailPanel({ row, onClose }: LeadDetailPanelProps) {
  const { lead, appointment } = row
  const models = lead.recommendedModels ?? []

  return (
    <aside
      aria-label="Detalle del lead"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{lead.name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 focus:outline-2 focus:outline-sky-600"
        >
          Cerrar
        </button>
      </div>

      <dl className="mt-4 space-y-4 text-sm">
        <div>
          <dt className="font-medium text-slate-700">Modelos recomendados</dt>
          <dd className="mt-1">
            {models.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {models.map((modelId) => (
                  <li
                    key={modelId}
                    className="rounded bg-slate-100 px-2 py-0.5 text-slate-800"
                  >
                    {formatModelId(modelId)}
                  </li>
                ))}
              </ul>
            ) : (
              'Sin recomendaciones'
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Resumen del chat</dt>
          <dd className="mt-1 text-slate-800">{lead.interest ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Estado CRM</dt>
          <dd className="mt-1 text-slate-800">
            {crmStatusLabel(lead.crmStatus)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Cita</dt>
          <dd className="mt-1 text-slate-800">
            {describeAppointment(appointment)}
          </dd>
        </div>
      </dl>

      <a
        href={`#hubspot/${encodeURIComponent(lead.id)}`}
        className="mt-4 inline-block text-sm font-medium text-sky-700 underline hover:text-sky-900"
      >
        Ver en HubSpot (simulado)
      </a>
    </aside>
  )
}
