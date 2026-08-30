import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { filterContracts, rankByLiquidity } from './contract-filters.js';
import type { OptionType } from './enums/option-type.enum.js';
import type { OptionChain } from './interfaces/option-chain.interface.js';
import type { OptionContract } from './interfaces/option-contract.interface.js';
import {
  OPTION_DATA_PROVIDER,
  type OptionChainQuery,
  type OptionDataProvider,
} from './interfaces/option-data-provider.interface.js';

export interface LiquidContractsOptions {
  contractType?: OptionType;
  maxResults?: number;
}

const DEFAULT_MAX_LIQUID_RESULTS = 20;

/**
 * Provider-agnostic entry point for options data: fetches a chain, applies the
 * caller's filters and exposes a liquidity ranking. It never decides which
 * contract to trade — that is the future Strategy Engine's responsibility.
 */
@Injectable()
export class OptionsDataService {
  private readonly logger = new Logger(OptionsDataService.name);

  constructor(
    @Inject(OPTION_DATA_PROVIDER)
    private readonly provider: OptionDataProvider,
  ) {}

  async getOptionChain(
    underlyingSymbol: string,
    options: OptionChainQuery = {},
  ): Promise<OptionChain> {
    const symbol = underlyingSymbol.trim().toUpperCase();
    const chain = await this.provider.getOptionChain(symbol, options);

    const contracts = filterContracts(
      chain.contracts,
      options,
      chain.underlyingPrice,
    );

    if (contracts.length === 0) {
      throw new NotFoundException(
        `No option contracts found for symbol ${symbol}`,
      );
    }

    if (contracts.length < chain.contracts.length) {
      this.logger.log(
        `Filtered ${chain.contracts.length} contract(s) down to ${contracts.length} for ${symbol}`,
      );
    }

    return {
      ...chain,
      contracts,
      calls: contracts.filter((contract) => contract.contractType === 'CALL'),
      puts: contracts.filter((contract) => contract.contractType === 'PUT'),
      dataQuality: {
        ...chain.dataQuality,
        contractCount: contracts.length,
      },
    };
  }

  /**
   * Ranks the chain's contracts by liquidity and data quality (two-sided
   * quote, spread, volume, open interest, distance from the underlying price).
   * This is a data-quality ordering, not a trading recommendation.
   */
  getLiquidContracts(
    chain: OptionChain,
    options: LiquidContractsOptions = {},
  ): OptionContract[] {
    const pool =
      options.contractType === undefined
        ? chain.contracts
        : chain.contracts.filter(
            (contract) => contract.contractType === options.contractType,
          );

    return rankByLiquidity(pool, chain.underlyingPrice).slice(
      0,
      options.maxResults ?? DEFAULT_MAX_LIQUID_RESULTS,
    );
  }
}
