import { Field, FieldGrid } from '@/components/dashboard/Field'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatEnum, formatInteger, formatPercent, formatPrice } from '@/lib/formatters'
import type { MarketContext } from '@/types/trade-decision'

export function MarketContextCard({ context }: { context: MarketContext }) {
  const window = context.analysisWindow

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <CardTitle>Market Context</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{formatEnum(context.marketSession)}</Badge>
            <Badge variant="outline">{formatEnum(context.sessionMaturity)}</Badge>
            <Badge variant="outline">Volatility {formatEnum(context.volatility)}</Badge>
          </div>
        </div>

        <div className="tabular mt-3 text-3xl font-bold">{formatPrice(context.currentPrice)}</div>

        <Separator className="my-3" />

        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Full Session
        </div>
        <FieldGrid>
          <Field label="Session Open" value={formatPrice(context.sessionOpen)} />
          <Field label="Session High" value={formatPrice(context.sessionHigh)} />
          <Field label="Session Low" value={formatPrice(context.sessionLow)} />
          <Field label="Position in Range" value={formatPercent(context.sessionPositionInRange)} />
          <Field
            label="Total Session Candles (info)"
            value={formatInteger(context.totalSessionCandleCount)}
          />
        </FieldGrid>

        <Separator className="my-3" />

        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {context.timeframeMinutes}-Minute Analysis Window
        </div>
        <FieldGrid>
          <Field label="Window Open" value={formatPrice(window.open)} />
          <Field label="Window High" value={formatPrice(window.high)} />
          <Field label="Window Low" value={formatPrice(window.low)} />
          <Field label="Window Close" value={formatPrice(window.close)} />
          <Field label="Position in Range" value={formatPercent(window.positionInRange)} />
          <Field label="Candle Count" value={formatInteger(window.candleCount)} />
        </FieldGrid>

        <Separator className="my-3" />

        <FieldGrid>
          <Field label="Regime" value={formatEnum(context.regime)} />
          <Field label="Regime Confidence" value={formatPercent(context.regimeConfidence)} />
          <Field label="Trend Direction" value={formatEnum(context.trendDirection)} />
          <Field label="Trend Strength" value={formatEnum(context.trendStrength)} />
          <Field label="Signal" value={formatEnum(context.signal)} />
          <Field label="Signal Confidence" value={formatPercent(context.signalConfidence)} />
        </FieldGrid>
      </CardContent>
    </Card>
  )
}
