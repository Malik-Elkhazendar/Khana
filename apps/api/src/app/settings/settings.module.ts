import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoalsModule } from '../goals/goals.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule, GoalsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
