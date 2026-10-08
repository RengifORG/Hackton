import { useEffect, useState } from 'react'
import { api } from '@/lib/api/client'
import type { Model } from '@/lib/api/types'

export type UseModelResult =
  | { status: 'loading' }
  | { status: 'ready'; model: Model }
  | { status: 'error' }

type Settled = { modelId: string } & Exclude<
  UseModelResult,
  { status: 'loading' }
>

export function useModel(modelId: string): UseModelResult {
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    let active = true
    api.getModel(modelId).then(
      (model) => {
        if (active) setSettled({ modelId, status: 'ready', model })
      },
      () => {
        if (active) setSettled({ modelId, status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [modelId])

  // Mientras llega el id nuevo, el resultado anterior no aplica.
  if (!settled || settled.modelId !== modelId) return { status: 'loading' }
  return settled
}
