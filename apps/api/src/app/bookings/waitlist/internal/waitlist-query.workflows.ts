import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { User, WaitingListEntry } from '@khana/data-access';
import {
  UserRole,
  WaitlistEntryListItemDto,
  WaitlistListResponseDto,
  WaitlistStatus,
  WaitlistStatusResponseDto,
} from '@khana/shared-dtos';
import { WaitlistListQueryDto, WaitlistStatusQueryDto } from '../dto';
import {
  ACCESS_DENIED_MESSAGE,
  ACTIVE_WAITLIST_STATUSES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  WaitlistDependencies,
  assertRangeWithinLimit,
  normalizeQueuePosition,
  normalizeSlotWindow,
  requireTenantId,
  requireUserId,
  requireUserRole,
  resolveQueuePosition,
  validateFacilityOwnership,
} from './waitlist.internal';

/**
 * Query workflows for waitlist views and status checks.
 * These stay read-only and tenant-scoped so the root service can remain a thin facade.
 */
export const listWaitlistEntries = async (
  deps: WaitlistDependencies,
  query: WaitlistListQueryDto,
  tenantId: string,
  actor: User
): Promise<WaitlistListResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorRole = requireUserRole(actor?.role);

  if (actorRole === UserRole.VIEWER) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  const range = normalizeSlotWindow(query.from, query.to, {
    allowPastStart: true,
  });
  assertRangeWithinLimit(range.startTime, range.endTime);

  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  if (query.facilityId) {
    await validateFacilityOwnership(deps, query.facilityId, resolvedTenantId);
  }

  const listQuery = deps.waitlistRepository
    .createQueryBuilder('entry')
    .innerJoinAndSelect('entry.facility', 'facility')
    .innerJoinAndSelect('entry.user', 'user')
    .where('facility.tenantId = :tenantId', { tenantId: resolvedTenantId })
    .andWhere('entry.desiredStartTime >= :from', { from: range.startTime })
    .andWhere('entry.desiredStartTime <= :to', { to: range.endTime });

  if (query.facilityId) {
    listQuery.andWhere('entry.facilityId = :facilityId', {
      facilityId: query.facilityId,
    });
  }
  if (query.status) {
    listQuery.andWhere('entry.status = :status', { status: query.status });
  }

  const [entries, total] = await listQuery
    .orderBy('entry.createdAt', 'DESC')
    .addOrderBy('entry.id', 'DESC')
    .skip(offset)
    .take(pageSize)
    .getManyAndCount();

  const items: WaitlistEntryListItemDto[] = await Promise.all(
    entries.map(async (entry) => {
      const queuePosition =
        entry.status === WaitlistStatus.WAITING ||
        entry.status === WaitlistStatus.NOTIFIED
          ? normalizeQueuePosition(
              await resolveQueuePosition(deps.waitlistRepository, entry)
            )
          : null;

      return {
        entryId: entry.id,
        facilityId: entry.facilityId,
        facilityName: entry.facility.name,
        userId: entry.userId,
        userName: entry.user.name,
        userEmail: entry.user.email,
        desiredStartTime: entry.desiredStartTime.toISOString(),
        desiredEndTime: entry.desiredEndTime.toISOString(),
        status: entry.status,
        queuePosition,
        createdAt: entry.createdAt.toISOString(),
        notifiedAt: entry.notifiedAt?.toISOString() ?? null,
        expiredAt: entry.expiredAt?.toISOString() ?? null,
        fulfilledByBookingId: entry.fulfilledByBookingId,
      };
    })
  );

  const summaryQuery = deps.waitlistRepository
    .createQueryBuilder('entry')
    .select('entry.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .innerJoin('entry.facility', 'facility')
    .where('facility.tenantId = :tenantId', { tenantId: resolvedTenantId })
    .andWhere('entry.desiredStartTime >= :from', { from: range.startTime })
    .andWhere('entry.desiredStartTime <= :to', { to: range.endTime });

  if (query.facilityId) {
    summaryQuery.andWhere('entry.facilityId = :facilityId', {
      facilityId: query.facilityId,
    });
  }

  const rawSummary = await summaryQuery
    .groupBy('entry.status')
    .getRawMany<{ status: WaitlistStatus; count: string }>();

  const summary: WaitlistListResponseDto['summary'] = {
    waiting: 0,
    notified: 0,
    expired: 0,
    fulfilled: 0,
  };
  for (const row of rawSummary) {
    const count = Number(row.count ?? 0);
    if (row.status === WaitlistStatus.WAITING) summary.waiting = count;
    if (row.status === WaitlistStatus.NOTIFIED) summary.notified = count;
    if (row.status === WaitlistStatus.EXPIRED) summary.expired = count;
    if (row.status === WaitlistStatus.FULFILLED) summary.fulfilled = count;
  }

  return {
    items,
    total,
    page,
    pageSize,
    summary,
  };
};

export const getWaitlistStatusForSlot = async (
  deps: WaitlistDependencies,
  query: WaitlistStatusQueryDto,
  tenantId: string,
  actor: User
): Promise<WaitlistStatusResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorUserId = requireUserId(actor?.id);
  const actorRole = requireUserRole(actor?.role);

  if (actorRole === UserRole.VIEWER) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  const slot = normalizeSlotWindow(query.startTime, query.endTime, {
    allowPastStart: true,
  });
  await validateFacilityOwnership(deps, query.facilityId, resolvedTenantId);

  const activeEntry = await deps.waitlistRepository.findOne({
    where: {
      userId: actorUserId,
      facilityId: query.facilityId,
      desiredStartTime: slot.startTime,
      desiredEndTime: slot.endTime,
      status: In([...ACTIVE_WAITLIST_STATUSES]),
    },
    order: { createdAt: 'ASC' },
  });

  if (activeEntry) {
    const queuePosition = normalizeQueuePosition(
      await resolveQueuePosition(deps.waitlistRepository, activeEntry)
    );
    return {
      isOnWaitlist: activeEntry.status === WaitlistStatus.WAITING,
      entryId: activeEntry.id,
      status: activeEntry.status,
      queuePosition,
    };
  }

  const latestEntry = await deps.waitlistRepository.findOne({
    where: {
      userId: actorUserId,
      facilityId: query.facilityId,
      desiredStartTime: slot.startTime,
      desiredEndTime: slot.endTime,
    },
    order: { createdAt: 'DESC' },
  });

  if (!latestEntry) {
    return { isOnWaitlist: false };
  }

  return {
    isOnWaitlist: false,
    entryId: latestEntry.id,
    status: latestEntry.status,
  };
};
