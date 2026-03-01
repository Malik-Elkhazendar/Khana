import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  AuditAction,
  AuditLog,
  Facility,
  Tenant,
  User,
} from '@khana/data-access';
import { CompleteOnboardingResponseDto, UserRole } from '@khana/shared-dtos';
import { AppLoggerService } from '../logging';
import { CompleteOnboardingDto } from './dto';

const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
const INVALID_FACILITY_CONFIG_MESSAGE =
  'Facility config is invalid. Provide a positive price and valid operating hours.';
const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const SUPPORTED_FACILITY_TYPES = new Set([
  'PADEL',
  'FOOTBALL',
  'CHALET',
  'RESORT',
  'CAMP',
  'PADEL_COURT',
  'FOOTBALL_FIELD',
  'BASKETBALL_COURT',
  'TENNIS_COURT',
  'RESORT_UNIT',
  'OTHER',
]);

type Actor = Pick<User, 'id' | 'role' | 'tenantId'>;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly appLogger: AppLoggerService
  ) {}

  async complete(
    dto: CompleteOnboardingDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CompleteOnboardingResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    this.assertOwnerRole(actor.role);

    if (actor.tenantId && actor.tenantId !== resolvedTenantId) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return this.dataSource.transaction(async (manager) => {
      const tenantRepo = manager.getRepository(Tenant);
      const facilityRepo = manager.getRepository(Facility);
      const auditRepo = manager.getRepository(AuditLog);

      const tenant = await tenantRepo.findOne({
        where: { id: resolvedTenantId },
      });

      if (!tenant) {
        throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
      }

      const existingFacility = await facilityRepo.findOne({
        where: { tenant: { id: resolvedTenantId } },
        relations: { tenant: true },
        order: { createdAt: 'ASC' },
      });

      if (tenant.onboardingCompleted) {
        if (!existingFacility) {
          throw new BadRequestException(
            'Onboarding is already completed, but no facility was found.'
          );
        }

        return {
          onboardingCompleted: true,
          tenantId: tenant.id,
          facilityId: existingFacility.id,
          redirectTo: '/dashboard',
        };
      }

      const businessName = dto.businessName.trim();
      if (!businessName) {
        throw new BadRequestException('Business name is required.');
      }

      const now = new Date();
      tenant.name = businessName;
      tenant.businessType = dto.businessType;
      tenant.contactEmail = dto.contactEmail?.trim().toLowerCase() || null;
      tenant.contactPhone = dto.contactPhone?.trim() || null;
      tenant.onboardingCompleted = true;
      tenant.onboardingCompletedAt = now;

      const updatedTenant = await tenantRepo.save(tenant);

      await this.logAudit(auditRepo, {
        tenantId: updatedTenant.id,
        userId: actor.id,
        action: AuditAction.UPDATE,
        entityType: 'Tenant',
        entityId: updatedTenant.id,
        description: `Tenant onboarding completed: ${updatedTenant.name}`,
        changes: {
          after: {
            businessType: updatedTenant.businessType,
            contactEmail: updatedTenant.contactEmail,
            contactPhone: updatedTenant.contactPhone,
            onboardingCompleted: updatedTenant.onboardingCompleted,
            onboardingCompletedAt: updatedTenant.onboardingCompletedAt,
          },
        },
        ipAddress,
        userAgent,
      });

      let facility = existingFacility;
      if (!facility) {
        const facilityName = dto.facility.name.trim();
        if (!facilityName) {
          throw new BadRequestException('Facility name is required.');
        }

        const facilityType = this.normalizeFacilityType(dto.facility.type);
        const facilityConfig = this.normalizeFacilityConfig(
          dto.facility.pricePerHour,
          dto.facility.openTime,
          dto.facility.closeTime
        );

        facility = facilityRepo.create({
          name: facilityName,
          type: facilityType,
          config: facilityConfig,
          isActive: true,
          tenant: { id: updatedTenant.id } as Tenant,
        });
        facility = await facilityRepo.save(facility);

        await this.logAudit(auditRepo, {
          tenantId: updatedTenant.id,
          userId: actor.id,
          action: AuditAction.CREATE,
          entityType: 'Facility',
          entityId: facility.id,
          description: `First facility created during onboarding: ${facility.name}`,
          changes: {
            after: {
              id: facility.id,
              name: facility.name,
              type: facility.type,
              config: facility.config,
              isActive: facility.isActive,
            },
          },
          ipAddress,
          userAgent,
        });
      }

      this.appLogger.info(
        'onboarding.complete.success',
        'Tenant onboarding completed',
        {
          tenantId: updatedTenant.id,
          actorUserId: actor.id,
          facilityId: facility.id,
        }
      );

      return {
        onboardingCompleted: true,
        tenantId: updatedTenant.id,
        facilityId: facility.id,
        redirectTo: '/dashboard',
      };
    });
  }

  private requireTenantId(tenantId?: string): string {
    const normalized = tenantId?.trim();
    if (!normalized) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
    return normalized;
  }

  private assertOwnerRole(role?: string): void {
    if (role !== UserRole.OWNER) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
  }

  private normalizeFacilityType(rawType: string): string {
    const normalized = rawType.trim().toUpperCase();
    if (!normalized || !SUPPORTED_FACILITY_TYPES.has(normalized)) {
      throw new BadRequestException('Facility type is invalid.');
    }
    return normalized;
  }

  private normalizeFacilityConfig(
    pricePerHour: number,
    openTime: string,
    closeTime: string
  ): { pricePerHour: number; openTime: string; closeTime: string } {
    const normalizedPrice = Number(pricePerHour);
    const normalizedOpenTime = openTime.trim();
    const normalizedCloseTime = closeTime.trim();

    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      throw new BadRequestException(INVALID_FACILITY_CONFIG_MESSAGE);
    }
    if (
      !HH_MM_24H_REGEX.test(normalizedOpenTime) ||
      !HH_MM_24H_REGEX.test(normalizedCloseTime)
    ) {
      throw new BadRequestException(INVALID_FACILITY_CONFIG_MESSAGE);
    }
    if (
      this.toMinutes(normalizedOpenTime) >= this.toMinutes(normalizedCloseTime)
    ) {
      throw new BadRequestException(
        'Facility operating hours are invalid. Open time must be before close time.'
      );
    }

    return {
      pricePerHour: normalizedPrice,
      openTime: normalizedOpenTime,
      closeTime: normalizedCloseTime,
    };
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  }

  private async logAudit(
    auditRepo: Repository<AuditLog>,
    params: {
      tenantId: string;
      userId?: string;
      action: AuditAction;
      entityType: string;
      entityId: string;
      description?: string;
      changes?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const auditLog = auditRepo.create({
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      changes: params.changes,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    await auditRepo.save(auditLog);
  }
}
