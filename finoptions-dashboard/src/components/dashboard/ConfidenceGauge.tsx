import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatPercent } from '@/lib/formatters'

export function ConfidenceGauge({ confidence }: { confidence: number }) {
  const percent = Math.max(0, Math.min(100, confidence * 100))

  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle>Decision Confidence</CardTitle>
        <div className="tabular mt-2 text-3xl font-bold">{formatPercent(confidence)}</div>
        <Progress value={percent} className="mt-3" />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          How reliable the classification itself is. It is not a probability of profit.
        </p>
      </CardContent>
    </Card>
  )
}
