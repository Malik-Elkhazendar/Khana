import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import {
  AuditAction,
  AuditLog,
  User,
  WaitingListEntry,
} from '@khana/data-access';
import {
  JoinWaitlistResponseDto,
  UserRole,
  WaitlistStatus,
} from '@khana/shared-dtos';
import { JoinWaitlistDto } from '../dto';
import {
  ACCESS_DENIED_MESSAGE,
  ACTIVE_WAITLIST_STATUSES,
  WaitlistDependencies,
  assertSlotUnavailable,
  logAudit,
  logWaitlistInfo,
  normalizeSlotWindow,
  requireTenantId,
  requireUserId,
  requireUserRole,
  resolveQueuePosition,
  toJoinResponse,
  validateFacilityOwnership,
} from './waitlist.internal';
import { LOG_EVENTS } from '../../../logging';

/**
 * Membership workflows own joins and slot-fulfillment transitions.
 * They keep queue mutations inside transactions so one user-slot pair cannot be
 * created or fulfilled twice under concurrency.
 */
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

    // Re-check inside the transaction so duplicate joins for the same slot
    // collapse into the earliest active entry.
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

      // Lock the oldest active entry for this exact slot so booking creation
      // and waitlist cleanup cannot fulfill the same request twice.
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
