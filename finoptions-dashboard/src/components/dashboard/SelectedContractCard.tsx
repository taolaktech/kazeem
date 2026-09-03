import { FileWarning } from 'lucide-react'

import { Field, FieldGrid } from '@/components/dashboard/Field'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  EM_DASH,
  formatBoolean,
  formatCompact,
  formatEnum,
  formatGreek,
  formatInteger,
  formatPercent,
  formatPercentPoints,
  formatPrice,
  formatExpiration,
  formatScore,
} from '@/lib/formatters'
import type { SelectedContract } from '@/types/trade-decision'

interface SelectedContractCardProps {
  contract: SelectedContract | null
  underlyingSymbol: string
  optionSelectionStatus: string
  executionReady: boolean
}

export function SelectedContractCard({
  contract,
  underlyingSymbol,
  optionSelectionStatus,
  executionReady,
}: SelectedContractCardProps) {
  if (!contract) {
    return (
      <Card>
        <CardContent className="pt-4">
          <CardTitle>Selected Contract</CardTitle>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 py-8 text-center">
            <FileWarning className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium">No contract selected</div>
            <div className="text-xs text-muted-foreground">
              Option selection status: {formatEnum(optionSelectionStatus)}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const midpoint =
    typeof contract.bid === 'number' && typeof contract.ask === 'number'
      ? (contract.bid + contract.ask) / 2
      : null

  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle>Selected Contract</CardTitle>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge
            variant={contract.contractType === 'CALL' ? 'bull' : 'bear'}
            className="px-3 py-1 text-sm"
          >
            {underlyingSymbol} {contract.contractType}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{contract.symbol}</span>
          <Badge variant="outline">{formatEnum(contract.moneyness)}</Badge>
          <Badge variant={executionReady ? 'bull' : 'warn'}>
            {executionReady ? 'Execution ready' : 'Not execution ready'}
          </Badge>
        </div>

        <div className="tabular mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Highlight label="Strike" value={formatPrice(contract.strikePrice)} />
          <Highlight label="Expiration" value={formatExpiration(contract.expirationDate)} />
          <Highlight label="Premium" value={formatPrice(contract.premiumPriceUsed)} />
          <Highlight label="Contract Cost" value={formatPrice(contract.estimatedContractCost)} />
          <Highlight label="Delta" value={formatGreek(contract.delta)} />
        </div>

        <Separator className="my-3" />

        <FieldGrid>
          <Field label="Underlying" value={underlyingSymbol} />
          <Field label="Days to Expiration" value={formatInteger(contract.daysToExpiration)} />
          <Field label="Bid" value={formatPrice(contract.bid)} />
          <Field label="Ask" value={formatPrice(contract.ask)} />
          <Field label="Midpoint" value={formatPrice(midpoint)} />
          <Field label="Last Price" value={formatPrice(contract.lastPrice)} />
          <Field label="Premium Source" value={formatEnum(contract.premiumPriceSource)} />
          <Field label="Within Budget" value={formatBoolean(contract.withinBudget)} />
          <Field label="Volume" value={formatCompact(contract.volume)} />
          <Field label="Open Interest" value={formatCompact(contract.openInterest)} />
          <Field label="Implied Volatility" value={formatPercent(contract.impliedVolatility, 1)} />
          <Field label="Strike Distance" value={formatPercentPoints(contract.strikeDistancePercent)} />
          <Field label="Gamma" value={formatGreek(contract.gamma)} />
          <Field label="Theta" value={formatGreek(contract.theta)} />
          <Field label="Vega" value={formatGreek(contract.vega)} />
          <Field label="Quote Available" value={formatBoolean(contract.quoteAvailable)} />
          <Field label="Data Completeness" value={formatPercent(contract.dataCompleteness)} />
          <Field label="Selection Score" value={`${formatScore(contract.score, 0)} / 100`} />
        </FieldGrid>

        {contract.riskFlags.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-border pt-3">
            {contract.riskFlags.map((flag) => (
              <li key={flag} className="text-xs text-warn">
                {flag}
              </li>
            ))}
          </ul>
        ) : null}

        {contract.scoreBreakdown ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
            {Object.entries(contract.scoreBreakdown).map(([key, value]) => (
              <span key={key} className="tabular">
                {key}: {typeof value === 'number' ? value : EM_DASH}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}
