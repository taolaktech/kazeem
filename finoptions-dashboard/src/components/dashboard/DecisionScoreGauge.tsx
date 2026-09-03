import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'

import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { formatScore } from '@/lib/formatters'

/** Visual context only; `setupGrade` from the backend stays authoritative. */
const GRADE_BANDS = [
  { grade: 'A+', min: 90 },
  { grade: 'A', min: 83 },
  { grade: 'B+', min: 76 },
  { grade: 'B', min: 69 },
  { grade: 'C+', min: 60 },
  { grade: 'C', min: 0 },
]

function gaugeColor(score: number): string {
  if (score >= 76) return 'hsl(var(--bull))'
  if (score >= 60) return 'hsl(var(--warn))'
  return 'hsl(var(--bear))'
}

interface DecisionScoreGaugeProps {
  score: number
  grade: string
  rawEarnedScore: number
  availableWeight: number
  conflictPenalty: number
}

export function DecisionScoreGauge({
  score,
  grade,
  rawEarnedScore,
  availableWeight,
  conflictPenalty,
}: DecisionScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const band = GRADE_BANDS.find((entry) => clamped >= entry.min)

  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle>Decision Score</CardTitle>
        <div className="relative mx-auto h-[168px] w-full max-w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="76%"
              outerRadius="100%"
              data={[{ name: 'score', value: clamped, fill: gaugeColor(clamped) }]}
              startAngle={210}
              endAngle={-30}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: 'hsl(var(--secondary))' }} dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-2">
            <div className="tabular text-3xl font-bold">{formatScore(score)}</div>
            <div className="text-sm font-semibold text-muted-foreground">{grade}</div>
          </div>
        </div>
        <div className="tabular mt-1 space-y-0.5 text-center text-[11px] text-muted-foreground">
          <div>
            Earned {formatScore(rawEarnedScore, 0)} of {formatScore(availableWeight, 0)} available
            weight
          </div>
          {conflictPenalty > 0 ? (
            <div className="text-warn">Conflict penalty {formatScore(conflictPenalty)}</div>
          ) : null}
          {band ? <div>Visual band: {band.grade}</div> : null}
        </div>
      </CardContent>
    </Card>
  )
}
