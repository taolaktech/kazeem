import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { formatEnum, formatScore } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ComponentScore, DecisionCategory } from '@/types/trade-decision'

const CATEGORY_LABELS: Record<DecisionCategory, string> = {
  directionalSignal: 'Directional Signal',
  regimeAndStructure: 'Regime + Structure',
  momentumAndVolume: 'Momentum + Volume',
  optionQuality: 'Option Selection',
  news: 'News',
  volatility: 'VIX',
}

const CATEGORY_ORDER: DecisionCategory[] = [
  'directionalSignal',
  'regimeAndStructure',
  'momentumAndVolume',
  'optionQuality',
  'news',
  'volatility',
]

interface ComponentScoresCardProps {
  componentScores: Partial<Record<DecisionCategory, ComponentScore>>
  availableWeight: number
  rawEarnedScore: number
}

export function ComponentScoresCard({
  componentScores,
  availableWeight,
  rawEarnedScore,
}: ComponentScoresCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <CardTitle>Component Scores</CardTitle>
          <span className="tabular text-xs text-muted-foreground">
            {formatScore(rawEarnedScore, 0)} / {formatScore(availableWeight, 0)} weighted
          </span>
        </div>

        <div className="mt-3 space-y-3">
          {CATEGORY_ORDER.map((category) => {
            const score = componentScores[category]
            if (!score) return null
            return <ScoreBar key={category} label={CATEGORY_LABELS[category]} score={score} />
          })}
        </div>

        <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
          Components marked unavailable are excluded from the denominator, so the available weight
          above can be below 100.
        </p>
      </CardContent>
    </Card>
  )
}

function ScoreBar({ label, score }: { label: string; score: ComponentScore }) {
  const unavailable = score.earned === null || score.available === 0
  const percent = unavailable ? 0 : Math.max(0, Math.min(100, ((score.earned ?? 0) / score.available) * 100))
  const barColor = percent >= 70 ? 'bg-bull' : percent >= 40 ? 'bg-warn' : 'bg-bear'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium">{label}</span>
        <span className="tabular text-xs text-muted-foreground">
          {unavailable
            ? `unavailable${score.reason ? ` (${formatEnum(score.reason)})` : ''}`
            : `${formatScore(score.earned, 0)} / ${formatScore(score.available, 0)}`}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
        {unavailable ? (
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,hsl(var(--muted)),hsl(var(--muted))6px,transparent_6px,transparent_12px)]" />
        ) : (
          <div className={cn('h-full rounded-full', barColor)} style={{ width: `${percent}%` }} />
        )}
      </div>
      {score.reason && !unavailable ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{formatEnum(score.reason)}</div>
      ) : null}
    </div>
  )
}
