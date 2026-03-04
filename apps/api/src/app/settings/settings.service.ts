import { Injectable } from '@nestjs/common';
import { User } from '@khana/data-access';
import {
  GoalSettingsResponseDto,
  UpdateGoalsRequestDto,
} from '@khana/shared-dtos';
import { GoalsService } from '../goals/goals.service';

@Injectable()
export class SettingsService {
  constructor(private readonly goalsService: GoalsService) {}

  getGoals(tenantId: string): Promise<GoalSettingsResponseDto> {
    return this.goalsService.getGoalSettings(tenantId);
  }

  updateGoals(
    tenantId: string,
    dto: UpdateGoalsRequestDto,
    actor: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<GoalSettingsResponseDto> {
    return this.goalsService.updateGoalSettings(
      tenantId,
      dto,
      actor,
      ipAddress,
      userAgent
    );
  }
}
