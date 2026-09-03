import { AlertTriangle, Activity } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ComponentScoresCard } from '@/components/dashboard/ComponentScoresCard'
import { ConfidenceGauge } from '@/components/dashboard/ConfidenceGauge'
import { ConflictsCard } from '@/components/dashboard/ConflictsCard'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { DecisionHero } from '@/components/dashboard/DecisionHero'
import { DecisionScoreGauge } from '@/components/dashboard/DecisionScoreGauge'
import { ExecutionStatus } from '@/components/dashboard/ExecutionStatus'
import { MarketContextCard } from '@/components/dashboard/MarketContextCard'
import { NewsCard } from '@/components/dashboard/NewsCard'
import { OpeningRangeChart } from '@/components/dashboard/OpeningRangeChart'
import { PremarketLevelCard } from '@/components/dashboard/PremarketLevelCard'
import { ReasoningCard } from '@/components/dashboard/ReasoningCard'
import { RegimeStructureCard } from '@/components/dashboard/RegimeStructureCard'
import { RiskFlagsCard } from '@/components/dashboard/RiskFlagsCard'
import { SelectedContractCard } from '@/components/dashboard/SelectedContractCard'
import { SymbolSearch } from '@/components/dashboard/SymbolSearch'
import { ThesisCard } from '@/components/dashboard/ThesisCard'
import { TimestampCard } from '@/components/dashboard/TimestampCard'
import { VolatilityCard } from '@/components/dashboard/VolatilityCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { API_BASE_URL, ApiError, getTradeDecision } from '@/lib/api'
import type { TradeDecisionResponse } from '@/types/trade-decision'

const DEFAULT_SYMBOL = 'QQQ'
const DEFAULT_MAX_BUDGET = 500
const AUTO_REFRESH_INTERVAL_MS = 4 * 60 * 1000

export function Dashboard() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [maxBudget, setMaxBudget] = useState(DEFAULT_MAX_BUDGET)
  const [data, setData] = useState<TradeDecisionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const inFlight = useRef<AbortController | null>(null)

  const analyze = useCallback(async (nextSymbol: string, nextBudget: number) => {
    // One request at a time: a new analyze cancels the previous one.
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    setSymbol(nextSymbol)
    setMaxBudget(nextBudget)
    setLoading(true)
    setError(null)

    try {
      const result = await getTradeDecision(nextSymbol, nextBudget, controller.signal)
      if (controller.signal.aborted) return
      setData(result)
    } catch (caught) {
      if (controller.signal.aborted) return
      setData(null)
      setError(caught instanceof ApiError ? caught.message : 'Unexpected error. See console.')
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      if (!inFlight.current) void analyze(symbol, maxBudget)
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [autoRefresh, analyze, symbol, maxBudget])

  useEffect(() => () => inFlight.current?.abort(), [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-wide">FinOptions Terminal</span>
            <span className="text-[11px] text-muted-foreground">read-only intelligence</span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">{API_BASE_URL}</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        <SymbolSearch
          symbol={symbol}
          maxBudget={maxBudget}
          loading={loading}
          autoRefresh={autoRefresh}
          canRefresh={data !== null || error !== null}
          onAnalyze={(nextSymbol, nextBudget) => void analyze(nextSymbol, nextBudget)}
          onRefresh={() => void analyze(symbol, maxBudget)}
          onAutoRefreshChange={setAutoRefresh}
        />

        {error ? (
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Request failed
            </AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && !data ? <DashboardSkeleton symbol={symbol} /> : null}

        {data ? (
          <div className={loading ? 'space-y-4 opacity-60 transition-opacity' : 'space-y-4'}>
            <DecisionHero data={data} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <TimestampCard timestamp={data.timestamp} />
              <PremarketLevelCard
                kind="HIGH"
                level={data.marketContext.premarketHigh}
                currentPrice={data.marketContext.currentPrice}
              />
              <PremarketLevelCard
                kind="LOW"
                level={data.marketContext.premarketLow}
                currentPrice={data.marketContext.currentPrice}
              />
              <ExecutionStatus
                tradeEvaluationAllowed={data.tradeEvaluationAllowed}
                executionReady={data.executionReady}
                hardBlockers={data.hardBlockers}
                contractRiskFlags={data.selectedContract?.riskFlags ?? []}
              />
            </div>

            <ThesisCard thesis={data.thesis} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <DecisionScoreGauge
                  score={data.normalizedDecisionScore}
                  grade={data.setupGrade}
                  rawEarnedScore={data.rawEarnedScore}
                  availableWeight={data.availableWeight}
                  conflictPenalty={data.conflictPenalty}
                />
              </div>
              <div className="lg:col-span-3">
                <ConfidenceGauge confidence={data.confidence} />
              </div>
              <div className="lg:col-span-6">
                <ComponentScoresCard
                  componentScores={data.componentScores}
                  availableWeight={data.availableWeight}
                  rawEarnedScore={data.rawEarnedScore}
                />
              </div>
            </div>

            <SelectedContractCard
              contract={data.selectedContract}
              underlyingSymbol={data.symbol}
              optionSelectionStatus={data.optionSelectionStatus}
              executionReady={data.executionReady}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <OpeningRangeChart openingRange={data.marketContext.openingRange} />
              <RegimeStructureCard
                context={data.marketContext}
                score={data.componentScores.regimeAndStructure}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MarketContextCard context={data.marketContext} />
              <VolatilityCard
                volatility={data.volatility}
                marketContextVolatility={data.marketContext.volatility}
                missingIntelligence={data.missingIntelligence}
              />
              <NewsCard news={data.news} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ReasoningCard reasoning={data.reasoning} />
              </div>
              <div className="space-y-4">
                <RiskFlagsCard riskFlags={data.riskFlags} />
                <ConflictsCard conflicts={data.conflicts} />
              </div>
            </div>
          </div>
        ) : null}

        {!data && !loading && !error ? (
          <EmptyState>Enter a symbol and press Analyze.</EmptyState>
        ) : null}
      </main>
    </div>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
