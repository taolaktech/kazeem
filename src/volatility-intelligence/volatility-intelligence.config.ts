import { registerAs } from '@nestjs/config';

export const VOLATILITY_CONFIG_KEY = 'volatility';

export interface VolatilityConfig {
  /**
   * Massive ticker for the volatility reference. Cboe indices are namespaced
   * with an `I:` prefix; `VIX` alone resolves to the equity market and returns
   * nothing.
   */
  vixSymbol: string;
  /** Completed candles compared when measuring short-term VIX momentum. */
  momentumLookbackCandles: number;
  /**
   * Largest acceptable gap between the latest VIX candle and the latest
   * underlying candle before the comparison is flagged as stale.
   */
  maxStalenessMinutes: number;
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive number, received "${value}".`);
  }
  return parsed;
}

export const volatilityConfig = registerAs(
  VOLATILITY_CONFIG_KEY,
  (): VolatilityConfig => {
    return {
      vixSymbol: process.env.VIX_SYMBOL?.trim() || 'I:VIX',
      momentumLookbackCandles: readNumber(
        process.env.VIX_MOMENTUM_LOOKBACK_CANDLES,
        3,
      ),
      maxStalenessMinutes: readNumber(process.env.VIX_MAX_STALENESS_MINUTES, 6),
    };
  },
);
