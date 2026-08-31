import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';
import { MAX_ACCEPTED_BUDGET } from '../../option-selection/constants/option-selection-thresholds.js';

export class TradeDecisionQueryDto {
  /**
   * Hard cap, in dollars, on the total premium of one contract position. It is
   * forwarded to option selection, which owns the affordability filter.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_ACCEPTED_BUDGET)
  maxBudget!: number;
}
