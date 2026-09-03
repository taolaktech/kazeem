import type { TradeDecisionResponse } from '@/types/trade-decision'

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const REQUEST_TIMEOUT_MS = 30_000

export class ApiError extends Error {
  readonly status: number | null
  readonly detail: unknown

  constructor(message: string, status: number | null, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** User-facing copy per transport/HTTP failure; details stay in the console. */
function messageForStatus(status: number, symbol: string): string {
  switch (status) {
    case 400:
      return `The request for ${symbol} was rejected. Check the symbol and max budget.`
    case 401:
    case 403:
      return 'Market data provider rejected the request.'
    case 404:
      return `No market data is available for ${symbol}.`
    case 422:
      return `Not enough market data to evaluate ${symbol} yet.`
    case 429:
      return 'Rate limit reached. Try again shortly.'
    case 503:
      return 'Market data provider is not configured or unavailable.'
    default:
      return status >= 500
        ? `Unable to retrieve ${symbol} decision.`
        : `Unexpected response (${status}) for ${symbol}.`
  }
}

export async function getTradeDecision(
  symbol: string,
  maxBudget: number,
  signal?: AbortSignal,
): Promise<TradeDecisionResponse> {
  const normalized = symbol.trim().toUpperCase()
  const url = `${API_BASE_URL}/trade-decision/${encodeURIComponent(normalized)}?maxBudget=${maxBudget}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      const detail: unknown = await response.json().catch(() => undefined)
      console.error('trade-decision request failed', response.status, detail)
      throw new ApiError(messageForStatus(response.status, normalized), response.status, detail)
    }

    return (await response.json()) as TradeDecisionResponse
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('trade-decision request error', error)
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        signal?.aborted ? 'Request cancelled.' : 'The request timed out. Try again.',
        null,
        error,
      )
    }
    throw new ApiError(
      `Unable to reach the API at ${API_BASE_URL}. Is the backend running?`,
      null,
      error,
    )
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

export { API_BASE_URL }
