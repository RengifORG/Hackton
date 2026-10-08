import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { receptionHandlers } from '@/mocks/reception/handlers'
import { fetchLeads } from '../api/receptionApi'
import { useRemoteData } from './useRemoteData'

const API = 'http://localhost:8000'
const server = setupServer(...receptionHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => {
  vi.useRealTimers()
  server.resetHandlers()
})
afterAll(() => server.close())

describe('useRemoteData con refreshMs', () => {
  it('si la recarga responde 500 conserva los datos y marca stale', async () => {
    const { result } = renderHook(() =>
      useRemoteData(API, fetchLeads, { refreshMs: 5000 }),
    )
    await waitFor(() => expect(result.current.status).toBe('success'))
    const first = result.current
    if (first.status !== 'success') throw new Error('sin datos')
    expect(first.stale).toBe(false)
    expect(first.data).toHaveLength(8)

    server.use(
      http.get('*/leads', () => new HttpResponse(null, { status: 500 })),
    )
    await act(() => vi.advanceTimersByTimeAsync(5000))

    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'success', stale: true }),
    )
    const after = result.current
    if (after.status !== 'success') throw new Error('sin datos')
    expect(after.data).toBe(first.data)
    expect(after.lastUpdated).toBe(first.lastUpdated)
  })
})
