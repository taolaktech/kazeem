import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MIN_REQUIRED_CANDLES } from '../regime.constants.js';

export class ClassifySymbolQueryDto {
  /**
   * Maximum number of primary-timeframe candles used for indicator history.
   * It caps the warm-up window; it is never a number of current-session
   * candles the classifier waits for. Defaults to the configured maximum.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_REQUIRED_CANDLES)
  @Max(5000)
  count?: number;
}
