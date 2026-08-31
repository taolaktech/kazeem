/**
 * Risk environment implied by the news flow. Deliberately separate from
 * directional sentiment: an event can be clearly RISK_OFF while its direction
 * for a given instrument stays UNKNOWN.
 */
export enum MarketRiskBias {
  RISK_ON = 'RISK_ON',
  RISK_OFF = 'RISK_OFF',
  NEUTRAL = 'NEUTRAL',
  UNKNOWN = 'UNKNOWN',
}
