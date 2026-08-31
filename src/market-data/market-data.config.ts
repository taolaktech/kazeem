import { registerAs } from '@nestjs/config';

export const MASSIVE_CONFIG_KEY = 'massive';
export const MARKET_SESSION_CONFIG_KEY = 'marketSession';

export interface MassiveConfig {
  apiKey: string;
  restBaseUrl: string;
  requestTimeoutMs: number;
  maxPages: number;
  /** Keep only bars inside the US regular trading session (09:30–16:00 ET). */
  regularHoursOnly: boolean;
}

export interface MarketSessionConfig {
  /** Aggregation of the candles the regime and signal engines run on. */
  primaryTimeframeMinutes: number;
  /** Upper bound on indicator history; never a minimum before evaluating. */
  maxIndicatorCandles: number;
  /** Minutes after the 09:30 ET open during which trades are not evaluated. */
  openingSettlementMinutes: number;
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

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value.trim().toLowerCase() !== 'false';
}

export const massiveConfig = registerAs(
  MASSIVE_CONFIG_KEY,
  (): MassiveConfig => {
    return {
      apiKey: process.env.MASSIVE_API_KEY?.trim() ?? '',
      restBaseUrl: (
        process.env.MASSIVE_REST_BASE_URL?.trim() || 'https://api.massive.com'
      ).replace(/\/+$/, ''),
      requestTimeoutMs: readNumber(process.env.MASSIVE_TIMEOUT_MS, 15_000),
      maxPages: readNumber(process.env.MASSIVE_MAX_PAGES, 5),
      regularHoursOnly: readBoolean(
        process.env.MASSIVE_REGULAR_HOURS_ONLY,
        true,
      ),
    };
  },
);

export const marketSessionConfig = registerAs(
  MARKET_SESSION_CONFIG_KEY,
  (): MarketSessionConfig => {
    return {
      primaryTimeframeMinutes: readNumber(
        process.env.MARKET_PRIMARY_TIMEFRAME_MINUTES,
        3,
      ),
      maxIndicatorCandles: readNumber(
        process.env.MARKET_MAX_INDICATOR_CANDLES,
        80,
      ),
      openingSettlementMinutes: readNumber(
        process.env.OPENING_SETTLEMENT_MINUTES,
        15,
      ),
    };
  },
);
