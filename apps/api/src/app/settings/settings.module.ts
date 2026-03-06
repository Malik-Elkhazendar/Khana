import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '@khana/data-access';
import { AuthModule } from '../auth/auth.module';
import { GoalsModule } from '../goals/goals.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule, GoalsModule, TypeOrmModule.forFeature([Tenant])],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
