import { IsIn } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';

const ALLOWED_GROUP_BY = ['day', 'week', 'month'] as const;

export class RevenueQueryDto extends AnalyticsQueryDto {
  @IsIn(ALLOWED_GROUP_BY)
  groupBy!: 'day' | 'week' | 'month';
}
