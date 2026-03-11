import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';

const ALLOWED_GROUP_BY = ['day', 'week', 'month'] as const;

export class RevenueQueryDto extends AnalyticsQueryDto {
  @ApiProperty({
    description: 'Grouping interval used for the revenue trend response.',
    enum: ALLOWED_GROUP_BY,
    example: 'day',
  })
  @IsIn(ALLOWED_GROUP_BY)
  groupBy!: 'day' | 'week' | 'month';
}
