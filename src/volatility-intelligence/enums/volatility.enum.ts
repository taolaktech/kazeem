/** Absolute volatility level, derived from the VIX index value alone. */
export enum VolatilityState {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  ELEVATED = 'ELEVATED',
  HIGH = 'HIGH',
  EXTREME = 'EXTREME',
  UNKNOWN = 'UNKNOWN',
}

/** Direction volatility is developing in, across the session. */
export enum VolatilityTrend {
  RISING = 'RISING',
  FALLING = 'FALLING',
  FLAT = 'FLAT',
  UNKNOWN = 'UNKNOWN',
}

/** Pace of the most recent volatility move, over a few completed candles. */
export enum VolatilityMomentum {
  RISING_FAST = 'RISING_FAST',
  RISING = 'RISING',
  FLAT = 'FLAT',
  FALLING = 'FALLING',
  FALLING_FAST = 'FALLING_FAST',
  UNKNOWN = 'UNKNOWN',
}

/** How volatility behaviour relates to the underlying's own movement. */
export enum VolatilityRelationship {
  CONFIRMING_BULLISH = 'CONFIRMING_BULLISH',
  CONFIRMING_BEARISH = 'CONFIRMING_BEARISH',
  DIVERGENCE = 'DIVERGENCE',
  NEUTRAL = 'NEUTRAL',
  UNKNOWN = 'UNKNOWN',
}

export enum ConfirmationStrength {
  WEAK = 'WEAK',
  MODERATE = 'MODERATE',
  STRONG = 'STRONG',
  UNKNOWN = 'UNKNOWN',
}

/** Whether the volatility environment supports the current directional signal. */
export enum SignalAlignment {
  CONFIRMS = 'CONFIRMS',
  CONFLICTS = 'CONFLICTS',
  NEUTRAL = 'NEUTRAL',
  UNKNOWN = 'UNKNOWN',
}

/** Direction of a price series over the current session. */
export type SeriesDirection = 'RISING' | 'FALLING' | 'FLAT' | 'UNKNOWN';
