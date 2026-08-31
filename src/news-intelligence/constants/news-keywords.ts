import { CatalystType } from '../enums/catalyst-type.enum.js';
import { NewsSentiment } from '../enums/news-sentiment.enum.js';

/**
 * Phrases that identify a catalyst. Matching is case-insensitive and anchored
 * on word boundaries, so `ai` never matches `said`.
 */
export const CATALYST_KEYWORDS: Record<CatalystType, readonly string[]> = {
  [CatalystType.FEDERAL_RESERVE]: [
    'federal reserve',
    'fed',
    'fed chair',
    'fed officials',
    'fed minutes',
    'fomc',
    'powell',
    'rate decision',
    'dot plot',
  ],
  [CatalystType.INTEREST_RATES]: [
    'interest rate',
    'interest rates',
    'rate cut',
    'rate cuts',
    'rate hike',
    'rate hikes',
    'basis points',
    'monetary policy',
    'fed funds',
  ],
  [CatalystType.INFLATION]: [
    'inflation',
    'disinflation',
    'price pressures',
    'core prices',
  ],
  [CatalystType.CPI]: ['cpi', 'consumer price index', 'consumer prices'],
  [CatalystType.PPI]: ['ppi', 'producer price index', 'producer prices'],
  [CatalystType.JOBS]: [
    'jobs report',
    'nonfarm payrolls',
    'non-farm payrolls',
    'payrolls',
    'unemployment',
    'jobless claims',
    'labor market',
    'hiring',
    'layoffs',
  ],
  [CatalystType.GDP]: ['gdp', 'gross domestic product', 'economic growth'],
  [CatalystType.TREASURY_YIELDS]: [
    'treasury yield',
    'treasury yields',
    'bond yields',
    '10-year yield',
    '2-year yield',
    'yield curve',
    'treasuries',
  ],
  [CatalystType.EARNINGS]: [
    'earnings',
    'quarterly results',
    'q1 results',
    'q2 results',
    'q3 results',
    'q4 results',
    'revenue',
    'eps',
  ],
  [CatalystType.GUIDANCE]: [
    'guidance',
    'outlook',
    'forecast',
    'raises forecast',
    'cuts forecast',
  ],
  [CatalystType.ANALYST_UPGRADE]: [
    'upgraded',
    'upgrades',
    'upgrade to buy',
    'raises price target',
    'price target raised',
    'initiated at buy',
  ],
  [CatalystType.ANALYST_DOWNGRADE]: [
    'downgraded',
    'downgrades',
    'downgrade to sell',
    'cuts price target',
    'price target cut',
    'initiated at sell',
  ],
  [CatalystType.SEMICONDUCTORS]: [
    'semiconductor',
    'semiconductors',
    'chipmaker',
    'chipmakers',
    'chip stocks',
    'chips',
    'foundry',
    'gpu',
    'gpus',
  ],
  [CatalystType.AI]: [
    'artificial intelligence',
    'ai spending',
    'ai demand',
    'ai chips',
    'ai capex',
    'data center',
    'data centers',
    'large language model',
  ],
  [CatalystType.REGULATORY]: [
    'regulator',
    'regulators',
    'regulatory',
    'sec probe',
    'ftc',
    'antitrust',
    'investigation',
    'export controls',
    'sanctions',
  ],
  [CatalystType.LEGAL]: [
    'lawsuit',
    'court',
    'judge',
    'settlement',
    'verdict',
    'appeal',
    'indictment',
  ],
  [CatalystType.MERGER_ACQUISITION]: [
    'acquisition',
    'acquires',
    'to buy',
    'merger',
    'takeover',
    'buyout',
    'deal to acquire',
    'stake in',
  ],
  [CatalystType.GEOPOLITICAL]: [
    'war',
    'invasion',
    'missile',
    'strikes',
    'ceasefire',
    'military',
    'conflict escalates',
    'middle east',
    'taiwan',
    'north korea',
    'opec',
  ],
  [CatalystType.TARIFFS]: [
    'tariff',
    'tariffs',
    'trade war',
    'trade deal',
    'import duties',
    'trade talks',
  ],
  [CatalystType.ENERGY]: [
    'oil prices',
    'crude',
    'brent',
    'wti',
    'natural gas',
    'energy prices',
    'gasoline prices',
  ],
  [CatalystType.CREDIT]: [
    'credit conditions',
    'credit crunch',
    'loan losses',
    'bank failure',
    'regional banks',
    'default',
    'delinquencies',
    'lending standards',
  ],
  [CatalystType.MARKET_MOVING]: [
    'stocks tumble',
    'stocks plunge',
    'stocks surge',
    'stocks rally',
    'market selloff',
    'sell-off',
    'record high',
    'correction',
    'circuit breaker',
    'volatility spike',
  ],
  [CatalystType.OTHER]: [],
};

/** Phrases indicating a story is about the broad tape rather than one issuer. */
export const MARKET_WIDE_KEYWORDS: readonly string[] = [
  's&p 500',
  'sp 500',
  'nasdaq',
  'dow jones',
  'russell 2000',
  'wall street',
  'stock market',
  'stocks',
  'equities',
  'index futures',
  'vix',
];

export interface SentimentRule {
  /** Regular expression source, matched case-insensitively. */
  pattern: string;
  direction: NewsSentiment.BULLISH | NewsSentiment.BEARISH;
  confidence: number;
  reason: string;
}

/**
 * Deterministic phrase rules. Each entry encodes a full implication, never a
 * bare direction word, because "stocks rise as investors fear a slowdown"
 * cannot be read from "rise" alone. Anything not covered stays UNKNOWN.
 */
export const SENTIMENT_RULES: readonly SentimentRule[] = [
  {
    pattern: 'beats?\\s+(on\\s+)?(earnings|estimates|expectations|revenue)',
    direction: NewsSentiment.BULLISH,
    confidence: 0.7,
    reason: 'Results came in above expectations',
  },
  {
    pattern: 'misses?\\s+(on\\s+)?(earnings|estimates|expectations|revenue)',
    direction: NewsSentiment.BEARISH,
    confidence: 0.7,
    reason: 'Results came in below expectations',
  },
  {
    pattern:
      '(raises|lifts|boosts|hikes)\\s+(its\\s+)?(guidance|outlook|forecast|target)',
    direction: NewsSentiment.BULLISH,
    confidence: 0.65,
    reason: 'Guidance was raised',
  },
  {
    pattern:
      '(cuts|lowers|slashes|trims)\\s+(its\\s+)?(guidance|outlook|forecast)',
    direction: NewsSentiment.BEARISH,
    confidence: 0.65,
    reason: 'Guidance was cut',
  },
  {
    pattern: '(upgraded|upgrade)\\s+(to|at)\\s+(buy|outperform|overweight)',
    direction: NewsSentiment.BULLISH,
    confidence: 0.5,
    reason: 'Analyst upgrade',
  },
  {
    pattern:
      '(downgraded|downgrade)\\s+(to|at)\\s+(sell|underperform|underweight|hold)',
    direction: NewsSentiment.BEARISH,
    confidence: 0.5,
    reason: 'Analyst downgrade',
  },
  {
    pattern:
      '(fed|federal reserve|fomc)[^.]{0,40}(cuts?|lowers?)\\s+(interest\\s+)?rates',
    direction: NewsSentiment.BULLISH,
    confidence: 0.6,
    reason: 'Policy easing supports equity valuations',
  },
  {
    pattern:
      '(fed|federal reserve|fomc)[^.]{0,40}(raises?|hikes?)\\s+(interest\\s+)?rates',
    direction: NewsSentiment.BEARISH,
    confidence: 0.6,
    reason: 'Policy tightening pressures equity valuations',
  },
  {
    pattern:
      '(inflation|cpi|ppi|price growth)[^.]{0,40}(cools|cooled|eases|eased|slows|slowed)',
    direction: NewsSentiment.BULLISH,
    confidence: 0.55,
    reason: 'Softer inflation supports rate-cut expectations',
  },
  {
    pattern:
      '(inflation|cpi|ppi|price growth)[^.]{0,40}(hotter|hot|accelerates|accelerated|rises more than expected|tops (forecasts|estimates|expectations))',
    direction: NewsSentiment.BEARISH,
    confidence: 0.55,
    reason: 'Hotter inflation pressures rate-cut expectations',
  },
  {
    pattern:
      '(inflation|cpi|ppi)[^.]{0,40}(falls|fell|declines?)\\s+less than expected',
    direction: NewsSentiment.BEARISH,
    confidence: 0.5,
    reason: 'Inflation cooled less than expected',
  },
  {
    pattern:
      '(treasury )?yields?[^.]{0,30}(surge|surges|spike|spikes|jump|jumps)',
    direction: NewsSentiment.BEARISH,
    confidence: 0.45,
    reason: 'Rising yields weigh on equity valuations',
  },
  {
    pattern:
      '(treasury )?yields?[^.]{0,30}(tumble|tumbles|slide|slides|fall back|retreat)',
    direction: NewsSentiment.BULLISH,
    confidence: 0.4,
    reason: 'Falling yields support equity valuations',
  },
  {
    pattern:
      '(new|fresh|higher)\\s+tariffs|tariffs?\\s+(imposed|raised|hiked|threatened)',
    direction: NewsSentiment.BEARISH,
    confidence: 0.5,
    reason: 'Tariff escalation is a growth and margin headwind',
  },
  {
    pattern:
      'tariffs?\\s+(paused|delayed|lifted|scrapped|rolled back)|trade deal (reached|agreed|signed)',
    direction: NewsSentiment.BULLISH,
    confidence: 0.5,
    reason: 'Trade tension easing removes a growth headwind',
  },
  {
    pattern:
      '(agrees to|to)\\s+(be\\s+)?acquire[sd]?|takeover bid|buyout offer',
    direction: NewsSentiment.BULLISH,
    confidence: 0.4,
    reason: 'Acquisition activity',
  },
  {
    pattern: 'files for bankruptcy|bank failure|credit crunch|defaults? on',
    direction: NewsSentiment.BEARISH,
    confidence: 0.6,
    reason: 'Credit or solvency stress',
  },
  {
    pattern:
      '(payrolls|jobs report|hiring)[^.]{0,40}(beats?|tops|stronger than expected|surges?)',
    direction: NewsSentiment.BULLISH,
    confidence: 0.4,
    reason: 'Stronger labour data points to resilient growth',
  },
  {
    pattern:
      '(payrolls|jobs report|hiring)[^.]{0,40}(misses?|weaker than expected|slumps?|disappoints?)',
    direction: NewsSentiment.BEARISH,
    confidence: 0.4,
    reason: 'Weaker labour data points to slowing growth',
  },
];
