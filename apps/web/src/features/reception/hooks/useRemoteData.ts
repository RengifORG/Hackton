import { useEffect, useState } from 'react'

export type RemoteData<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'success'; data: T }

/** Carga `load(baseUrl)`. `load` debe ser estable (función de módulo). */
export function useRemoteData<T>(
  baseUrl: string,
  load: (baseUrl: string) => Promise<T>,
): RemoteData<T> {
  const [state, setState] = useState<RemoteData<T>>({ status: 'loading' })

  useEffect(() => {
    let active = true
    load(baseUrl).then(
      (data) => {
        if (active) setState({ status: 'success', data })
      },
      () => {
        if (active) setState({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [baseUrl, load])

  return state
}
