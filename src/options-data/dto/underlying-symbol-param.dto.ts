import { Matches } from 'class-validator';

export class UnderlyingSymbolParamDto {
  /** Underlying ticker symbol, e.g. SPY, QQQ, NVDA. */
  @Matches(/^[A-Za-z][A-Za-z0-9.-]{0,9}$/, {
    message: 'symbol must be a valid ticker.',
  })
  symbol: string;
}
