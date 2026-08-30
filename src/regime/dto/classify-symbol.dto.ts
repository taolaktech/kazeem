import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_CANDLE_COUNT } from '../../market-data/market-data.service.js';
import { MIN_REQUIRED_CANDLES } from '../regime.constants.js';

export class ClassifySymbolQueryDto {
  /** Number of the most recent 1-minute candles to classify. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_REQUIRED_CANDLES)
  @Max(5000)
  count: number = DEFAULT_CANDLE_COUNT;
}
