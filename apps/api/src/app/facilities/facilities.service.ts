import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction, AuditLog, Facility, User } from '@khana/data-access';
import { FacilityManagementItemDto, UserRole } from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { AppLoggerService } from '../logging';
import { CreateFacilityDto, UpdateFacilityDto } from './dto';

const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
const INVALID_CONFIG_MESSAGE =
  'Facility config is invalid. Provide a positive price and valid operating hours.';
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
const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

type Actor = Pick<User, 'id' | 'role' | 'tenantId'>;

type FacilityConfig = {
  pricePerHour: number;
  openTime: string;
  closeTime: string;
};

@Injectable()
export class FacilitiesService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly appLogger: AppLoggerService
  ) {}

  async listFacilities(
    tenantId: string,
    actor: Actor,
    includeInactive = false
  ): Promise<FacilityManagementItemDto[]> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(actor.role);

    const where =
      includeInactive && this.canManageRole(actorRole)
        ? { tenant: { id: resolvedTenantId } }
        : { tenant: { id: resolvedTenantId }, isActive: true };

    const facilities = await this.facilityRepository.find({
      where,
      relations: { tenant: true },
      order: { name: 'ASC' },
    });

    return facilities.map((facility) => this.toDto(facility));
  }

  async getFacilityById(
    id: string,
    tenantId: string,
    actor: Actor
  ): Promise<FacilityManagementItemDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(actor.role);
    const facility = await this.requireFacility(id, resolvedTenantId);

    if (!facility.isActive && !this.canManageRole(actorRole)) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    return this.toDto(facility);
  }

  async createFacility(
    dto: CreateFacilityDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(actor.role);
    this.assertManageRole(actorRole);

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Facility name is required.');
    }

    const type = this.normalizeFacilityType(dto.type);
    const config = this.normalizeConfig(dto.config);

    const facility = this.facilityRepository.create({
      name,
      type,
      config,
      isActive: true,
      tenant: { id: resolvedTenantId } as never,
    });

    const saved = await this.facilityRepository.save(facility);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.CREATE,
      entityType: 'Facility',
      entityId: saved.id,
      description: `Facility created: ${saved.name}`,
      changes: { after: this.auditSnapshot(saved) },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('facility.create.success', 'Facility created', {
      facilityId: saved.id,
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
    });

    return this.toDto(saved);
  }

  async updateFacility(
    id: string,
    dto: UpdateFacilityDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(actor.role);
    this.assertManageRole(actorRole);

    const facility = await this.requireFacility(id, resolvedTenantId);
    const before = this.auditSnapshot(facility);

    if (typeof dto.name === 'string') {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Facility name is required.');
      }
      facility.name = name;
    }

    if (typeof dto.type === 'string') {
      facility.type = this.normalizeFacilityType(dto.type);
    }

    if (typeof dto.isActive === 'boolean') {
      facility.isActive = dto.isActive;
    }

    if (dto.config) {
      const merged = {
        ...((facility.config as FacilityConfig | null) ?? {}),
        ...dto.config,
      } as Partial<FacilityConfig>;
      facility.config = this.normalizeConfig(merged);
    }

    const saved = await this.facilityRepository.save(facility);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'Facility',
      entityId: saved.id,
      description: `Facility updated: ${saved.name}`,
      changes: {
        before,
        after: this.auditSnapshot(saved),
      },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('facility.update.success', 'Facility updated', {
      facilityId: saved.id,
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
    });

    return this.toDto(saved);
  }

  async deactivateFacility(
    id: string,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(actor.role);
    this.assertManageRole(actorRole);

    const facility = await this.requireFacility(id, resolvedTenantId);
    if (!facility.isActive) {
      return this.toDto(facility);
    }

    const before = this.auditSnapshot(facility);
    facility.isActive = false;
    const saved = await this.facilityRepository.save(facility);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.DELETE,
      entityType: 'Facility',
      entityId: saved.id,
      description: `Facility deactivated: ${saved.name}`,
      changes: {
        before,
        after: this.auditSnapshot(saved),
      },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('facility.deactivate.success', 'Facility deactivated', {
      facilityId: saved.id,
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
    });

    return this.toDto(saved);
  }

  private requireTenantId(tenantId?: string): string {
    const normalized = tenantId?.trim();
    if (!normalized) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
    return normalized;
  }

  private requireUserRole(role?: string): UserRole {
    if (
      role === UserRole.OWNER ||
      role === UserRole.MANAGER ||
      role === UserRole.STAFF ||
      role === UserRole.VIEWER
    ) {
      return role;
    }
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  private canManageRole(role: UserRole): boolean {
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  }

  private assertManageRole(role: UserRole): void {
    if (!this.canManageRole(role)) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
  }

  private async requireFacility(
    id: string,
    tenantId: string
  ): Promise<Facility> {
    const facility = await this.facilityRepository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: { tenant: true },
    });

    if (!facility) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    return facility;
  }

  private normalizeFacilityType(rawType: string): string {
    const type = rawType.trim().toUpperCase();
    if (!type || !SUPPORTED_FACILITY_TYPES.has(type)) {
      throw new BadRequestException('Facility type is invalid.');
    }
    return type;
  }

  private normalizeConfig(rawConfig: Partial<FacilityConfig>): FacilityConfig {
    const pricePerHour = Number(rawConfig.pricePerHour);
    const openTime = `${rawConfig.openTime ?? ''}`.trim();
    const closeTime = `${rawConfig.closeTime ?? ''}`.trim();

    if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) {
      throw new BadRequestException(INVALID_CONFIG_MESSAGE);
    }

    if (!HH_MM_24H_REGEX.test(openTime) || !HH_MM_24H_REGEX.test(closeTime)) {
      throw new BadRequestException(INVALID_CONFIG_MESSAGE);
    }

    if (this.toMinutes(openTime) >= this.toMinutes(closeTime)) {
      throw new BadRequestException(
        'Facility operating hours are invalid. Open time must be before close time.'
      );
    }

    return {
      pricePerHour,
      openTime,
      closeTime,
    };
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  }

  private toDto(facility: Facility): FacilityManagementItemDto {
    const config = facility.config as FacilityConfig;

    return {
      id: facility.id,
      tenantId: facility.tenant?.id,
      name: facility.name,
      type: facility.type,
      isActive: facility.isActive,
      config: {
        pricePerHour: Number(config.pricePerHour),
        openTime: config.openTime,
        closeTime: config.closeTime,
      },
      createdAt: facility.createdAt.toISOString(),
      updatedAt: facility.updatedAt.toISOString(),
    };
  }

  private auditSnapshot(facility: Facility): Record<string, unknown> {
    const config = facility.config as FacilityConfig;

    return {
      id: facility.id,
      name: facility.name,
      type: facility.type,
      isActive: facility.isActive,
      config: {
        pricePerHour: Number(config.pricePerHour),
        openTime: config.openTime,
        closeTime: config.closeTime,
      },
    };
  }

  private async logAudit(params: {
    tenantId: string;
    userId?: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    description?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
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
    await this.auditLogRepository.save(auditLog);
  }
}
