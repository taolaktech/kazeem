import { Ban, CircleCheck, CircleSlash, PauseCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatPercent, formatScore } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { TradeDecisionResponse } from '@/types/trade-decision'

const decisionStyles: Record<string, string> = {
  TRADE: 'border-bull/40 bg-bull/10 text-bull',
  WAIT: 'border-warn/40 bg-warn/10 text-warn',
  NO_TRADE: 'border-bear/40 bg-bear/10 text-bear',
}

const decisionIcons: Record<string, typeof CircleCheck> = {
  TRADE: CircleCheck,
  WAIT: PauseCircle,
  NO_TRADE: Ban,
}

export function DecisionHero({ data }: { data: TradeDecisionResponse }) {
  const DecisionIcon = decisionIcons[data.decision] ?? CircleSlash
  const directionVariant =
    data.direction === 'CALL' ? 'bull' : data.direction === 'PUT' ? 'bear' : 'neutral'

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="font-mono text-4xl font-bold leading-none tracking-tight">
              {data.symbol}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              3-minute intelligence
            </div>
          </div>

          <div
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-lg font-bold tracking-wide',
              decisionStyles[data.decision] ?? 'border-border bg-secondary',
            )}
          >
            <DecisionIcon className="h-5 w-5" />
            {data.decision.replaceAll('_', ' ')}
          </div>

          <Badge variant={directionVariant} className="px-3 py-1.5 text-sm">
            {data.direction}
          </Badge>

          <div className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm font-bold">
            {data.setupGrade}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          <HeroStat label="Decision Score" value={`${formatScore(data.normalizedDecisionScore)} / 100`} />
          <HeroStat label="Decision Confidence" value={formatPercent(data.confidence)} />
          <HeroStat
            label="Trade Evaluation"
            value={data.tradeEvaluationAllowed ? 'Allowed' : 'Blocked'}
            valueClassName={data.tradeEvaluationAllowed ? 'text-bull' : 'text-bear'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function HeroStat({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('tabular text-xl font-semibold', valueClassName)}>{value}</div>
    </div>
  )
}
