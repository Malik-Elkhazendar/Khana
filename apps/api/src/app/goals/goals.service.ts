import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog, GoalMilestone, Tenant, User } from '@khana/data-access';
import {
  GoalMilestoneDto,
  GoalProgressDto,
  GoalSettingsResponseDto,
  UpdateGoalsRequestDto,
} from '@khana/shared-dtos';
import { DataSource, Repository } from 'typeorm';
import { AppLoggerService } from '../logging';
import { GoalsDependencies } from './internal/goals.internal';
import {
  getGoalProgressWorkflow,
  getGoalSettingsWorkflow,
  listMilestonesWorkflow,
} from './internal/goals.query';
import {
  syncMilestonesForCurrentMonthWorkflow,
  updateGoalSettingsWorkflow,
} from './internal/goals.sync';

@Injectable()
export class GoalsService {
  private readonly deps: GoalsDependencies;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(GoalMilestone)
    private readonly goalMilestoneRepository: Repository<GoalMilestone>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly appLogger: AppLoggerService
  ) {
    this.deps = {
      tenantRepository,
      goalMilestoneRepository,
      auditLogRepository,
      dataSource,
      appLogger,
    };
  }

  async getGoalSettings(tenantId: string): Promise<GoalSettingsResponseDto> {
    return getGoalSettingsWorkflow(this.deps, tenantId);
  }

  async updateGoalSettings(
    tenantId: string,
    dto: UpdateGoalsRequestDto,
    actor: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<GoalSettingsResponseDto> {
    return updateGoalSettingsWorkflow(
      this.deps,
      tenantId,
      dto,
      actor,
      ipAddress,
      userAgent
    );
  }

  async getGoalProgress(
    tenantId: string,
    timeZone?: string
  ): Promise<GoalProgressDto> {
    return getGoalProgressWorkflow(this.deps, tenantId, timeZone);
  }

  async listMilestones(
    tenantId: string,
    limit = 6
  ): Promise<GoalMilestoneDto[]> {
    return listMilestonesWorkflow(this.deps, tenantId, limit);
  }

  async syncMilestonesForCurrentMonth(
    tenantId: string,
    timeZone?: string
  ): Promise<void> {
    return syncMilestonesForCurrentMonthWorkflow(this.deps, tenantId, timeZone);
  }
}
