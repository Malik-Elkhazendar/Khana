import { In } from 'typeorm';
import {
  AuditAction,
  AuditLog,
  User,
  WaitingListEntry,
} from '@khana/data-access';
import {
  ExpireWaitlistEntryResponseDto,
  JoinWaitlistResponseDto,
  NotifyNextWaitlistResponseDto,
  UserRole,
  WaitlistEntryListItemDto,
  WaitlistListResponseDto,
  WaitlistStatus,
  WaitlistStatusResponseDto,
} from '@khana/shared-dtos';
import {
  JoinWaitlistDto,
  NotifyNextWaitlistDto,
  WaitlistListQueryDto,
  WaitlistStatusQueryDto,
} from '../dto';
import {
  ACCESS_DENIED_MESSAGE,
  ACTIVE_WAITLIST_STATUSES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  EXPIRE_NOT_ALLOWED_MESSAGE,
  LOG_EVENTS,
  MAX_PAGE_SIZE,
  RESOURCE_NOT_FOUND_MESSAGE,
  WAITING_STATUS,
  WaitlistDependencies,
  assertRangeWithinLimit,
  assertSlotUnavailable,
  logAudit,
  logWaitlistError,
  logWaitlistInfo,
  logWaitlistWarn,
  normalizeQueuePosition,
  normalizeSlotWindow,
  requireTenantId,
  requireUserId,
  requireUserRole,
  resolveQueuePosition,
  toJoinResponse,
  validateFacilityOwnership,
} from './waitlist.internal';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

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

export const joinWaitlistEntry = async (
  deps: WaitlistDependencies,
  dto: JoinWaitlistDto,
  tenantId: string,
  actor: User
): Promise<JoinWaitlistResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorUserId = requireUserId(actor?.id);
  const actorRole = requireUserRole(actor?.role);

  if (actorRole === UserRole.VIEWER) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  const slot = normalizeSlotWindow(
    dto.desiredTimeSlot.startTime,
    dto.desiredTimeSlot.endTime
  );
  const facility = await validateFacilityOwnership(
    deps,
    dto.facilityId,
    resolvedTenantId
  );

  await assertSlotUnavailable(
    deps,
    facility.id,
    slot.startTime,
    slot.endTime,
    resolvedTenantId
  );

  return deps.waitlistRepository.manager.transaction(async (manager) => {
    const waitlistRepo = manager.getRepository(WaitingListEntry);
    const auditRepo = manager.getRepository(AuditLog);

    const existingEntry = await waitlistRepo.findOne({
      where: {
        userId: actorUserId,
        facilityId: facility.id,
        desiredStartTime: slot.startTime,
        desiredEndTime: slot.endTime,
        status: In([...ACTIVE_WAITLIST_STATUSES]),
      },
      order: { createdAt: 'ASC' },
    });

    if (existingEntry) {
      const queuePosition = await resolveQueuePosition(
        waitlistRepo,
        existingEntry
      );
      return toJoinResponse(existingEntry, queuePosition);
    }

    const createdEntry = await waitlistRepo.save(
      waitlistRepo.create({
        userId: actorUserId,
        facilityId: facility.id,
        desiredStartTime: slot.startTime,
        desiredEndTime: slot.endTime,
        status: WaitlistStatus.WAITING,
        notifiedAt: null,
        expiredAt: null,
        fulfilledByBookingId: null,
      })
    );

    await logAudit(auditRepo, {
      tenantId: resolvedTenantId,
      userId: actorUserId,
      action: AuditAction.CREATE,
      entityType: 'WaitingListEntry',
      entityId: createdEntry.id,
      description: 'Waitlist entry created',
      changes: {
        after: {
          facilityId: createdEntry.facilityId,
          desiredStartTime: createdEntry.desiredStartTime.toISOString(),
          desiredEndTime: createdEntry.desiredEndTime.toISOString(),
          status: createdEntry.status,
        },
      },
    });

    const queuePosition = await resolveQueuePosition(
      waitlistRepo,
      createdEntry
    );

    logWaitlistInfo(
      deps,
      LOG_EVENTS.WAITLIST_JOIN_SUCCESS,
      'Waitlist join created',
      {
        entryId: createdEntry.id,
        tenantId: resolvedTenantId,
        facilityId: createdEntry.facilityId,
        userId: actorUserId,
        queuePosition,
      }
    );

    return toJoinResponse(createdEntry, queuePosition);
  });
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

export const markWaitlistFulfilledForUserSlot = async (
  deps: WaitlistDependencies,
  params: {
    tenantId: string;
    userId: string;
    facilityId: string;
    desiredStartTime: Date;
    desiredEndTime: Date;
    bookingId: string;
    actorUserId?: string;
  }
): Promise<boolean> => {
  const resolvedTenantId = requireTenantId(params.tenantId);
  const resolvedUserId = requireUserId(params.userId);
  await validateFacilityOwnership(deps, params.facilityId, resolvedTenantId);

  const transitionedEntry = await deps.waitlistRepository.manager.transaction(
    async (manager) => {
      const waitlistRepo = manager.getRepository(WaitingListEntry);
      const auditRepo = manager.getRepository(AuditLog);

      const entry = await waitlistRepo
        .createQueryBuilder('entry')
        .where('entry.userId = :userId', { userId: resolvedUserId })
        .andWhere('entry.facilityId = :facilityId', {
          facilityId: params.facilityId,
        })
        .andWhere('entry.desiredStartTime = :desiredStartTime', {
          desiredStartTime: params.desiredStartTime,
        })
        .andWhere('entry.desiredEndTime = :desiredEndTime', {
          desiredEndTime: params.desiredEndTime,
        })
        .andWhere('entry.status IN (:...statuses)', {
          statuses: [...ACTIVE_WAITLIST_STATUSES],
        })
        .orderBy('entry.createdAt', 'ASC')
        .addOrderBy('entry.id', 'ASC')
        .setLock('pessimistic_write')
        .getOne();

      if (!entry) {
        return null;
      }

      const previousStatus = entry.status;
      entry.status = WaitlistStatus.FULFILLED;
      entry.fulfilledByBookingId = params.bookingId;
      entry.expiredAt = null;
      await waitlistRepo.save(entry);

      await logAudit(auditRepo, {
        tenantId: resolvedTenantId,
        userId: params.actorUserId,
        action: AuditAction.UPDATE,
        entityType: 'WaitingListEntry',
        entityId: entry.id,
        description: 'Waitlist entry fulfilled by booking',
        changes: {
          before: { status: previousStatus },
          after: {
            status: entry.status,
            fulfilledByBookingId: entry.fulfilledByBookingId,
            bookingId: params.bookingId,
          },
        },
      });

      return entry;
    }
  );

  if (!transitionedEntry) {
    return false;
  }

  logWaitlistInfo(
    deps,
    LOG_EVENTS.WAITLIST_FULFILL_SUCCESS,
    'Waitlist entry marked as fulfilled',
    {
      entryId: transitionedEntry.id,
      tenantId: resolvedTenantId,
      facilityId: transitionedEntry.facilityId,
      userId: transitionedEntry.userId,
      bookingId: params.bookingId,
    }
  );

  return true;
};

export const expirePastWaitlistEntries = async (
  deps: WaitlistDependencies,
  now: Date = new Date()
): Promise<number> => {
  return deps.waitlistRepository.manager.transaction(async (manager) => {
    const waitlistRepo = manager.getRepository(WaitingListEntry);
    const auditRepo = manager.getRepository(AuditLog);

    const candidates = await waitlistRepo
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.facility', 'facility')
      .innerJoinAndSelect('facility.tenant', 'tenant')
      .where('entry.desiredEndTime < :now', { now })
      .andWhere('entry.status IN (:...statuses)', {
        statuses: [...ACTIVE_WAITLIST_STATUSES],
      })
      .setLock('pessimistic_write')
      .getMany();

    if (candidates.length === 0) {
      return 0;
    }

    const previousStatuses = new Map<string, WaitlistStatus>(
      candidates.map((entry) => [entry.id, entry.status])
    );

    for (const entry of candidates) {
      entry.status = WaitlistStatus.EXPIRED;
      entry.expiredAt = now;
    }

    await waitlistRepo.save(candidates);

    const auditLogs = candidates.map((entry) =>
      auditRepo.create({
        tenantId: entry.facility.tenant.id,
        action: AuditAction.UPDATE,
        entityType: 'WaitingListEntry',
        entityId: entry.id,
        description: 'Waitlist entry expired',
        changes: {
          before: { status: previousStatuses.get(entry.id) },
          after: {
            status: entry.status,
            expiredAt: entry.expiredAt?.toISOString() ?? null,
          },
        },
      })
    );
    await auditRepo.save(auditLogs);

    return candidates.length;
  });
};

export const notifyFirstWaitlistEntryForSlot = async (
  deps: WaitlistDependencies,
  params: {
    tenantId: string;
    facilityId: string;
    desiredStartTime: Date;
    desiredEndTime: Date;
    cancelledBookingId?: string;
    actorUserId?: string;
  }
): Promise<{ notified: boolean; entryId?: string }> => {
  const resolvedTenantId = requireTenantId(params.tenantId);
  await validateFacilityOwnership(deps, params.facilityId, resolvedTenantId);

  const transitionResult = await deps.waitlistRepository.manager.transaction(
    async (manager) => {
      const waitlistRepo = manager.getRepository(WaitingListEntry);
      const auditRepo = manager.getRepository(AuditLog);

      const candidate = await waitlistRepo
        .createQueryBuilder('entry')
        .where('entry.facilityId = :facilityId', {
          facilityId: params.facilityId,
        })
        .andWhere('entry.desiredStartTime = :desiredStartTime', {
          desiredStartTime: params.desiredStartTime,
        })
        .andWhere('entry.desiredEndTime = :desiredEndTime', {
          desiredEndTime: params.desiredEndTime,
        })
        .andWhere('entry.status IN (:...statuses)', {
          statuses: [...WAITING_STATUS],
        })
        .orderBy('entry.createdAt', 'ASC')
        .addOrderBy('entry.id', 'ASC')
        .setLock('pessimistic_write')
        .getOne();

      if (!candidate) {
        return null;
      }

      const previousStatus = candidate.status;
      candidate.status = WaitlistStatus.NOTIFIED;
      candidate.notifiedAt = new Date();
      await waitlistRepo.save(candidate);

      await logAudit(auditRepo, {
        tenantId: resolvedTenantId,
        userId: params.actorUserId,
        action: AuditAction.UPDATE,
        entityType: 'WaitingListEntry',
        entityId: candidate.id,
        description: 'Waitlist entry transitioned to NOTIFIED',
        changes: {
          before: { status: previousStatus },
          after: {
            status: candidate.status,
            notifiedAt: candidate.notifiedAt.toISOString(),
            cancelledBookingId: params.cancelledBookingId ?? null,
          },
        },
      });

      return {
        entryId: candidate.id,
        userId: candidate.userId,
        facilityId: candidate.facilityId,
        desiredStartTime: candidate.desiredStartTime,
        desiredEndTime: candidate.desiredEndTime,
      };
    }
  );

  if (!transitionResult) {
    return { notified: false };
  }

  const [user, facility] = await Promise.all([
    deps.userRepository.findOne({
      where: {
        id: transitionResult.userId,
        tenantId: resolvedTenantId,
        isActive: true,
      },
      select: ['id', 'email', 'name', 'phone'],
    }),
    deps.facilityRepository.findOne({
      where: {
        id: transitionResult.facilityId,
        tenant: { id: resolvedTenantId },
      },
      relations: { tenant: true },
    }),
  ]);

  if (!user || !facility) {
    logWaitlistWarn(
      deps,
      LOG_EVENTS.WAITLIST_NOTIFY_FAILED,
      'Waitlist notification skipped due to missing user/facility',
      {
        entryId: transitionResult.entryId,
        facilityId: transitionResult.facilityId,
        userId: transitionResult.userId,
      }
    );
    return { notified: true, entryId: transitionResult.entryId };
  }

  try {
    await deps.emailService.sendWaitlistSlotAvailableEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      facilityName: facility.name,
      startTime: transitionResult.desiredStartTime,
      endTime: transitionResult.desiredEndTime,
    });

    if (user.phone) {
      await deps.whatsAppService.sendWaitlistSlotAvailable({
        recipientPhone: user.phone,
        recipientName: user.name,
        facilityName: facility.name,
        startTime: transitionResult.desiredStartTime,
        endTime: transitionResult.desiredEndTime,
      });
    }

    logWaitlistInfo(
      deps,
      LOG_EVENTS.WAITLIST_NOTIFY_SUCCESS,
      'Waitlist user notified for available slot',
      {
        entryId: transitionResult.entryId,
        tenantId: resolvedTenantId,
        facilityId: transitionResult.facilityId,
        userId: transitionResult.userId,
      }
    );
  } catch (error) {
    logWaitlistError(
      deps,
      LOG_EVENTS.WAITLIST_NOTIFY_FAILED,
      'Failed to send waitlist slot available notification',
      {
        entryId: transitionResult.entryId,
        tenantId: resolvedTenantId,
        facilityId: transitionResult.facilityId,
        userId: transitionResult.userId,
      },
      error
    );
  }

  return { notified: true, entryId: transitionResult.entryId };
};

export const notifyNextWaitlistEntryForSlot = async (
  deps: WaitlistDependencies,
  dto: NotifyNextWaitlistDto,
  tenantId: string,
  actor: User
): Promise<NotifyNextWaitlistResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorUserId = requireUserId(actor?.id);
  const actorRole = requireUserRole(actor?.role);
  if (actorRole !== UserRole.OWNER && actorRole !== UserRole.MANAGER) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  const slot = normalizeSlotWindow(dto.desiredStartTime, dto.desiredEndTime, {
    allowPastStart: true,
  });
  await validateFacilityOwnership(deps, dto.facilityId, resolvedTenantId);

  const result = await notifyFirstWaitlistEntryForSlot(deps, {
    tenantId: resolvedTenantId,
    facilityId: dto.facilityId,
    desiredStartTime: slot.startTime,
    desiredEndTime: slot.endTime,
    actorUserId,
  });

  if (result.notified) {
    logWaitlistInfo(
      deps,
      LOG_EVENTS.WAITLIST_NOTIFY_MANUAL,
      'Manual waitlist notify-next executed',
      {
        tenantId: resolvedTenantId,
        facilityId: dto.facilityId,
        actorUserId,
        entryId: result.entryId,
        desiredStartTime: slot.startTime.toISOString(),
        desiredEndTime: slot.endTime.toISOString(),
      }
    );
    return {
      notified: true,
      entryId: result.entryId,
      status: WaitlistStatus.NOTIFIED,
    };
  }

  return { notified: false };
};

export const expireWaitlistEntryById = async (
  deps: WaitlistDependencies,
  entryId: string,
  tenantId: string,
  actor: User
): Promise<ExpireWaitlistEntryResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorUserId = requireUserId(actor?.id);
  const actorRole = requireUserRole(actor?.role);
  if (actorRole !== UserRole.OWNER && actorRole !== UserRole.MANAGER) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  const result = await deps.waitlistRepository.manager.transaction(
    async (manager) => {
      const waitlistRepo = manager.getRepository(WaitingListEntry);
      const auditRepo = manager.getRepository(AuditLog);

      const entry = await waitlistRepo
        .createQueryBuilder('entry')
        .innerJoinAndSelect('entry.facility', 'facility')
        .where('entry.id = :entryId', { entryId })
        .andWhere('facility.tenantId = :tenantId', {
          tenantId: resolvedTenantId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!entry) {
        throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
      }

      if (entry.status === WaitlistStatus.EXPIRED) {
        return {
          entryId: entry.id,
          status: WaitlistStatus.EXPIRED as const,
          expiredAt: entry.expiredAt ?? new Date(),
          changed: false,
        };
      }

      if (
        entry.status !== WaitlistStatus.WAITING &&
        entry.status !== WaitlistStatus.NOTIFIED
      ) {
        throw new BadRequestException(EXPIRE_NOT_ALLOWED_MESSAGE);
      }

      const previousStatus = entry.status;
      entry.status = WaitlistStatus.EXPIRED;
      entry.expiredAt = new Date();
      await waitlistRepo.save(entry);

      await logAudit(auditRepo, {
        tenantId: resolvedTenantId,
        userId: actorUserId,
        action: AuditAction.UPDATE,
        entityType: 'WaitingListEntry',
        entityId: entry.id,
        description: 'Waitlist entry manually expired',
        changes: {
          before: { status: previousStatus },
          after: {
            status: entry.status,
            expiredAt: entry.expiredAt.toISOString(),
          },
        },
      });

      return {
        entryId: entry.id,
        status: WaitlistStatus.EXPIRED as const,
        expiredAt: entry.expiredAt,
        changed: true,
      };
    }
  );

  if (result.changed) {
    logWaitlistInfo(
      deps,
      LOG_EVENTS.WAITLIST_EXPIRE_MANUAL,
      'Manual waitlist expire executed',
      {
        tenantId: resolvedTenantId,
        actorUserId,
        entryId: result.entryId,
        expiredAt: result.expiredAt.toISOString(),
      }
    );
  }

  return {
    entryId: result.entryId,
    status: WaitlistStatus.EXPIRED,
    expiredAt: result.expiredAt.toISOString(),
  };
};
