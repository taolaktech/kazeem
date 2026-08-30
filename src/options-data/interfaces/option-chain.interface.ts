import type { OptionContract } from './option-contract.interface.js';

export interface OptionChainDataQuality {
  /** Contracts returned after normalization and filtering. */
  contractCount: number;
  /** Contracts discarded because the provider payload was malformed. */
  rejectedCount: number;
  warnings: string[];
}

export interface OptionChain {
  underlyingSymbol: string;
  underlyingPrice: number;
  timestamp: Date;
  contracts: OptionContract[];
  calls: OptionContract[];
  puts: OptionContract[];
  dataQuality: OptionChainDataQuality;
}
