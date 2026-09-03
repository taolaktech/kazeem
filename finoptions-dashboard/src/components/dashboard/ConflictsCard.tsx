import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { formatEnum, formatScore } from '@/lib/formatters'
import type { ConflictSeverity, DecisionConflict } from '@/types/trade-decision'

function severityVariant(severity: ConflictSeverity) {
  if (severity === 'CRITICAL' || severity === 'MAJOR') return 'bear' as const
  if (severity === 'MODERATE') return 'warn' as const
  return 'neutral' as const
}

export function ConflictsCard({ conflicts }: { conflicts: DecisionConflict[] }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle>Conflicts</CardTitle>
        {conflicts.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {conflicts.map((conflict) => (
              <li key={`${conflict.category}-${conflict.code}`} className="rounded-md border border-border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severityVariant(conflict.severity)}>{conflict.severity}</Badge>
                  <span className="font-mono text-[11px] text-muted-foreground">{conflict.code}</span>
                  <span className="tabular ml-auto text-[11px] text-muted-foreground">
                    {conflict.penalized
                      ? `-${formatScore(conflict.penalty ?? 0)} points`
                      : 'Already reflected in component score'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed">{conflict.description}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatEnum(String(conflict.category))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No conflicts detected</p>
        )}
      </CardContent>
    </Card>
  )
}
