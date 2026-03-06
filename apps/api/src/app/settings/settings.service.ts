import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Tenant, User } from '@khana/data-access';
import {
  DEFAULT_TENANT_TIMEZONE,
  GoalSettingsResponseDto,
  TenantSettingsResponseDto,
  UpdateTenantSettingsRequestDto,
  UpdateGoalsRequestDto,
} from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { GoalsService } from '../goals/goals.service';

const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly goalsService: GoalsService
  ) {}

  async getSettings(tenantId: string): Promise<TenantSettingsResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const tenant = await this.tenantRepository.findOne({
      where: { id: resolvedTenantId },
      select: ['id', 'timezone', 'updatedAt'],
    });

    if (!tenant) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    return {
      timezone: tenant.timezone || DEFAULT_TENANT_TIMEZONE,
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }

  getGoals(tenantId: string): Promise<GoalSettingsResponseDto> {
    return this.goalsService.getGoalSettings(tenantId);
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateTenantSettingsRequestDto
  ): Promise<TenantSettingsResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const tenant = await this.tenantRepository.findOne({
      where: { id: resolvedTenantId },
    });

    if (!tenant) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'timezone') && dto.timezone) {
      tenant.timezone = dto.timezone;
      await this.tenantRepository.save(tenant);
    }

    return {
      timezone: tenant.timezone || DEFAULT_TENANT_TIMEZONE,
      updatedAt: tenant.updatedAt.toISOString(),
    };
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

  private requireTenantId(tenantId?: string): string {
    const normalized = tenantId?.trim();
    if (!normalized) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
    return normalized;
  }
}
