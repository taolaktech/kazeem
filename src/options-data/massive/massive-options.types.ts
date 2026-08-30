/**
 * Shapes returned by the Massive options chain snapshot endpoint
 * (`GET /v3/snapshot/options/{underlyingAsset}`). All fields are optional
 * because availability depends on the account plan: quotes, trades, greeks and
 * implied volatility are omitted on plans that do not include them, and greeks
 * are also omitted for some contracts (e.g. deep in the money).
 */
export interface MassiveOptionSnapshot {
  break_even_price?: number;
  day?: {
    close?: number;
    high?: number;
    low?: number;
    open?: number;
    volume?: number;
    vwap?: number;
    last_updated?: number;
  };
  details?: {
    contract_type?: string;
    exercise_style?: string;
    expiration_date?: string;
    shares_per_contract?: number;
    strike_price?: number;
    ticker?: string;
  };
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  /** Decimal fraction: 0.25 means 25%. */
  implied_volatility?: number;
  last_quote?: {
    ask?: number;
    ask_size?: number;
    bid?: number;
    bid_size?: number;
    midpoint?: number;
    last_updated?: number;
    timeframe?: string;
  };
  last_trade?: {
    price?: number;
    size?: number;
    sip_timestamp?: number;
    timeframe?: string;
  };
  open_interest?: number;
  underlying_asset?: {
    price?: number;
    ticker?: string;
    last_updated?: number;
    timeframe?: string;
  };
}

export interface MassiveOptionChainResponse {
  status?: string;
  request_id?: string;
  results?: MassiveOptionSnapshot[];
  next_url?: string;
}

export function isMassiveOptionChainResponse(
  value: unknown,
): value is MassiveOptionChainResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.results === undefined || Array.isArray(candidate.results);
}
