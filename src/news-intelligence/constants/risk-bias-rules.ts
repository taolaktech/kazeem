import { MarketRiskBias } from '../enums/market-risk-bias.enum.js';

export interface RiskBiasRule {
  /** Regular expression source, matched case-insensitively. */
  pattern: string;
  bias: MarketRiskBias.RISK_ON | MarketRiskBias.RISK_OFF;
  confidence: number;
  reason: string;
  /**
   * Set on rules that explicitly deny an escalation. Escalation keywords are
   * usually still present in such a headline, so matched risk-off weight is
   * halved rather than trusted at face value.
   */
  dampensEscalation?: boolean;
}

/**
 * Deterministic risk-environment rules. Each pattern encodes an escalation or
 * de-escalation event, never a bare noun: "Iran" or "war" on their own decide
 * nothing, and a story only becomes RISK_OFF when something actually escalates.
 * Risk bias is not direction — RISK_OFF never implies BEARISH by itself.
 */
export const RISK_BIAS_RULES: readonly RiskBiasRule[] = [
  {
    pattern:
      '(ceasefire|truce|peace (deal|talks))\\s*(\\w+\\s+){0,3}(collapse[sd]?|break(s|ing)? down|violated|fail(s|ed)?|ends?)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.85,
    reason: 'A ceasefire or truce broke down',
  },
  {
    pattern:
      '(strikes?|struck|air ?strikes?|bomb(s|ed|ing)|attacks?|attacked|shells?|shelling|missiles? (fired|launched|hit)|drone (attack|strike))\\s*(\\w+\\s+){0,4}(iran|israel|russia|ukraine|houthi|hezbollah|taiwan|launchers?|targets?|bases?|facilit|infrastructure|ports?|tankers?|refiner)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.9,
    reason: 'Military escalation detected',
  },
  {
    pattern:
      '(invasion|invades?|invaded|declares? war|state of war|mobili[sz]es? troops|deploys? troops|blockade[sd]?|seizes? (a )?tanker)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.85,
    reason: 'Armed conflict or blockade escalation detected',
  },
  {
    pattern:
      '(strait of hormuz|suez canal|red sea shipping)\\s*(\\w+\\s+){0,6}(clos(e|ed|ure)|block|blocked|disrupt|attack|strike|threat)|(clos(e|ed|ure)|block|blocked|disrupt(ed|ion)?|attack|strike)\\s*(\\w+\\s+){0,6}(strait of hormuz|suez canal|red sea shipping)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.9,
    reason: 'A critical energy shipping route is under threat',
  },
  {
    pattern:
      '(oil|crude|brent|wti|natural gas)\\s*(\\w+\\s+){0,4}(jump|jumps|surge|surges|spike|spikes|soars?|rallies)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.55,
    reason: 'An energy price shock raises input-cost and inflation risk',
  },
  {
    pattern:
      '(bank (failure|collapse|run)|deposit flight|credit crunch|liquidity crisis|contagion|bailout|files for bankruptcy|defaults? on)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.85,
    reason: 'Banking or credit stress detected',
  },
  {
    pattern:
      '(stocks?|equities|markets?|wall street|futures)\\s*(\\w+\\s+){0,3}(tumble|tumbles|plunge|plunges|slump|slumps|sink|sinks|sell-?off|slide|slides)|market (selloff|sell-off|rout)|flight to (safety|quality)|haven demand|volatility (spike|surge)|vix (spike|surges|jumps)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.65,
    reason: 'Broad de-risking is already visible in markets',
  },
  {
    pattern:
      '(new|fresh|higher|additional)\\s+tariffs|tariffs?\\s+(imposed|raised|hiked|threatened)|sanctions?\\s+(imposed|expanded|escalat\\w+|tightened)|export (controls|ban)\\s+(imposed|expanded|tightened)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.6,
    reason: 'Trade or sanctions escalation raises macro uncertainty',
  },
  {
    pattern:
      '(inflation|cpi|ppi)\\s*(\\w+\\s+){0,5}(hotter|accelerat\\w+|tops (forecasts|estimates|expectations)|rises more than expected)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.5,
    reason: 'A hotter inflation print tightens financial conditions',
  },
  {
    pattern:
      '(fed|federal reserve|fomc)\\s*(\\w+\\s+){0,6}(hikes?|raises?)\\s+(interest\\s+)?rates|hawkish (surprise|shift|tone|pivot)',
    bias: MarketRiskBias.RISK_OFF,
    confidence: 0.6,
    reason: 'Hawkish policy tightens financial conditions',
  },
  {
    pattern:
      '(ceasefire|truce|peace (deal|agreement)|de-?escalat\\w+)\\s*(\\w+\\s+){0,4}(reached|agreed|signed|announced|holds?|takes effect)|(withdraws?|pulls? back)\\s+(its\\s+)?troops|(tensions?|conflict)\\s+(ease[sd]?|cool(s|ed)?|de-?escalat\\w+)',
    bias: MarketRiskBias.RISK_ON,
    confidence: 0.7,
    reason: 'Geopolitical de-escalation reduces uncertainty',
  },
  {
    pattern:
      "(sees? no|do(es)?\\s*n'?\\s*t\\s+(see|expect)|do(es)? not (see|expect)|rules? out|no sign of|plays? down)\\s+(an?\\s+)?(imminent\\s+)?(attack|escalation|invasion|strike|war)",
    bias: MarketRiskBias.RISK_ON,
    confidence: 0.45,
    dampensEscalation: true,
    reason: 'Escalation risk was explicitly played down',
  },
  {
    pattern:
      '(fed|federal reserve|fomc)\\s*(\\w+\\s+){0,6}(cuts?|lowers?)\\s+(interest\\s+)?rates|dovish (surprise|shift|tone|pivot)',
    bias: MarketRiskBias.RISK_ON,
    confidence: 0.65,
    reason: 'Policy easing loosens financial conditions',
  },
  {
    pattern:
      '(inflation|cpi|ppi|price growth)\\s*(\\w+\\s+){0,5}(cools?|cooled|ease[sd]?|slow(s|ed)?)',
    bias: MarketRiskBias.RISK_ON,
    confidence: 0.55,
    reason: 'Cooling inflation loosens financial conditions',
  },
  {
    pattern:
      'tariffs?\\s+(paused|delayed|lifted|scrapped|rolled back)|trade deal\\s+(reached|agreed|signed)|sanctions?\\s+(lifted|eased)',
    bias: MarketRiskBias.RISK_ON,
    confidence: 0.55,
    reason: 'Trade tension easing removes a macro headwind',
  },
  {
    pattern:
      '(stocks?|equities|markets?|wall street)\\s*(\\w+\\s+){0,3}(rally|rallies|surge|surges|jump|jumps|climb|climbs)|record (high|highs)|risk appetite (returns|improves)',
    bias: MarketRiskBias.RISK_ON,
    confidence: 0.5,
    reason: 'Broad risk appetite is already visible in markets',
  },
  {
    pattern:
      '(oil|crude|brent|wti)\\s*(\\w+\\s+){0,4}(tumble|tumbles|slide|slides|plunge|plunges|fall back)',
    bias: MarketRiskBias.RISK_ON,
    confidence: 0.4,
    reason: 'Falling energy prices ease inflation pressure',
  },
];

/** Gap below which competing risk narratives are treated as unresolved. */
export const RISK_BIAS_CONFLICT_SPREAD = 0.2;
