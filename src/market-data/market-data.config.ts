import { registerAs } from '@nestjs/config';

export const MASSIVE_CONFIG_KEY = 'massive';

export interface MassiveConfig {
  apiKey: string;
  restBaseUrl: string;
  requestTimeoutMs: number;
  maxPages: number;
  /** Keep only bars inside the US regular trading session (09:30–16:00 ET). */
  regularHoursOnly: boolean;
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
