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

export function conflict(
  category: DecisionCategory,
  code: string,
  severity: ConflictSeverity,
  description: string,
  penalized: boolean,
): DecisionConflict {
  return { category, code, severity, description, penalized };
}
