import { registerAs } from '@nestjs/config';

export const NEWS_CONFIG_KEY = 'news';

export interface NewsConfig {
  /** Toggle for the Seeking Alpha RSS provider. */
  seekingAlphaEnabled: boolean;
  seekingAlphaBaseUrl: string;
  requestTimeoutMs: number;
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

export const newsConfig = registerAs(NEWS_CONFIG_KEY, (): NewsConfig => {
  return {
    seekingAlphaEnabled: readBoolean(
      process.env.SEEKING_ALPHA_RSS_ENABLED,
      true,
    ),
    seekingAlphaBaseUrl: (
      process.env.SEEKING_ALPHA_BASE_URL?.trim() || 'https://seekingalpha.com'
    ).replace(/\/+$/, ''),
    requestTimeoutMs: readNumber(process.env.NEWS_TIMEOUT_MS, 8_000),
  };
});
