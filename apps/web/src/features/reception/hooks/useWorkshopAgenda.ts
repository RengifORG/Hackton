import { useCallback, useState } from 'react'
import { env } from '@/lib/env'
import { fetchAppointments, fetchLeads } from '../api/receptionApi'
import { buildWorkshopAgenda, type WorkshopSlotGroup } from '../model/selectors'
import { useRemoteData, type RemoteData } from './useRemoteData'

// `now` se fija al cargar (no en render) para que el render sea puro.
async function loadAgenda(baseUrl: string): Promise<WorkshopSlotGroup[]> {
  const [appointments, leads] = await Promise.all([
    fetchAppointments(baseUrl, 'service'),
    fetchLeads(baseUrl),
  ])
  return buildWorkshopAgenda(appointments, leads, new Date())
}

export interface WorkshopAgenda {
  status: RemoteData<unknown>['status']
  groups: WorkshopSlotGroup[]
  isConfirmed: (appointmentId: string) => boolean
  confirmReception: (appointmentId: string) => void
}

export function useWorkshopAgenda(
  baseUrl: string = env.apiUrl,
): WorkshopAgenda {
  const state = useRemoteData(baseUrl, loadAgenda)
  // Solo estado local: el contrato no tiene endpoint de recepción.
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set())

  const confirmReception = useCallback((appointmentId: string) => {
    setConfirmed((previous) => new Set(previous).add(appointmentId))
  }, [])

  return {
    status: state.status,
    groups: state.status === 'success' ? state.data : [],
    isConfirmed: (appointmentId) => confirmed.has(appointmentId),
    confirmReception,
  }
}
