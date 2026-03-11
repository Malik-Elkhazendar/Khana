import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Inclusive start of the analytics window in ISO-8601 format.',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    description: 'Inclusive end of the analytics window in ISO-8601 format.',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({
    description: 'Optional facility filter for analytics endpoints.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional({
    description: 'IANA timezone used for analytics bucketing and formatting.',
    example: 'Asia/Riyadh',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timeZone?: string;
}
