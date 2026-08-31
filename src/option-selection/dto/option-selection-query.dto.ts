import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_MAX_ALTERNATIVES } from '../constants/option-selection-thresholds.js';

export class OptionSelectionQueryDto {
  /** Ranked runner-up contracts returned alongside the selection. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  maxAlternatives: number = DEFAULT_MAX_ALTERNATIVES;
}
