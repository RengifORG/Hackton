import { useEffect, useState } from 'react'

export type RemoteData<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'success'
      data: T
      /** Datos de la primera carga correcta: base para marcar lo nuevo. */
      initial: T
      lastUpdated: Date
      /** true si la última recarga falló y `data` es la anterior. */
      stale: boolean
    }

export interface RemoteDataOptions {
  /** Si llega, recarga cada `refreshMs` sin volver a "loading". */
  refreshMs?: number
}

/** Carga `load(baseUrl)`. `load` debe ser estable (función de módulo). */
export function useRemoteData<T>(
  baseUrl: string,
  load: (baseUrl: string) => Promise<T>,
  { refreshMs }: RemoteDataOptions = {},
): RemoteData<T> {
  const [state, setState] = useState<RemoteData<T>>({ status: 'loading' })

  useEffect(() => {
    let active = true
    let inFlight = false

    const run = () => {
      // Si la petición anterior sigue en curso, se salta este tick.
      if (inFlight) return
      inFlight = true
      load(baseUrl)
        .then(
          (data) => {
            if (!active) return
            setState((previous) => ({
              status: 'success',
              data,
              initial: previous.status === 'success' ? previous.initial : data,
              lastUpdated: new Date(),
              stale: false,
            }))
          },
          () => {
            if (!active) return
            setState((previous) =>
              previous.status === 'success'
                ? { ...previous, stale: true }
                : { status: 'error' },
            )
          },
        )
        .finally(() => {
          inFlight = false
        })
    }

    run()
    const timer = refreshMs ? setInterval(run, refreshMs) : undefined
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [baseUrl, load, refreshMs])

  return state
}
