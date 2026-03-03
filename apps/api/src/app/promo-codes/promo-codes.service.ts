import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuditAction,
  AuditLog,
  Facility,
  PromoCode,
  User,
} from '@khana/data-access';
import {
  PromoCodeItemDto,
  PromoCodeListResponseDto,
  PromoDiscountType,
  PromoFacilityScope,
  UserRole,
} from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../logging';
import {
  CreatePromoCodeDto,
  ListPromoCodesQueryDto,
  UpdatePromoCodeDto,
} from './dto';

const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
const PROMO_CODE_EXISTS_MESSAGE = 'Promo code already exists for this tenant.';
const INVALID_PROMO_CODE_MESSAGE =
  'Promo code format is invalid. Use 3-40 chars: A-Z, 0-9, dash, underscore.';
const INVALID_DISCOUNT_VALUE_MESSAGE =
  'Discount value is invalid for the selected discount type.';
const INVALID_MAX_USES_MESSAGE = 'maxUses must be greater than zero.';
const MAX_USES_BELOW_CURRENT_USES_MESSAGE =
  'maxUses cannot be lower than current uses.';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PROMO_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly appLogger: AppLoggerService
  ) {}

  async createPromoCode(
    dto: CreatePromoCodeDto,
    tenantId: string,
    actor: User
  ): Promise<PromoCodeItemDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requirePromoActorRole(actor?.role);
    const actorUserId = this.requireUserId(actor?.id);

    if (!this.canManagePromoCodes(actorRole)) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const normalizedCode = this.normalizeCode(dto.code);
    if (!PROMO_CODE_REGEX.test(normalizedCode)) {
      throw new BadRequestException(INVALID_PROMO_CODE_MESSAGE);
    }

    this.validateDiscountValue(dto.discountType, dto.discountValue);
    this.validateMaxUses(dto.maxUses ?? null);

    const scope = dto.facilityScope;
    const facilityId = await this.resolveScopedFacilityId(
      scope,
      dto.facilityId ?? null,
      resolvedTenantId
    );
    const expiresAt = this.parseOptionalDate(dto.expiresAt);

    const existing = await this.promoCodeRepository.findOne({
      where: { tenantId: resolvedTenantId, code: normalizedCode },
      select: ['id'],
    });
    if (existing) {
      throw new ConflictException(PROMO_CODE_EXISTS_MESSAGE);
    }

    const entity = this.promoCodeRepository.create({
      tenantId: resolvedTenantId,
      facilityScope: scope,
      facilityId,
      code: normalizedCode,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      maxUses: dto.maxUses ?? null,
      currentUses: 0,
      expiresAt,
      isActive: dto.isActive ?? true,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    });

    const saved = await this.promoCodeRepository.save(entity);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actorUserId,
      action: AuditAction.CREATE,
      entityId: saved.id,
      description: `Promo code created: ${saved.code}`,
      changes: {
        after: {
          code: saved.code,
          facilityScope: saved.facilityScope,
          facilityId: saved.facilityId,
          discountType: saved.discountType,
          discountValue: Number(saved.discountValue),
          maxUses: saved.maxUses,
          expiresAt: saved.expiresAt?.toISOString() ?? null,
          isActive: saved.isActive,
        },
      },
    });

    this.appLogger.info(
      LOG_EVENTS.PROMO_CODE_CREATE_SUCCESS,
      'Promo code created',
      {
        promoCodeId: saved.id,
        tenantId: resolvedTenantId,
        code: saved.code,
      }
    );

    return this.toPromoCodeItemDto(saved);
  }

  async listPromoCodes(
    query: ListPromoCodesQueryDto,
    tenantId: string,
    actor: User
  ): Promise<PromoCodeListResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requirePromoActorRole(actor?.role);

    if (!this.canManagePromoCodes(actorRole)) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    if (query.facilityId) {
      await this.validateFacilityOwnership(query.facilityId, resolvedTenantId);
    }

    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;
    const now = new Date();

    const qb = this.promoCodeRepository
      .createQueryBuilder('promo')
      .where('promo.tenantId = :tenantId', { tenantId: resolvedTenantId });

    if (query.facilityId) {
      qb.andWhere('promo.facilityId = :facilityId', {
        facilityId: query.facilityId,
      });
    }

    if (typeof query.isActive === 'boolean') {
      qb.andWhere('promo.isActive = :isActive', { isActive: query.isActive });
    }

    if (!query.includeExpired) {
      qb.andWhere('(promo.expiresAt IS NULL OR promo.expiresAt >= :now)', {
        now,
      });
    }

    const [items, total] = await qb
      .orderBy('promo.createdAt', 'DESC')
      .addOrderBy('promo.id', 'DESC')
      .skip(offset)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: items.map((item) => this.toPromoCodeItemDto(item, now)),
      total,
      page,
      pageSize,
    };
  }

  async updatePromoCode(
    id: string,
    dto: UpdatePromoCodeDto,
    tenantId: string,
    actor: User
  ): Promise<PromoCodeItemDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requirePromoActorRole(actor?.role);
    const actorUserId = this.requireUserId(actor?.id);

    if (!this.canManagePromoCodes(actorRole)) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const existing = await this.findPromoCodeForActor(id, resolvedTenantId);
    const before = this.toPromoCodeItemDto(existing);

    if (typeof dto.code === 'string') {
      const normalizedCode = this.normalizeCode(dto.code);
      if (!PROMO_CODE_REGEX.test(normalizedCode)) {
        throw new BadRequestException(INVALID_PROMO_CODE_MESSAGE);
      }
      if (normalizedCode !== existing.code) {
        const duplicate = await this.promoCodeRepository.findOne({
          where: { tenantId: resolvedTenantId, code: normalizedCode },
          select: ['id'],
        });
        if (duplicate) {
          throw new ConflictException(PROMO_CODE_EXISTS_MESSAGE);
        }
      }
      existing.code = normalizedCode;
    }

    const nextDiscountType = dto.discountType ?? existing.discountType;
    const nextDiscountValue =
      dto.discountValue ?? Number(existing.discountValue);
    this.validateDiscountValue(nextDiscountType, nextDiscountValue);
    existing.discountType = nextDiscountType;
    existing.discountValue = nextDiscountValue;

    if (Object.prototype.hasOwnProperty.call(dto, 'maxUses')) {
      this.validateMaxUses(dto.maxUses ?? null);
      const nextMaxUses = dto.maxUses ?? null;
      if (
        typeof nextMaxUses === 'number' &&
        nextMaxUses < Number(existing.currentUses)
      ) {
        throw new BadRequestException(MAX_USES_BELOW_CURRENT_USES_MESSAGE);
      }
      existing.maxUses = nextMaxUses;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'expiresAt')) {
      existing.expiresAt = this.parseOptionalDate(dto.expiresAt ?? null);
    }

    if (typeof dto.isActive === 'boolean') {
      existing.isActive = dto.isActive;
    }

    const nextScope = dto.facilityScope ?? existing.facilityScope;
    const providedFacilityId = Object.prototype.hasOwnProperty.call(
      dto,
      'facilityId'
    )
      ? dto.facilityId ?? null
      : existing.facilityId;

    existing.facilityScope = nextScope;
    existing.facilityId = await this.resolveScopedFacilityId(
      nextScope,
      providedFacilityId,
      resolvedTenantId
    );

    existing.updatedByUserId = actorUserId;
    const saved = await this.promoCodeRepository.save(existing);
    const after = this.toPromoCodeItemDto(saved);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actorUserId,
      action: AuditAction.UPDATE,
      entityId: saved.id,
      description: `Promo code updated: ${saved.code}`,
      changes: { before, after },
    });

    this.appLogger.info(
      LOG_EVENTS.PROMO_CODE_UPDATE_SUCCESS,
      'Promo code updated',
      {
        promoCodeId: saved.id,
        tenantId: resolvedTenantId,
      }
    );

    return after;
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId?.trim()) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
    return tenantId;
  }

  private requireUserId(userId?: string): string {
    if (!userId?.trim()) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
    return userId;
  }

  private requirePromoActorRole(role?: string): UserRole {
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

  private canManagePromoCodes(role: UserRole): boolean {
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private validateDiscountValue(
    discountType: PromoDiscountType,
    discountValue: number
  ): void {
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new BadRequestException(INVALID_DISCOUNT_VALUE_MESSAGE);
    }

    if (discountType === PromoDiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException(INVALID_DISCOUNT_VALUE_MESSAGE);
    }
  }

  private validateMaxUses(maxUses: number | null): void {
    if (maxUses === null) return;
    if (!Number.isInteger(maxUses) || maxUses <= 0) {
      throw new BadRequestException(INVALID_MAX_USES_MESSAGE);
    }
  }

  private parseOptionalDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('expiresAt must be a valid ISO date-time.');
    }
    return parsed;
  }

  private async resolveScopedFacilityId(
    scope: PromoFacilityScope,
    requestedFacilityId: string | null,
    tenantId: string
  ): Promise<string | null> {
    if (scope === PromoFacilityScope.ALL_FACILITIES) {
      return null;
    }

    if (!requestedFacilityId?.trim()) {
      throw new BadRequestException(
        'facilityId is required when facilityScope is SINGLE_FACILITY.'
      );
    }

    const facility = await this.validateFacilityOwnership(
      requestedFacilityId,
      tenantId
    );
    return facility.id;
  }

  private async validateFacilityOwnership(
    facilityId: string,
    tenantId: string
  ): Promise<Facility> {
    const facility = await this.facilityRepository.findOne({
      where: { id: facilityId },
      relations: { tenant: true },
    });

    if (!facility) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    if (facility.tenant.id !== tenantId) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return facility;
  }

  private async findPromoCodeForActor(
    id: string,
    tenantId: string
  ): Promise<PromoCode> {
    const promo = await this.promoCodeRepository.findOne({
      where: { id },
    });

    if (!promo) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    if (promo.tenantId !== tenantId) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return promo;
  }

  private toPromoCodeItemDto(
    promoCode: PromoCode,
    referenceDate: Date = new Date()
  ): PromoCodeItemDto {
    const maxUses = promoCode.maxUses;
    const currentUses = Number(promoCode.currentUses ?? 0);
    const remainingUses =
      typeof maxUses === 'number' ? Math.max(maxUses - currentUses, 0) : null;
    const isExpired = Boolean(
      promoCode.expiresAt && promoCode.expiresAt < referenceDate
    );
    const isExhausted =
      typeof maxUses === 'number' ? currentUses >= maxUses : false;

    return {
      id: promoCode.id,
      tenantId: promoCode.tenantId,
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: Number(promoCode.discountValue),
      maxUses: maxUses ?? null,
      currentUses,
      remainingUses,
      isExhausted,
      expiresAt: promoCode.expiresAt?.toISOString() ?? null,
      isExpired,
      facilityScope: promoCode.facilityScope,
      facilityId: promoCode.facilityId ?? null,
      isActive: promoCode.isActive,
      createdAt: promoCode.createdAt.toISOString(),
      updatedAt: promoCode.updatedAt.toISOString(),
    };
  }

  private async logAudit(params: {
    tenantId: string;
    userId?: string;
    action: AuditAction;
    entityId: string;
    description?: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    const audit = this.auditLogRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: 'PromoCode',
      entityId: params.entityId,
      description: params.description,
      changes: params.changes,
    });
    await this.auditLogRepository.save(audit);
  }
}
