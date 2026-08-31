import type { OptionContract } from '../options-data/interfaces/option-contract.interface.js';
import { CONTRACT_MULTIPLIER } from './constants/option-selection-thresholds.js';

export const PREMIUM_PRICE_SOURCES = [
  'ASK',
  'MIDPOINT',
  'LAST_PRICE',
  'UNAVAILABLE',
] as const;

export type PremiumPriceSource = (typeof PREMIUM_PRICE_SOURCES)[number];

export interface PremiumPricing {
  premiumPriceUsed: number | null;
  premiumPriceSource: PremiumPriceSource;
  /** Premium × contract multiplier, i.e. what one position actually costs. */
  estimatedContractCost: number | null;
}

/**
 * Resolves the premium a buyer would pay, preferring the price they would
 * actually be filled at. A missing price is never treated as affordable.
 */
export function resolvePremium(contract: OptionContract): PremiumPricing {
  const source = priceSourceOf(contract);
  const premium = source === null ? null : source.price;
  return {
    premiumPriceUsed: premium,
    premiumPriceSource: source?.origin ?? 'UNAVAILABLE',
    estimatedContractCost:
      premium === null ? null : round(premium * CONTRACT_MULTIPLIER),
  };
}

export function isWithinBudget(
  pricing: PremiumPricing,
  maxBudget: number,
): boolean {
  return (
    pricing.estimatedContractCost !== null &&
    pricing.estimatedContractCost <= maxBudget
  );
}

function priceSourceOf(
  contract: OptionContract,
): { price: number; origin: PremiumPriceSource } | null {
  if (isUsable(contract.ask)) {
    return { price: contract.ask, origin: 'ASK' };
  }
  if (isUsable(contract.midpoint)) {
    return { price: contract.midpoint, origin: 'MIDPOINT' };
  }
  if (isUsable(contract.lastPrice)) {
    return { price: contract.lastPrice, origin: 'LAST_PRICE' };
  }
  return null;
}

function isUsable(price: number | null): price is number {
  return price !== null && Number.isFinite(price) && price > 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
