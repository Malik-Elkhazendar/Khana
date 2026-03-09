import { ForbiddenException } from '@nestjs/common';
import {
  AuditAction,
  AuditLog,
  User,
  WaitingListEntry,
} from '@khana/data-access';
import {
  NotifyNextWaitlistResponseDto,
  UserRole,
  WaitlistStatus,
} from '@khana/shared-dtos';
import { NotifyNextWaitlistDto } from '../dto';
import {
  ACCESS_DENIED_MESSAGE,
  WAITING_STATUS,
  WaitlistDependencies,
  logAudit,
  logWaitlistError,
  logWaitlistInfo,
  logWaitlistWarn,
  normalizeSlotWindow,
  requireTenantId,
  requireUserId,
  requireUserRole,
  validateFacilityOwnership,
} from './waitlist.internal';
import { LOG_EVENTS } from '../../../logging';

/**
 * Notification workflows own queue transitions from WAITING to NOTIFIED.
 * Delivery stays outside the transaction so provider latency cannot block queue state.
 */
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

      // Transition to NOTIFIED inside the transaction first; outbound delivery
      // is fire-and-forget and must never decide queue state.
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

  // Load recipient data after the status transition commits so slow providers
  // do not hold the waitlist lock.
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

  const notificationContext = {
    entryId: transitionResult.entryId,
    tenantId: resolvedTenantId,
    facilityId: transitionResult.facilityId,
    userId: transitionResult.userId,
  };

  void deps.emailService
    .sendWaitlistSlotAvailableEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      facilityName: facility.name,
      startTime: transitionResult.desiredStartTime,
      endTime: transitionResult.desiredEndTime,
    })
    .catch((error) => {
      logWaitlistError(
        deps,
        LOG_EVENTS.WAITLIST_NOTIFY_FAILED,
        'Failed to dispatch waitlist slot available email',
        notificationContext,
        error
      );
    });

  if (user.phone) {
    void deps.whatsAppService
      .sendWaitlistSlotAvailable({
        recipientPhone: user.phone,
        recipientName: user.name,
        facilityName: facility.name,
        startTime: transitionResult.desiredStartTime,
        endTime: transitionResult.desiredEndTime,
      })
      .catch((error) => {
        logWaitlistError(
          deps,
          LOG_EVENTS.WAITLIST_NOTIFY_FAILED,
          'Failed to dispatch waitlist slot available WhatsApp notification',
          notificationContext,
          error
        );
      });
  }

  logWaitlistInfo(
    deps,
    LOG_EVENTS.WAITLIST_NOTIFY_SUCCESS,
    'Waitlist notification dispatch queued',
    {
      ...notificationContext,
      channels: {
        email: true,
        whatsapp: Boolean(user.phone),
      },
    }
  );

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
