import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_ARTICLE_LIMIT,
  DEFAULT_LOOKBACK_HOURS,
  MAX_ARTICLE_LIMIT,
  MAX_LOOKBACK_HOURS,
} from '../constants/news-intelligence-thresholds.js';

export class NewsIntelligenceQueryDto {
  /** How far back to look for news, in hours. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK_HOURS)
  lookbackHours: number = DEFAULT_LOOKBACK_HOURS;

  /** Maximum number of ranked articles returned. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ARTICLE_LIMIT)
  limit: number = DEFAULT_ARTICLE_LIMIT;
}
