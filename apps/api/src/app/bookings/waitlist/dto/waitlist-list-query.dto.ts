import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { WaitlistStatus } from '@khana/shared-dtos';

export class WaitlistListQueryDto {
  @ApiProperty({
    description: 'Inclusive start of the reporting window in ISO-8601 format.',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  from!: string;

  @ApiProperty({
    description: 'Inclusive end of the reporting window in ISO-8601 format.',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsNotEmpty()
  to!: string;

  @ApiPropertyOptional({
    description: 'Optional facility filter for the waitlist list.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional({
    description: 'Optional waitlist status filter.',
    enum: WaitlistStatus,
  })
  @IsOptional()
  @IsEnum(WaitlistStatus)
  status?: WaitlistStatus;

  @ApiPropertyOptional({
    description: 'Page number for the paginated waitlist list.',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size for the paginated waitlist list.',
    minimum: 1,
    maximum: 100,
    example: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
