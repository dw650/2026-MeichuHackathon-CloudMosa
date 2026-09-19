/** Thin fetch wrapper for /api/v1 (docs/04 §4.5, §6.1): 10 s timeout, typed errors, demo headers. */

export const API_BASE = '/api/v1'
export const TIMEOUT_MS = 10_000

/** Codes from the API's error body, plus client-side ones: timeout, network, aborted. */
export type ApiErrorCode = string

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly requestId: string | undefined

  constructor(code: ApiErrorCode, status: number, requestId?: string) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

/** How the UI reacts (docs/04 §6.1): back to a picker, back home, or "connection failed". */
export type ErrorKind = 'not_found' | 'bad_request' | 'unavailable'

export function errorKind(error: unknown): ErrorKind {
  if (!(error instanceof ApiError)) return 'unavailable'
  if (error.code.endsWith('not_found')) return 'not_found'
  if (error.code === 'invalid_param') return 'bad_request'
  return 'unavailable'
}

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'invalid_param',
  404: 'not_found',
  500: 'internal',
  503: 'upstream_unavailable',
}

let extraHeaders: () => Record<string, string> = () => ({})

/** Registers extra headers for every request (the demo switches in demo builds, F18). */
export function setRequestHeaders(getter: () => Record<string, string>): void {
  extraHeaders = getter
}

export type QueryParams = Record<string, string | number | undefined | null>

export interface GetOptions {
  signal?: AbortSignal
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

function url(path: string, params: QueryParams): string {
  // Absolute so it also works outside the browser (tests); same origin in the app.
  const target = new URL(API_BASE + path, window.location.href)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) target.searchParams.set(key, String(value))
  }
  return target.toString()
}

async function errorFrom(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null)
  const error = (body as { error?: { code?: unknown; request_id?: unknown } } | null)?.error
  const code =
    typeof error?.code === 'string'
      ? error.code
      : (CODE_BY_STATUS[res.status] ?? (res.status >= 500 ? 'internal' : 'http_error'))
  const requestId = typeof error?.request_id === 'string' ? error.request_id : undefined
  return new ApiError(code, res.status, requestId)
}

export async function apiGet<T>(
  path: string,
  params: QueryParams = {},
  options: GetOptions = {},
): Promise<T> {
  const { signal, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = options
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel)
  try {
    const res = await fetchImpl(url(path, params), {
      headers: { Accept: 'application/json', ...extraHeaders() },
      signal: controller.signal,
    })
    if (!res.ok) throw await errorFrom(res)
    return (await res.json()) as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (timedOut) throw new ApiError('timeout', 0)
    if (controller.signal.aborted) throw new ApiError('aborted', 0)
    throw new ApiError('network', 0)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
