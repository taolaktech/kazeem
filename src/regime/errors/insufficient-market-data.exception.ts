import { UnprocessableEntityException } from '@nestjs/common';
import { MIN_REQUIRED_CANDLES } from '../regime.constants.js';

export interface InsufficientMarketDataDetails {
  symbol: string;
  candleCount: number;
  sufficientData: false;
  minimumRequiredCandles: number;
  warnings: string[];
}

/** Raised instead of emitting a classification the data cannot support. */
export class InsufficientMarketDataException extends UnprocessableEntityException {
  constructor(symbol: string, candleCount: number, warnings: string[]) {
    const details: InsufficientMarketDataDetails = {
      symbol,
      candleCount,
      sufficientData: false,
      minimumRequiredCandles: MIN_REQUIRED_CANDLES,
      warnings,
    };
    super({
      message: `Insufficient market data for ${symbol}: ${candleCount} candles provided, at least ${MIN_REQUIRED_CANDLES} required.`,
      error: 'InsufficientMarketData',
      details,
    });
  }
}
