export enum OptionSelectionStatus {
  SELECTED = 'SELECTED',
  NO_SELECTION = 'NO_SELECTION',
}

export const MONEYNESS_LEVELS = ['ITM', 'ATM', 'OTM'] as const;

export type Moneyness = (typeof MONEYNESS_LEVELS)[number];
