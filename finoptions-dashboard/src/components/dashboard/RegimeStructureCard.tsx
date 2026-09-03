import { CheckCircle2, TriangleAlert } from 'lucide-react'

import { Field, FieldGrid } from '@/components/dashboard/Field'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatEnum, formatInteger, formatPercent, formatPrice, formatScore } from '@/lib/formatters'
import type { ComponentScore, MarketContext } from '@/types/trade-decision'

interface RegimeStructureCardProps {
  context: MarketContext
  score: ComponentScore | undefined
}

/** The most detailed evidence card: regime plus every structural reference. */
export function RegimeStructureCard({ context, score }: RegimeStructureCardProps) {
  const openingRange = context.openingRange
  const price = context.currentPrice
  const relation = (level: number | null): string => {
    if (typeof level !== 'number') return 'unknown'
    return price >= level ? 'above' : 'below'
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <CardTitle>Regime &amp; Structure</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{formatEnum(context.regime)}</Badge>
            {score ? (
              <span className="tabular text-xs text-muted-foreground">
                {score.earned === null ? 'unavailable' : formatScore(score.earned, 0)} /{' '}
                {formatScore(score.available, 0)}
              </span>
            ) : null}
          </div>
        </div>

        <FieldGrid>
          <Field label="Primary Regime" value={formatEnum(context.regime)} />
          <Field label="Regime Confidence" value={formatPercent(context.regimeConfidence)} />
          <Field label="Trend Direction" value={formatEnum(context.trendDirection)} />
          <Field label="Trend Strength" value={formatEnum(context.trendStrength)} />
          <Field label="Signal Alignment" value={formatEnum(context.signal)} />
          <Field label="Session Maturity" value={formatEnum(context.sessionMaturity)} />
        </FieldGrid>

        <Separator className="my-3" />

        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Structural References
        </div>
        <FieldGrid>
          <Field
            label="Opening Range"
            value={`${formatEnum(openingRange.currentPricePosition)} (${formatPrice(openingRange.low)} – ${formatPrice(openingRange.high)})`}
          />
          <Field label="Breakout Strength" value={formatEnum(openingRange.breakoutStrength)} />
          <Field
            label="Premarket High"
            value={`${formatPrice(context.premarketHigh)} · price ${relation(context.premarketHigh)}`}
          />
          <Field
            label="Premarket Low"
            value={`${formatPrice(context.premarketLow)} · price ${relation(context.premarketLow)}`}
          />
          <Field
            label="Session High"
            value={`${formatPrice(context.sessionHigh)} · price ${relation(context.sessionHigh)}`}
          />
          <Field
            label="Session Low"
            value={`${formatPrice(context.sessionLow)} · price ${relation(context.sessionLow)}`}
          />
          <Field label="Session Position" value={formatPercent(context.sessionPositionInRange)} />
          <Field
            label="Analysis Window Candles"
            value={formatInteger(context.analysisWindow.candleCount)}
          />
        </FieldGrid>

        {score && (score.confirmations?.length || score.conflicts?.length || score.riskFlags?.length) ? (
          <div className="mt-3 space-y-1.5 border-t border-border pt-3">
            {score.confirmations?.map((item) => (
              <div key={item} className="flex gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bull" />
                <span>{item}</span>
              </div>
            ))}
            {score.conflicts?.map((conflict) => (
              <div key={conflict.code} className="flex gap-2 text-xs text-muted-foreground">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                <span>{conflict.description}</span>
              </div>
            ))}
            {score.riskFlags?.map((flag) => (
              <div key={flag} className="flex gap-2 text-xs text-warn">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{flag}</span>
              </div>
            ))}
          </div>
        ) : null}

        {score?.reason ? (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Component reason: {formatEnum(score.reason)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
