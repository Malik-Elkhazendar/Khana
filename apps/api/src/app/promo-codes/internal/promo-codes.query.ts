import { ForbiddenException } from '@nestjs/common';
import { User } from '@khana/data-access';
import { PromoCodeListResponseDto } from '@khana/shared-dtos';
import { ListPromoCodesQueryDto } from '../dto';
import {
  ACCESS_DENIED_MESSAGE,
  canManagePromoCodes,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PromoCodeDependencies,
  requirePromoActorRole,
  requireTenantId,
  toPromoCodeItemDto,
  validateFacilityOwnership,
} from './promo-codes.internal';

export const listPromoCodesWorkflow = async (
  deps: PromoCodeDependencies,
  query: ListPromoCodesQueryDto,
  tenantId: string,
  actor: User
): Promise<PromoCodeListResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorRole = requirePromoActorRole(actor?.role);

  if (!canManagePromoCodes(actorRole)) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  if (query.facilityId) {
    await validateFacilityOwnership(deps, query.facilityId, resolvedTenantId);
  }

  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  const now = new Date();

  const qb = deps.promoCodeRepository
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
    items: items.map((item) => toPromoCodeItemDto(item, now)),
    total,
    page,
    pageSize,
  };
};
