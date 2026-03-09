import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, Facility } from '@khana/data-access';
import { AuthModule } from '../auth/auth.module';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';
import { FacilitiesMutationService } from './internal/facilities.mutation.service';
import { FacilitiesQueryService } from './internal/facilities.query.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Facility, AuditLog])],
  controllers: [FacilitiesController],
  providers: [
    FacilitiesService,
    FacilitiesQueryService,
    FacilitiesMutationService,
  ],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
