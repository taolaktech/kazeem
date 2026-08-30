import type { ContractTypeFilter } from '../enums/option-type.enum.js';
import type { OptionChain } from './option-chain.interface.js';

export interface OptionChainQuery {
  /** Exact expiration day, `YYYY-MM-DD`. */
  expirationDate?: string;
  minDaysToExpiration?: number;
  maxDaysToExpiration?: number;
  /** Absolute dollar distance from the underlying price, e.g. `10` keeps 640–660 for a $650 underlying. */
  strikeRange?: number;
  contractType?: ContractTypeFilter;
  minVolume?: number;
  minOpenInterest?: number;
  maxSpreadPercent?: number;
}

/** Implemented by every options data provider adapter. */
export interface OptionDataProvider {
  getOptionChain(
    underlyingSymbol: string,
    options?: OptionChainQuery,
  ): Promise<OptionChain>;
}

/** Injection token for the active {@link OptionDataProvider}. */
export const OPTION_DATA_PROVIDER = Symbol('OPTION_DATA_PROVIDER');
