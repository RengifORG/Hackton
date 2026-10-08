import { useCallback, useMemo, useState } from 'react'
import { env } from '@/lib/env'
import { fetchAppointments, fetchLeads } from '../api/receptionApi'
import {
  buildWorkshopAgenda,
  markNewIds,
  type WorkshopAgendaItem,
  type WorkshopDayGroup,
} from '../model/selectors'
import { useRemoteData, type RemoteData } from './useRemoteData'

// `now` se fija al cargar (no en render) para que el render sea puro.
async function loadAgenda(baseUrl: string): Promise<WorkshopDayGroup[]> {
  const [appointments, leads] = await Promise.all([
    fetchAppointments(baseUrl, 'service'),
    fetchLeads(baseUrl),
  ])
  return buildWorkshopAgenda(appointments, leads, new Date())
}

function itemIds(days: readonly WorkshopDayGroup[]): string[] {
  return days.flatMap((day) =>
    day.slots.flatMap((slot) => slot.items.map((item) => item.id)),
  )
}

export interface WorkshopAgendaLiveItem extends WorkshopAgendaItem {
  /** Apareció después de la primera carga. */
  isNew: boolean
}

export interface WorkshopAgendaLiveSlot {
  label: string
  items: WorkshopAgendaLiveItem[]
}

export interface WorkshopAgendaLiveDay {
  date: string
  label: string
  slots: WorkshopAgendaLiveSlot[]
}

export interface WorkshopAgenda {
  status: RemoteData<unknown>['status']
  days: WorkshopAgendaLiveDay[]
  isConfirmed: (appointmentId: string) => boolean
  confirmReception: (appointmentId: string) => void
  lastUpdated: Date | undefined
  stale: boolean
}

interface WorkshopAgendaOptions {
  baseUrl?: string
  refreshMs?: number
}

export function useWorkshopAgenda({
  baseUrl = env.apiUrl,
  refreshMs,
}: WorkshopAgendaOptions = {}): WorkshopAgenda {
  const state = useRemoteData(baseUrl, loadAgenda, { refreshMs })
  // Solo estado local por id: sobrevive a las recargas. El contrato no tiene endpoint de recepción.
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set())
  const success = state.status === 'success' ? state : undefined
  const data = success?.data
  const initial = success?.initial

  const days = useMemo(() => {
    if (!data || !initial) return []
    const newIds = markNewIds(
      initial === data ? null : itemIds(initial),
      itemIds(data),
    )
    return data.map((day) => ({
      date: day.date,
      label: day.label,
      slots: day.slots.map((slot) => ({
        label: slot.label,
        items: slot.items.map((item) => ({
          ...item,
          isNew: newIds.has(item.id),
        })),
      })),
    }))
  }, [data, initial])

  const confirmReception = useCallback((appointmentId: string) => {
    setConfirmed((previous) => new Set(previous).add(appointmentId))
  }, [])

  return {
    status: state.status,
    days,
    isConfirmed: (appointmentId) => confirmed.has(appointmentId),
    confirmReception,
    lastUpdated: success?.lastUpdated,
    stale: success?.stale ?? false,
  }
}
