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
  NotificationPreferencesDto,
} from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { GoalsService } from '../goals/goals.service';
import { cloneDefaultNotificationPreferences } from './notification-preferences.defaults';

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

  /**
   * Retrieves tenant settings such as timezone and notification preferences.
   * Falls back to DEFAULT_TENANT_TIMEZONE if timezone is not set.
   * Throws NotFoundException if the tenant does not exist.
   */
  async getSettings(tenantId: string): Promise<TenantSettingsResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);

    const tenant = await this.tenantRepository.findOne({
      where: { id: resolvedTenantId },
      select: ['id', 'timezone', 'notificationPreferences', 'updatedAt'],
    });

    if (!tenant) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    return {
      timezone: tenant.timezone || DEFAULT_TENANT_TIMEZONE,
      notificationPreferences: this.normalizeNotificationPreferences(
        tenant.notificationPreferences
      ),
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }

  /**
   * Returns goal settings for the tenant.
   * Delegates the logic to GoalsService.
   */
  getGoals(tenantId: string): Promise<GoalSettingsResponseDto> {
    return this.goalsService.getGoalSettings(tenantId);
  }

  /**
   * Updates tenant settings such as timezone and notification preferences.
   * Only fields present in the DTO are updated.
   * Persists changes only if at least one field was modified.
   */
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

    let shouldPersist = false;

    if (Object.prototype.hasOwnProperty.call(dto, 'timezone') && dto.timezone) {
      tenant.timezone = dto.timezone;
      shouldPersist = true;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'notificationPreferences')) {
      tenant.notificationPreferences = dto.notificationPreferences ?? null;

      shouldPersist = true;
    }

    const persistedTenant = shouldPersist
      ? await this.tenantRepository.save(tenant)
      : tenant;

    return {
      timezone: persistedTenant.timezone || DEFAULT_TENANT_TIMEZONE,
      notificationPreferences: this.normalizeNotificationPreferences(
        persistedTenant.notificationPreferences
      ),
      updatedAt: persistedTenant.updatedAt.toISOString(),
    };
  }

  /**
   * Updates tenant goal configuration.
   * Delegates the operation to GoalsService and includes actor context
   * for auditing or tracking purposes.
   */
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

  /**
   * Validates that a tenantId is provided.
   * Trims the value and throws ForbiddenException if it is missing or empty.
   */
  private requireTenantId(tenantId?: string): string {
    const normalized = tenantId?.trim();

    if (!normalized) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return normalized;
  }

  private normalizeNotificationPreferences(
    notificationPreferences?: NotificationPreferencesDto | null
  ): NotificationPreferencesDto {
    return notificationPreferences ?? cloneDefaultNotificationPreferences();
  }
}
