import { useMemo, useState } from 'react'
import { env } from '@/lib/env'
import { fetchAppointments, fetchLeads } from '../api/receptionApi'
import {
  buildAdvisorKpis,
  buildAdvisorRows,
  markNewIds,
  type AdvisorKpis,
  type AdvisorRow,
} from '../model/selectors'
import { useRemoteData, type RemoteData } from './useRemoteData'

async function loadInbox(baseUrl: string) {
  const [leads, appointments] = await Promise.all([
    fetchLeads(baseUrl),
    fetchAppointments(baseUrl),
  ])
  // `now` se fija al cargar (no en render) para que el render sea puro.
  return { leads, appointments, now: new Date() }
}

export interface AdvisorInboxRow extends AdvisorRow {
  /** Apareció después de la primera carga. */
  isNew: boolean
}

export interface AdvisorInbox {
  status: RemoteData<unknown>['status']
  kpis: AdvisorKpis | undefined
  rows: AdvisorInboxRow[]
  selected: AdvisorInboxRow | undefined
  select: (leadId: string | null) => void
  lastUpdated: Date | undefined
  stale: boolean
}

interface AdvisorInboxOptions {
  baseUrl?: string
  refreshMs?: number
}

export function useAdvisorInbox({
  baseUrl = env.apiUrl,
  refreshMs,
}: AdvisorInboxOptions = {}): AdvisorInbox {
  const state = useRemoteData(baseUrl, loadInbox, { refreshMs })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const success = state.status === 'success' ? state : undefined
  const data = success?.data
  const initial = success?.initial

  const kpis = useMemo(
    () => data && buildAdvisorKpis(data.leads, data.appointments),
    [data],
  )
  const rows = useMemo(() => {
    if (!data || !initial) return []
    const newIds = markNewIds(
      initial === data ? null : initial.leads.map((lead) => lead.id),
      data.leads.map((lead) => lead.id),
    )
    return buildAdvisorRows(data.leads, data.appointments, data.now).map(
      (row) => ({
        ...row,
        isNew: newIds.has(row.lead.id),
      }),
    )
  }, [data, initial])
  const selected = rows.find((row) => row.lead.id === selectedId)

  return {
    status: state.status,
    kpis,
    rows,
    selected,
    select: setSelectedId,
    lastUpdated: success?.lastUpdated,
    stale: success?.stale ?? false,
  }
}
