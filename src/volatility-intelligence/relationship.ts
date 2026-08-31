import { SessionMaturity } from '../market-data/session/market-session.enum.js';
import { MarketSignal } from '../signal/enums/market-signal.enum.js';
import {
  CONFIRMATION_STRENGTH_SCORE,
  PREMARKET_DIRECTIONAL_DECAY,
  PRESSURE_SATURATION_PERCENT,
  PRESSURE_WEIGHTS,
  UNDERLYING_MATERIAL_MOVE_PERCENT,
  VIX_LEVEL_THRESHOLDS,
  VIX_MATERIAL_MOVE_PERCENT,
} from './constants/volatility-thresholds.js';
import {
  ConfirmationStrength,
  SignalAlignment,
  VolatilityMomentum,
  VolatilityRelationship,
  VolatilityTrend,
  type SeriesDirection,
} from './enums/volatility.enum.js';
import type {
  UnderlyingMetrics,
  VixMetrics,
} from './interfaces/volatility-intelligence-result.interface.js';
import { clampSigned, round } from './series-metrics.js';
import type { VixAnalysis } from './vix-analysis.js';

export interface RelationshipAssessment {
  relationship: VolatilityRelationship;
  strength: ConfirmationStrength;
  vixDirection: SeriesDirection;
  underlyingDirection: SeriesDirection;
  confirmations: string[];
  divergences: string[];
  riskFlags: string[];
}

/**
 * Compares what volatility is doing with what the underlying is doing. The
 * usual inverse relationship is treated as an observation to verify, never as
 * an assumption, and a conflict is reported as a conflict rather than resolved
 * in favour of either side.
 */
export function assessRelationship(
  vix: VixAnalysis,
  underlying: UnderlyingMetrics,
): RelationshipAssessment {
  const underlyingDirection = resolveUnderlyingDirection(underlying);
  const vixDirection = resolveVixDirection(vix);

  if (
    !vix.metrics.available ||
    vixDirection === 'UNKNOWN' ||
    underlyingDirection === 'UNKNOWN'
  ) {
    return {
      relationship: VolatilityRelationship.UNKNOWN,
      strength: ConfirmationStrength.UNKNOWN,
      vixDirection,
      underlyingDirection,
      confirmations: [],
      divergences: [],
      riskFlags: [],
    };
  }

  const confirmations: string[] = [];
  const divergences: string[] = [];
  const riskFlags: string[] = [];
  let relationship = VolatilityRelationship.NEUTRAL;

  if (underlyingDirection === 'RISING' && vixDirection === 'FALLING') {
    relationship = VolatilityRelationship.CONFIRMING_BULLISH;
    confirmations.push('Underlying advance is confirmed by falling VIX');
  } else if (underlyingDirection === 'FALLING' && vixDirection === 'RISING') {
    relationship = VolatilityRelationship.CONFIRMING_BEARISH;
    confirmations.push('Underlying decline is confirmed by rising VIX');
  } else if (underlyingDirection === 'RISING' && vixDirection === 'RISING') {
    relationship = VolatilityRelationship.DIVERGENCE;
    divergences.push('Underlying is rising while VIX is also rising');
    riskFlags.push('VIX expansion conflicts with bullish underlying movement');
  } else if (underlyingDirection === 'FALLING' && vixDirection === 'FALLING') {
    relationship = VolatilityRelationship.DIVERGENCE;
    divergences.push('Underlying is falling while VIX is also falling');
    riskFlags.push(
      'VIX contraction conflicts with bearish underlying movement',
    );
  } else if (underlyingDirection === 'FLAT' || vixDirection === 'FLAT') {
    divergences.push(
      underlyingDirection === 'FLAT'
        ? 'Underlying has no clear directional move to confirm'
        : 'VIX has no clear directional move to confirm the underlying',
    );
  }

  return {
    relationship,
    strength: resolveStrength(relationship, vix, underlying),
    vixDirection,
    underlyingDirection,
    confirmations,
    divergences,
    riskFlags,
  };
}

/**
 * The requested underlying is judged on its own tape: move from the session
 * open first, then the move from the previous close and the recent momentum.
 */
export function resolveUnderlyingDirection(
  underlying: UnderlyingMetrics,
): SeriesDirection {
  if (underlying.current === null) {
    return 'UNKNOWN';
  }
  const score =
    directionalPoint(
      underlying.changePercentFromOpen,
      UNDERLYING_MATERIAL_MOVE_PERCENT,
    ) +
    directionalPoint(
      underlying.changePercent,
      UNDERLYING_MATERIAL_MOVE_PERCENT,
    ) +
    directionalPoint(
      underlying.shortMomentumPercent,
      UNDERLYING_MATERIAL_MOVE_PERCENT,
    );
  if (score > 0) {
    return 'RISING';
  }
  return score < 0 ? 'FALLING' : 'FLAT';
}

/**
 * Volatility direction leans on rate of change, not on the absolute level, so
 * a 9% expansion off a low base is not dismissed as harmless.
 */
export function resolveVixDirection(vix: VixAnalysis): SeriesDirection {
  const { metrics, trend, momentum } = vix;
  if (!metrics.available || metrics.current === null) {
    return 'UNKNOWN';
  }

  let score = directionalPoint(
    metrics.changePercent,
    VIX_MATERIAL_MOVE_PERCENT,
  );
  score += directionalPoint(
    metrics.changePercentFromOpen,
    VIX_MATERIAL_MOVE_PERCENT,
  );
  if (
    momentum === VolatilityMomentum.RISING_FAST ||
    momentum === VolatilityMomentum.RISING
  ) {
    score += momentum === VolatilityMomentum.RISING_FAST ? 2 : 1;
  } else if (
    momentum === VolatilityMomentum.FALLING_FAST ||
    momentum === VolatilityMomentum.FALLING
  ) {
    score -= momentum === VolatilityMomentum.FALLING_FAST ? 2 : 1;
  }
  if (trend === VolatilityTrend.RISING) {
    score += 1;
  } else if (trend === VolatilityTrend.FALLING) {
    score -= 1;
  }

  if (score >= 2) {
    return 'RISING';
  }
  return score <= -2 ? 'FALLING' : 'FLAT';
}

function resolveStrength(
  relationship: VolatilityRelationship,
  vix: VixAnalysis,
  underlying: UnderlyingMetrics,
): ConfirmationStrength {
  if (relationship === VolatilityRelationship.NEUTRAL) {
    return ConfirmationStrength.WEAK;
  }

  let score = 0;
  if (isMaterial(vix.metrics.changePercent, VIX_MATERIAL_MOVE_PERCENT)) {
    score += 1;
  }
  if (
    isMaterial(vix.metrics.changePercentFromOpen, VIX_MATERIAL_MOVE_PERCENT)
  ) {
    score += 1;
  }
  if (
    vix.momentum === VolatilityMomentum.RISING_FAST ||
    vix.momentum === VolatilityMomentum.FALLING_FAST
  ) {
    score += 1;
  }
  if (vix.trend !== VolatilityTrend.FLAT) {
    score += 1;
  }
  if (
    isMaterial(
      underlying.changePercentFromOpen,
      UNDERLYING_MATERIAL_MOVE_PERCENT * 2,
    )
  ) {
    score += 1;
  }

  if (score >= CONFIRMATION_STRENGTH_SCORE.strong) {
    return ConfirmationStrength.STRONG;
  }
  return score >= CONFIRMATION_STRENGTH_SCORE.moderate
    ? ConfirmationStrength.MODERATE
    : ConfirmationStrength.WEAK;
}

/**
 * Whether the volatility environment supports the direction the signal engine
 * already decided. It reports agreement; it never rewrites the signal.
 */
export function resolveSignalAlignment(
  signal: MarketSignal,
  relationship: VolatilityRelationship,
): SignalAlignment {
  if (relationship === VolatilityRelationship.UNKNOWN) {
    return SignalAlignment.UNKNOWN;
  }
  if (signal === MarketSignal.BULLISH) {
    if (relationship === VolatilityRelationship.CONFIRMING_BULLISH) {
      return SignalAlignment.CONFIRMS;
    }
    return relationship === VolatilityRelationship.CONFIRMING_BEARISH ||
      relationship === VolatilityRelationship.DIVERGENCE
      ? SignalAlignment.CONFLICTS
      : SignalAlignment.NEUTRAL;
  }
  if (signal === MarketSignal.BEARISH) {
    if (relationship === VolatilityRelationship.CONFIRMING_BEARISH) {
      return SignalAlignment.CONFIRMS;
    }
    return relationship === VolatilityRelationship.CONFIRMING_BULLISH ||
      relationship === VolatilityRelationship.DIVERGENCE
      ? SignalAlignment.CONFLICTS
      : SignalAlignment.NEUTRAL;
  }
  return SignalAlignment.NEUTRAL;
}

/**
 * Explainable contextual score in [-1, 1]: positive is volatility expansion
 * (risk-off pressure), negative is contraction. Premarket only contributes
 * while the session is young, through {@link PREMARKET_DIRECTIONAL_DECAY}.
 */
export function volatilityPressureScore(
  vix: VixMetrics,
  underlying: UnderlyingMetrics,
  maturity: SessionMaturity,
): number {
  if (!vix.available) {
    return 0;
  }
  const premarketWeight = PREMARKET_DIRECTIONAL_DECAY[maturity];
  const score =
    PRESSURE_WEIGHTS.changePercent * saturate(vix.changePercent) +
    PRESSURE_WEIGHTS.changeFromOpenPercent *
      saturate(vix.changePercentFromOpen) +
    PRESSURE_WEIGHTS.momentum * saturate(vix.shortMomentumPercent) +
    PRESSURE_WEIGHTS.level * levelPressure(vix.current) +
    PRESSURE_WEIGHTS.premarketGap *
      premarketWeight *
      -saturate(underlying.premarketGapPercent);

  return round(clampSigned(score), 3);
}

/** Maps the VIX level onto [-1, 1] around the middle of the NORMAL band. */
function levelPressure(current: number | null): number {
  if (current === null) {
    return 0;
  }
  const midpoint =
    (VIX_LEVEL_THRESHOLDS.normal + VIX_LEVEL_THRESHOLDS.elevated) / 2;
  const span = VIX_LEVEL_THRESHOLDS.extreme - midpoint;
  return clampSigned((current - midpoint) / span);
}

function saturate(percent: number | null): number {
  if (percent === null) {
    return 0;
  }
  return clampSigned(percent / PRESSURE_SATURATION_PERCENT);
}

function isMaterial(percent: number | null, threshold: number): boolean {
  return percent !== null && Math.abs(percent) >= threshold;
}

function directionalPoint(
  percent: number | null,
  threshold: number,
): -1 | 0 | 1 {
  if (percent === null) {
    return 0;
  }
  if (percent >= threshold) {
    return 1;
  }
  return percent <= -threshold ? -1 : 0;
}
