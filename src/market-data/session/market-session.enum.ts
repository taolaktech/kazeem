/** State of the US equity trading day, evaluated in America/New_York. */
export enum MarketSession {
  PREMARKET = 'PREMARKET',
  /** First minutes after the open, where prices are still settling. */
  OPENING_SETTLEMENT = 'OPENING_SETTLEMENT',
  REGULAR = 'REGULAR',
  AFTER_HOURS = 'AFTER_HOURS',
  CLOSED = 'CLOSED',
}

/** How much evidence the current regular session has produced so far. */
export enum SessionMaturity {
  SETTLING = 'SETTLING',
  EARLY = 'EARLY',
  DEVELOPING = 'DEVELOPING',
  ESTABLISHED = 'ESTABLISHED',
}

/** Which part of the trading day a single candle belongs to. */
export type CandlePhase = 'PREMARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';
