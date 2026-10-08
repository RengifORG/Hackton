import { KpiCard, Table, type Column } from '@/components/ui'
import { useAdvisorInbox } from '@/features/reception/hooks/useAdvisorInbox'
import { SOURCE_LABELS } from '@/features/reception/model/labels'
import {
  describeAppointment,
  formatModelId,
  type AdvisorRow,
} from '@/features/reception/model/selectors'
import { AfterHoursBadge } from '@/features/reception/ui/AfterHoursBadge'
import { LeadDetailPanel } from '@/features/reception/ui/LeadDetailPanel'

const COLUMNS: Column<AdvisorRow>[] = [
  {
    key: 'name',
    header: 'Nombre',
    render: ({ lead }) => <span className="font-medium">{lead.name}</span>,
  },
  {
    key: 'phone',
    header: 'Teléfono',
    // phoneMasked se muestra tal cual: la API ya lo entrega enmascarado.
    render: ({ lead }) => (
      <span className="font-mono whitespace-nowrap">{lead.phoneMasked}</span>
    ),
  },
  {
    key: 'interest',
    header: 'Interés',
    render: ({ lead }) => (
      <span className="line-clamp-2 max-w-xs">{lead.interest ?? '—'}</span>
    ),
  },
  {
    key: 'models',
    header: 'Modelos recomendados',
    render: ({ lead }) =>
      lead.recommendedModels?.map(formatModelId).join(', ') || '—',
  },
  {
    key: 'source',
    header: 'Origen',
    render: ({ lead }) => SOURCE_LABELS[lead.source],
  },
  {
    key: 'afterHours',
    header: 'Horario',
    render: ({ lead }) => <AfterHoursBadge afterHours={lead.afterHours} />,
  },
  {
    key: 'appointment',
    header: 'Cita',
    render: ({ appointment }) => (
      <span className="whitespace-nowrap">
        {describeAppointment(appointment)}
      </span>
    ),
  },
]

export function AsesorPage() {
  const { status, kpis, rows, selected, select } = useAdvisorInbox()

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Bandeja del asesor</h1>

      {status === 'loading' && (
        <p role="status" className="text-slate-600">
          Cargando bandeja…
        </p>
      )}

      {status === 'error' && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
        >
          No se pudo cargar la bandeja. Intenta de nuevo más tarde.
        </p>
      )}

      {status === 'success' && kpis && (
        <>
          <section
            aria-label="Indicadores"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <KpiCard label="Leads en bandeja" value={kpis.leadsInInbox} />
            <KpiCard label="Fuera de horario" value={kpis.afterHours} />
            <KpiCard label="Citas test drive" value={kpis.testDrives} />
            <KpiCard label="Pendientes en CRM" value={kpis.crmPending} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Table
              caption="Leads en bandeja"
              columns={COLUMNS}
              rows={rows}
              getRowKey={(row) => row.lead.id}
              onRowClick={(row) => select(row.lead.id)}
              isRowSelected={(row) => row.lead.id === selected?.lead.id}
            />
            {selected && (
              <LeadDetailPanel row={selected} onClose={() => select(null)} />
            )}
          </div>
        </>
      )}
    </main>
  )
}
