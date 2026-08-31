import type {
  ConflictSeverity,
  DecisionCategory,
} from '../enums/trade-decision.enum.js';
import type { DecisionConflict } from '../interfaces/component-score.interface.js';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Linear interpolation of `value` between `low` and `high`, clamped to [0, 1]. */
export function scaleBetween(value: number, low: number, high: number): number {
  if (high === low) {
    return value >= high ? 1 : 0;
  }
  return clamp01((value - low) / (high - low));
}

/**
 * `penalized` is not severity. Severity says how much a reader should care;
 * `penalized` says whether the centralized score deduction applies, and it may
 * only be true for a contradiction between components that no single component
 * score already expresses — another intelligence layer actively pointing the
 * other way from the traded direction. Weakness inside one component (thin
 * liquidity, a range-bound regime, an unsupportive structure) is already paid
 * for by that component's own earned points, so flagging it here as well would
 * charge the setup twice.
 */
export function conflict(
  category: DecisionCategory,
  code: string,
  severity: ConflictSeverity,
  description: string,
  penalized: boolean,
): DecisionConflict {
  return { category, code, severity, description, penalized };
}
