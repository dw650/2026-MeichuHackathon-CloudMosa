import { keepPreviousData, QueryClient } from '@tanstack/react-query'

import { ApiError } from './client'

/** One retry for connection problems; never for timeouts (the 10 s limit must hold) or 4xx. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  if (!(error instanceof ApiError)) return true
  if (error.code === 'timeout' || error.code === 'aborted') return false
  return error.status === 0 || error.status >= 500
}

/** Query defaults (docs/04 §4.5): 5 min fresh, keep old data, no polling or focus refetch. */
export function createQueryClient(overrides: { retry?: false } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: overrides.retry ?? shouldRetry,
        retryDelay: 1000,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
      },
    },
  })
}
