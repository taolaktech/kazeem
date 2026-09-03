import { Field, FieldGrid } from '@/components/dashboard/Field'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import {
  formatBoolean,
  formatCompact,
  formatEnum,
  formatInteger,
  formatNumber,
  formatPercentPoints,
  formatPrice,
} from '@/lib/formatters'
import type { OpeningRange } from '@/types/trade-decision'

function positionVariant(position: OpeningRange['currentPricePosition']) {
  if (position === 'ABOVE') return 'bull' as const
  if (position === 'BELOW') return 'bear' as const
  if (position === 'INSIDE') return 'neutral' as const
  return 'outline' as const
}

export function OpeningRangeChart({ openingRange }: { openingRange: OpeningRange }) {
  const { high, low, currentPrice } = openingRange
  const plottable =
    typeof high === 'number' && typeof low === 'number' && typeof currentPrice === 'number' && high > low

  // Price is drawn on a padded scale so an out-of-range price stays visible.
  let markerPercent: number | null = null
  if (plottable) {
    const padding = (high - low) * 0.35
    const min = Math.min(low - padding, currentPrice)
    const max = Math.max(high + padding, currentPrice)
    markerPercent = ((currentPrice - min) / (max - min)) * 100
  }
  const rangeStart = plottable ? 35 : 0
  const rangeWidth = plottable ? 30 : 0

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <CardTitle>Opening Range {openingRange.startTime}–{openingRange.endTime} ET</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{formatEnum(openingRange.status)}</Badge>
            <Badge variant={positionVariant(openingRange.currentPricePosition)}>
              {formatEnum(openingRange.currentPricePosition)}
            </Badge>
          </div>
        </div>

        {openingRange.available ? (
          <>
            {plottable ? (
              <div className="mt-5">
                <div className="relative h-16">
                  <div className="absolute left-0 right-0 top-7 h-1.5 rounded-full bg-secondary" />
                  <div
                    className="absolute top-7 h-1.5 rounded-full bg-primary/40"
                    style={{ left: `${rangeStart}%`, width: `${rangeWidth}%` }}
                  />
                  <RangeTick label="ORL" value={low} left={rangeStart} />
                  <RangeTick label="ORH" value={high} left={rangeStart + rangeWidth} />
                  <div
                    className="absolute top-4 -translate-x-1/2"
                    style={{ left: `${Math.max(2, Math.min(98, markerPercent ?? 50))}%` }}
                  >
                    <div className="h-8 w-0.5 bg-warn" />
                    <div className="tabular mt-1 whitespace-nowrap text-[11px] font-semibold text-warn">
                      {formatPrice(currentPrice)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <FieldGrid>
              <Field label="OR Open" value={formatPrice(openingRange.open)} />
              <Field label="OR Close" value={formatPrice(openingRange.close)} />
              <Field label="OR High" value={formatPrice(openingRange.high)} />
              <Field label="OR Low" value={formatPrice(openingRange.low)} />
              <Field label="Current Price" value={formatPrice(openingRange.currentPrice)} />
              <Field label="Range" value={`${formatNumber(openingRange.range)} (${formatPercentPoints(openingRange.rangePercent)})`} />
              <Field label="Breakout Above" value={formatBoolean(openingRange.breakoutAbove)} />
              <Field label="Breakdown Below" value={formatBoolean(openingRange.breakdownBelow)} />
              <Field label="Breakout Strength" value={formatEnum(openingRange.breakoutStrength)} />
              <Field label="Volume Confirmation" value={formatEnum(openingRange.volumeConfirmation)} />
              <Field label="Closes Above High" value={formatInteger(openingRange.closesAboveHigh)} />
              <Field label="Closes Below Low" value={formatInteger(openingRange.closesBelowLow)} />
              <Field label="Failed Breakout" value={formatBoolean(openingRange.failedBreakoutAbove)} />
              <Field label="Failed Breakdown" value={formatBoolean(openingRange.failedBreakdownBelow)} />
              <Field label="Distance from High" value={formatPercentPoints(openingRange.distanceFromHighPercent)} />
              <Field label="Distance from Low" value={formatPercentPoints(openingRange.distanceFromLowPercent)} />
              <Field label="Relative Breakout Volume" value={formatNumber(openingRange.relativeBreakoutVolume)} />
              <Field label="OR Volume" value={formatCompact(openingRange.volume)} />
              <Field
                label="OR Candles"
                value={`${formatInteger(openingRange.candleCount)} / ${formatInteger(openingRange.expectedCandleCount)}`}
              />
              <Field
                label="Post-range candles (info)"
                value={formatInteger(openingRange.totalPostRangeCandleCount)}
              />
            </FieldGrid>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Opening range unavailable</p>
        )}
      </CardContent>
    </Card>
  )
}

function RangeTick({ label, value, left }: { label: string; value: number; left: number }) {
  return (
    <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${left}%` }}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="tabular text-[11px] font-semibold">{formatPrice(value)}</div>
    </div>
  )
}
