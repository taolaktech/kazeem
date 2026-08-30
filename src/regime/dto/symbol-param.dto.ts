import { Matches } from 'class-validator';

export class SymbolParamDto {
  /** Ticker symbol, e.g. SPY, QQQ, BRK.B. */
  @Matches(/^[A-Za-z][A-Za-z0-9.-]{0,9}$/, {
    message: 'symbol must be a valid ticker.',
  })
  symbol: string;
}
