import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '@khana/data-access';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { GoalsModule } from '../goals/goals.module';

@Module({
  imports: [GoalsModule, TypeOrmModule.forFeature([Tenant])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
