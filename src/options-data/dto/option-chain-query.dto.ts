import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  CONTRACT_TYPE_FILTERS,
  type ContractTypeFilter,
} from '../enums/option-type.enum.js';

const MAX_DAYS_TO_EXPIRATION = 730;

export class OptionChainQueryDto {
  @IsOptional()
  @IsIn(CONTRACT_TYPE_FILTERS)
  contractType?: ContractTypeFilter;

  /** Exact expiration day, YYYY-MM-DD. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'expirationDate must be a YYYY-MM-DD date.',
  })
  expirationDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_DAYS_TO_EXPIRATION)
  minDaysToExpiration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_DAYS_TO_EXPIRATION)
  maxDaysToExpiration?: number;

  /** Absolute dollar distance from the underlying price. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  strikeRange?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minVolume?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOpenInterest?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSpreadPercent?: number;
}
