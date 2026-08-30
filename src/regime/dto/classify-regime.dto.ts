import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class MarketCandleDto {
  @IsDateString()
  timestamp: string;

  @IsNumber()
  @IsPositive()
  open: number;

  @IsNumber()
  @IsPositive()
  high: number;

  @IsNumber()
  @IsPositive()
  low: number;

  @IsNumber()
  @IsPositive()
  close: number;

  @IsNumber()
  @Min(0)
  volume: number;
}

export class ClassifyRegimeDto {
  @IsString()
  @Length(1, 16)
  symbol: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarketCandleDto)
  candles: MarketCandleDto[];
}
