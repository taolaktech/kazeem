import { CatalystType } from '../enums/catalyst-type.enum.js';

export interface SymbolContext {
  symbol: string;
  /** Human label used in reasoning strings. */
  label: string;
  /** True for broad index proxies, where macro news is directly relevant. */
  broadMarket: boolean;
  /** Phrases that tie a story to this symbol's theme. */
  themes: readonly string[];
  /** Catalysts that historically move this symbol. */
  catalysts: readonly CatalystType[];
}

const MACRO_CORE: readonly CatalystType[] = [
  CatalystType.FEDERAL_RESERVE,
  CatalystType.INTEREST_RATES,
  CatalystType.INFLATION,
  CatalystType.CPI,
  CatalystType.PPI,
  CatalystType.JOBS,
  CatalystType.GDP,
  CatalystType.TREASURY_YIELDS,
];

/**
 * Per-symbol context. Any symbol without an entry still works through the
 * generic profile plus direct-mention relevance, so nothing is hardwired to
 * these ETFs.
 */
export const SYMBOL_CONTEXTS: Readonly<Record<string, SymbolContext>> = {
  SPY: {
    symbol: 'SPY',
    label: 'S&P 500',
    broadMarket: true,
    themes: [
      's&p 500',
      'sp 500',
      'broad market',
      'stock market',
      'wall street',
      'equities',
      'us stocks',
      'index futures',
      'mega-cap',
      'megacap',
    ],
    catalysts: [
      ...MACRO_CORE,
      CatalystType.GEOPOLITICAL,
      CatalystType.TARIFFS,
      CatalystType.MARKET_MOVING,
    ],
  },
  QQQ: {
    symbol: 'QQQ',
    label: 'Nasdaq 100',
    broadMarket: true,
    themes: [
      'nasdaq',
      'technology stocks',
      'tech stocks',
      'big tech',
      'artificial intelligence',
      'semiconductor',
      'chip',
      'nvidia',
      'microsoft',
      'apple',
      'amazon',
      'meta',
      'alphabet',
      'google',
      'broadcom',
      'tesla',
    ],
    catalysts: [
      CatalystType.FEDERAL_RESERVE,
      CatalystType.INTEREST_RATES,
      CatalystType.INFLATION,
      CatalystType.TREASURY_YIELDS,
      CatalystType.SEMICONDUCTORS,
      CatalystType.AI,
      CatalystType.EARNINGS,
      CatalystType.MARKET_MOVING,
    ],
  },
  IWM: {
    symbol: 'IWM',
    label: 'Russell 2000',
    broadMarket: true,
    themes: [
      'russell 2000',
      'small cap',
      'small caps',
      'small-cap',
      'regional bank',
      'regional banks',
      'credit conditions',
      'domestic economy',
    ],
    catalysts: [...MACRO_CORE, CatalystType.CREDIT, CatalystType.MARKET_MOVING],
  },
};

/** Tickers that carry an index on their own, used for entity relevance. */
export const SYMBOL_ENTITY_ALIASES: Readonly<
  Record<string, readonly string[]>
> = {
  NVDA: ['nvidia'],
  MSFT: ['microsoft'],
  AAPL: ['apple'],
  AMZN: ['amazon'],
  META: ['meta platforms', 'facebook'],
  GOOGL: ['alphabet', 'google'],
  GOOG: ['alphabet', 'google'],
  AVGO: ['broadcom'],
  TSLA: ['tesla'],
  SPY: ['s&p 500', 'spdr s&p 500'],
  QQQ: ['nasdaq 100', 'nasdaq-100', 'invesco qqq'],
  IWM: ['russell 2000', 'ishares russell 2000'],
};

/** Mega-caps whose news carries index-level weight for QQQ and SPY. */
export const INDEX_HEAVYWEIGHTS: Readonly<Record<string, readonly string[]>> = {
  QQQ: [
    'NVDA',
    'MSFT',
    'AAPL',
    'AMZN',
    'META',
    'GOOGL',
    'GOOG',
    'AVGO',
    'TSLA',
  ],
  SPY: [
    'NVDA',
    'MSFT',
    'AAPL',
    'AMZN',
    'META',
    'GOOGL',
    'GOOG',
    'AVGO',
    'BRK.B',
    'JPM',
  ],
};

const GENERIC_CONTEXT: SymbolContext = {
  symbol: '',
  label: '',
  broadMarket: false,
  themes: [],
  catalysts: [
    CatalystType.EARNINGS,
    CatalystType.GUIDANCE,
    CatalystType.ANALYST_UPGRADE,
    CatalystType.ANALYST_DOWNGRADE,
    CatalystType.REGULATORY,
    CatalystType.MERGER_ACQUISITION,
  ],
};

export function getSymbolContext(symbol: string): SymbolContext {
  const upper = symbol.toUpperCase();
  const configured = SYMBOL_CONTEXTS[upper];
  if (configured) {
    return configured;
  }
  return {
    ...GENERIC_CONTEXT,
    symbol: upper,
    label: upper,
    themes: SYMBOL_ENTITY_ALIASES[upper] ?? [],
  };
}
