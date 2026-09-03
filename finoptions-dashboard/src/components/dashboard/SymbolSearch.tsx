import { Loader2, RefreshCw, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SymbolSearchProps {
  symbol: string
  maxBudget: number
  loading: boolean
  autoRefresh: boolean
  canRefresh: boolean
  onAnalyze: (symbol: string, maxBudget: number) => void
  onRefresh: () => void
  onAutoRefreshChange: (enabled: boolean) => void
}

export function SymbolSearch({
  symbol,
  maxBudget,
  loading,
  autoRefresh,
  canRefresh,
  onAnalyze,
  onRefresh,
  onAutoRefreshChange,
}: SymbolSearchProps) {
  const [symbolInput, setSymbolInput] = useState(symbol)
  const [budgetInput, setBudgetInput] = useState(String(maxBudget))

  const trimmedSymbol = symbolInput.trim().toUpperCase()
  const parsedBudget = Number.parseFloat(budgetInput)
  const budgetValid = Number.isFinite(parsedBudget) && parsedBudget > 0
  const submitDisabled = loading || trimmedSymbol.length === 0 || !budgetValid

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitDisabled) return
    onAnalyze(trimmedSymbol, parsedBudget)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label
          htmlFor="symbol"
          className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground"
        >
          Symbol
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="symbol"
            value={symbolInput}
            autoComplete="off"
            spellCheck={false}
            placeholder="QQQ"
            onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
            className="pl-9 font-mono text-base uppercase tracking-wide"
          />
        </div>
      </div>

      <div className="w-full sm:w-40">
        <label
          htmlFor="maxBudget"
          className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground"
        >
          Max Budget ($)
        </label>
        <Input
          id="maxBudget"
          inputMode="decimal"
          value={budgetInput}
          onChange={(event) => setBudgetInput(event.target.value)}
          className="tabular"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitDisabled} className="min-w-[110px]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Analyzing' : 'Analyze'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Refresh"
          disabled={loading || !canRefresh}
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <label className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-current"
            checked={autoRefresh}
            onChange={(event) => onAutoRefreshChange(event.target.checked)}
          />
          Auto refresh
        </label>
      </div>
    </form>
  )
}
