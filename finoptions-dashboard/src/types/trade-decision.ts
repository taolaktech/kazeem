/**
 * Mirrors the NestJS `TradeDecisionResult` returned by
 * `GET /trade-decision/:symbol?maxBudget=`. Backend field names are kept
 * verbatim. Fields the backend may add later stay optional on purpose.
 */

export type TradeDecisionValue = 'TRADE' | 'WAIT' | 'NO_TRADE'
export type TradeDirection = 'CALL' | 'PUT' | 'NONE'
export type SetupGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C'
export type ConflictSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL'

export type DecisionCategory =
  | 'directionalSignal'
  | 'regimeAndStructure'
  | 'momentumAndVolume'
  | 'optionQuality'
  | 'news'
  | 'volatility'

export interface DecisionConflict {
  category: DecisionCategory | string
  code: string
  severity: ConflictSeverity
  description: string
  penalized: boolean
  penalty?: number | null
}

export interface ComponentScore {
  earned: number | null
  available: number
  reason?: string | null
  confirmations?: string[]
  conflicts?: DecisionConflict[]
  riskFlags?: string[]
  missingIntelligence?: string[]
}

export interface OpeningRange {
  available: boolean
  status: 'FORMING' | 'COMPLETE' | 'UNAVAILABLE'
  startTime: string
  endTime: string
  windowMinutes: number
  candleCount: number
  expectedCandleCount: number
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  range: number | null
  rangePercent: number | null
  currentPrice: number | null
  currentPricePosition: 'ABOVE' | 'INSIDE' | 'BELOW' | 'UNKNOWN'
  distanceFromHighPercent: number | null
  distanceFromLowPercent: number | null
  breakoutTolerancePercent: number
  breakoutAbove: boolean
  breakdownBelow: boolean
  closesAboveHigh: number
  closesBelowLow: number
  failedBreakoutAbove: boolean
  failedBreakdownBelow: boolean
  breakoutStrength: 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG'
  volumeConfirmation: 'CONFIRMED' | 'NOT_CONFIRMED' | 'UNKNOWN'
  relativeBreakoutVolume: number | null
  /** Informational full-session metadata, never the analytical working set. */
  totalPostRangeCandleCount: number
}

/** The capped analytical working window; never the day's reference levels. */
export interface AnalysisWindow {
  timeframeMinutes: number
  candleCount: number
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  positionInRange: number | null
}

export interface MarketContext {
  regime: string
  regimeConfidence: number
  trendDirection: string
  trendStrength: string
  volatility: string
  signal: string
  signalConfidence: number
  marketSession: string
  sessionMaturity: string
  timeframeMinutes: number
  currentSessionCandleCount: number
  totalSessionCandleCount: number
  currentPrice: number
  sessionOpen: number | null
  sessionHigh: number | null
  sessionLow: number | null
  sessionPositionInRange: number | null
  analysisWindow: AnalysisWindow
  premarketHigh: number | null
  premarketLow: number | null
  openingRange: OpeningRange
}

export interface NewsContext {
  available: boolean
  sentiment: string | null
  sentimentConfidence: number | null
  marketRiskBias: string | null
  riskBiasConfidence: number | null
  impact: string | null
  articleCount: number | null
  dominantCatalysts: string[]
}

export interface VolatilityContext {
  available: boolean
  volatilitySymbol: string
  vix: number | null
  state: string | null
  trend: string | null
  momentum: string | null
  signalAlignment: string | null
  volatilityPressureScore: number | null
  previousClose?: number | null
  change?: number | null
  changePercent?: number | null
}

export interface OptionScoreBreakdown {
  delta: number
  strikeProximity: number
  dte: number
  volume: number
  openInterest: number
  iv: number
  spread: number
  dataQuality: number
}

export interface SelectedContract {
  symbol: string
  contractType: 'CALL' | 'PUT'
  strikePrice: number
  expirationDate: string
  daysToExpiration: number
  moneyness: string
  strikeDistancePercent: number
  bid: number | null
  ask: number | null
  lastPrice: number | null
  volume: number
  openInterest: number
  impliedVolatility: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  premiumPriceUsed: number | null
  premiumPriceSource: string
  estimatedContractCost: number | null
  withinBudget: boolean
  score: number
  scoreBreakdown?: OptionScoreBreakdown
  quoteAvailable: boolean
  dataCompleteness: number
  riskFlags: string[]
}

export interface TradeDecisionResponse {
  symbol: string
  timestamp: string
  decision: TradeDecisionValue
  direction: TradeDirection
  setupGrade: SetupGrade
  normalizedDecisionScore: number
  rawEarnedScore: number
  availableWeight: number
  preConflictScore: number
  conflictPenalty: number
  confidence: number
  tradeEvaluationAllowed: boolean
  thesis: string
  maxBudget: number
  componentScores: Partial<Record<DecisionCategory, ComponentScore>>
  conflicts: DecisionConflict[]
  hardBlockers: string[]
  missingIntelligence: string[]
  riskFlags: string[]
  reasoning: string[]
  marketContext: MarketContext
  optionSelectionStatus: string
  selectedContract: SelectedContract | null
  executionReady: boolean
  news: NewsContext
  volatility: VolatilityContext
}
