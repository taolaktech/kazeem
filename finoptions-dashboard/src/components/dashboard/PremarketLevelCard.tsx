import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react'

import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { EM_DASH, formatPercentPoints, formatPrice } from '@/lib/formatters'

interface PremarketLevelCardProps {
  kind: 'HIGH' | 'LOW'
  level: number | null
  currentPrice: number | null
}

/** Premarket high/low are main fields: the number stands alone. */
export function PremarketLevelCard({ kind, level, currentPrice }: PremarketLevelCardProps) {
  const Icon = kind === 'HIGH' ? ArrowUpToLine : ArrowDownToLine
  const hasBoth = typeof level === 'number' && typeof currentPrice === 'number'
  const distancePercent = hasBoth ? ((currentPrice - level) / level) * 100 : null
  const above = hasBoth ? currentPrice >= level : null

  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> Premarket {kind === 'HIGH' ? 'High' : 'Low'}
        </CardTitle>
        <div className="tabular mt-2 text-2xl font-bold">{formatPrice(level)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {hasBoth ? (
            <>
              Price {above ? 'above' : 'below'} by{' '}
              <span className="tabular">{formatPercentPoints(Math.abs(distancePercent ?? 0))}</span>
            </>
          ) : (
            EM_DASH
          )}
        </div>
      </CardContent>
    </Card>
  )
}
