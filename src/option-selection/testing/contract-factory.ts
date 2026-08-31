import type { OptionType } from '../../options-data/enums/option-type.enum.js';
import type { OptionContract } from '../../options-data/interfaces/option-contract.interface.js';

export const UNDERLYING_PRICE = 100;

export interface ContractOverrides extends Partial<OptionContract> {
  contractType?: OptionType;
}

/** Builds a fully populated, liquid, tightly quoted ATM contract by default. */
export function buildContract(
  overrides: ContractOverrides = {},
): OptionContract {
  const base: OptionContract = {
    symbol: 'O:TEST260904C00100000',
    underlyingSymbol: 'TEST',
    contractType: 'CALL',
    strikePrice: UNDERLYING_PRICE,
    expirationDate: new Date('2026-09-04T00:00:00.000Z'),
    daysToExpiration: 2,
    bid: 1.0,
    ask: 1.02,
    lastPrice: 1.01,
    midpoint: 1.01,
    bidAskSpread: 0.02,
    bidAskSpreadPercent: 1.98,
    volume: 5_000,
    openInterest: 10_000,
    impliedVolatility: 0.25,
    delta: 0.55,
    gamma: 0.05,
    theta: -0.1,
    vega: 0.08,
    underlyingPrice: UNDERLYING_PRICE,
    timestamp: new Date('2026-09-02T14:30:00.000Z'),
  };
  return { ...base, ...overrides };
}

/** Recomputes the derived quote fields so fixtures stay internally consistent. */
export function withQuote(
  bid: number | null,
  ask: number | null,
  overrides: ContractOverrides = {},
): OptionContract {
  if (bid === null || ask === null) {
    return buildContract({
      ...overrides,
      bid,
      ask,
      midpoint: null,
      bidAskSpread: null,
      bidAskSpreadPercent: null,
    });
  }
  const midpoint = (bid + ask) / 2;
  return buildContract({
    ...overrides,
    bid,
    ask,
    midpoint,
    bidAskSpread: ask - bid,
    bidAskSpreadPercent: ((ask - bid) / midpoint) * 100,
  });
}
