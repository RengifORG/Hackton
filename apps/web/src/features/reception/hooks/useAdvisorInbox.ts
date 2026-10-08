import { useMemo, useState } from 'react'
import { env } from '@/lib/env'
import { fetchAppointments, fetchLeads } from '../api/receptionApi'
import {
  buildAdvisorKpis,
  buildAdvisorRows,
  type AdvisorKpis,
  type AdvisorRow,
} from '../model/selectors'
import { useRemoteData, type RemoteData } from './useRemoteData'

async function loadInbox(baseUrl: string) {
  const [leads, appointments] = await Promise.all([
    fetchLeads(baseUrl),
    fetchAppointments(baseUrl),
  ])
  return { leads, appointments }
}

export interface AdvisorInbox {
  status: RemoteData<unknown>['status']
  kpis: AdvisorKpis | undefined
  rows: AdvisorRow[]
  selected: AdvisorRow | undefined
  select: (leadId: string | null) => void
}

export function useAdvisorInbox(baseUrl: string = env.apiUrl): AdvisorInbox {
  const state = useRemoteData(baseUrl, loadInbox)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const data = state.status === 'success' ? state.data : undefined

  const kpis = useMemo(
    () => data && buildAdvisorKpis(data.leads, data.appointments),
    [data],
  )
  const rows = useMemo(
    () => (data ? buildAdvisorRows(data.leads, data.appointments) : []),
    [data],
  )
  const selected = rows.find((row) => row.lead.id === selectedId)

  return { status: state.status, kpis, rows, selected, select: setSelectedId }
}
