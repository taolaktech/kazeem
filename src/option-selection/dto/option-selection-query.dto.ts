import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_MAX_ALTERNATIVES,
  MAX_ACCEPTED_BUDGET,
} from '../constants/option-selection-thresholds.js';

export class OptionSelectionQueryDto {
  /** Hard cap, in dollars, on the total premium of one contract position. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_ACCEPTED_BUDGET)
  maxBudget!: number;

  /** Ranked runner-up contracts returned alongside the selection. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  maxAlternatives: number = DEFAULT_MAX_ALTERNATIVES;
}
