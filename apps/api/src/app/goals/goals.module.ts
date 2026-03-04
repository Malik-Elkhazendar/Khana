import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Booking,
  Facility,
  GoalMilestone,
  Tenant,
} from '@khana/data-access';
import { GoalsService } from './goals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Booking,
      Facility,
      GoalMilestone,
      AuditLog,
    ]),
  ],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
