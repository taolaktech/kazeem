import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'

import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ExecutionStatusProps {
  tradeEvaluationAllowed: boolean
  executionReady: boolean
  hardBlockers: string[]
  contractRiskFlags: string[]
}

export function ExecutionStatus({
  tradeEvaluationAllowed,
  executionReady,
  hardBlockers,
  contractRiskFlags,
}: ExecutionStatusProps) {
  const reasons = executionReady ? [] : [...hardBlockers, ...contractRiskFlags]

  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle>Execution Status</CardTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatusTile
            label="Trade Evaluation"
            ok={tradeEvaluationAllowed}
            okText="ALLOWED"
            failText="BLOCKED"
          />
          <StatusTile
            label="Contract"
            ok={executionReady}
            okText="EXECUTION READY"
            failText="NOT READY"
          />
        </div>
        {reasons.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Informational only. This dashboard never places orders.
        </p>
      </CardContent>
    </Card>
  )
}

function StatusTile({
  label,
  ok,
  okText,
  failText,
}: {
  label: string
  ok: boolean
  okText: string
  failText: string
}) {
  const Icon = ok ? CheckCircle2 : XCircle
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        ok ? 'border-bull/40 bg-bull/10' : 'border-bear/40 bg-bear/10',
      )}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-1 flex items-center gap-1.5 text-sm font-bold', ok ? 'text-bull' : 'text-bear')}>
        <Icon className="h-4 w-4" />
        {ok ? okText : failText}
      </div>
    </div>
  )
}
