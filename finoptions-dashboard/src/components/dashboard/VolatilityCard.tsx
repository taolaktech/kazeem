import { Field, FieldGrid } from '@/components/dashboard/Field'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatEnum, formatNumber, formatPercentPoints, formatScore } from '@/lib/formatters'
import type { VolatilityContext } from '@/types/trade-decision'

interface VolatilityCardProps {
  volatility: VolatilityContext
  marketContextVolatility: string
  missingIntelligence: string[]
}

export function VolatilityCard({
  volatility,
  marketContextVolatility,
  missingIntelligence,
}: VolatilityCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <CardTitle>Volatility</CardTitle>
          <Badge variant="outline">{volatility.volatilitySymbol}</Badge>
        </div>

        <Field label="Market Context Volatility" value={formatEnum(marketContextVolatility)} />

        <Separator className="my-2" />

        {volatility.available ? (
          <FieldGrid>
            <Field label="VIX" value={formatNumber(volatility.vix)} />
            <Field label="Previous Close" value={formatNumber(volatility.previousClose)} />
            <Field label="Change" value={formatNumber(volatility.change)} />
            <Field label="Change %" value={formatPercentPoints(volatility.changePercent)} />
            <Field label="State" value={formatEnum(volatility.state)} />
            <Field label="Trend" value={formatEnum(volatility.trend)} />
            <Field label="Momentum" value={formatEnum(volatility.momentum)} />
            <Field label="Signal Alignment" value={formatEnum(volatility.signalAlignment)} />
            <Field
              label="Pressure Score"
              value={formatScore(volatility.volatilityPressureScore)}
            />
          </FieldGrid>
        ) : (
          <div className="py-4 text-center">
            <div className="text-sm font-medium text-muted-foreground">VIX unavailable</div>
            {missingIntelligence.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {missingIntelligence.map((item) => (
                  <li key={item} className="text-xs text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
