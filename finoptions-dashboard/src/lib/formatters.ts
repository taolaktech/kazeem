export const EM_DASH = '\u2014'

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function formatPrice(value: number | null | undefined): string {
  return isNumber(value) ? priceFormatter.format(value) : EM_DASH
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  return isNumber(value)
    ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : EM_DASH
}

export function formatInteger(value: number | null | undefined): string {
  return isNumber(value) ? value.toLocaleString('en-US') : EM_DASH
}

/** `0.62` renders as `62%`; already-scaled percents use {@link formatPercentPoints}. */
export function formatPercent(value: number | null | undefined, digits = 0): string {
  return isNumber(value) ? `${(value * 100).toFixed(digits)}%` : EM_DASH
}

/** For backend fields already expressed in percentage points, e.g. `0.5346`. */
export function formatPercentPoints(value: number | null | undefined, digits = 2): string {
  return isNumber(value) ? `${value.toFixed(digits)}%` : EM_DASH
}

export function formatCompact(value: number | null | undefined): string {
  if (!isNumber(value)) return EM_DASH
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(
    value,
  )
}

export function formatGreek(value: number | null | undefined): string {
  return isNumber(value) ? value.toFixed(4) : EM_DASH
}

export function formatScore(value: number | null | undefined, digits = 2): string {
  return isNumber(value) ? value.toFixed(digits) : EM_DASH
}

/** Backend dates are ISO strings; the browser timezone is never assumed. */
export function formatEasternDate(iso: string | null | undefined): string {
  if (!iso) return EM_DASH
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? EM_DASH : dateFormatter.format(date)
}

export function formatEasternTime(iso: string | null | undefined): string {
  if (!iso) return EM_DASH
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? EM_DASH : `${timeFormatter.format(date)} ET`
}

export function formatExpiration(iso: string | null | undefined): string {
  if (!iso) return EM_DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return EM_DASH
  return date.toISOString().slice(0, 10)
}

export function formatEnum(value: string | null | undefined): string {
  return value ? value.replaceAll('_', ' ') : EM_DASH
}

export function formatBoolean(value: boolean | null | undefined): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return EM_DASH
}
