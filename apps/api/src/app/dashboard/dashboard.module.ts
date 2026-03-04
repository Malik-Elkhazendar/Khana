import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking, WaitingListEntry } from '@khana/data-access';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Booking, WaitingListEntry])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
