import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditLog,
  User,
  WaitingListEntry,
} from '@khana/data-access';
import {
  ExpireWaitlistEntryResponseDto,
  UserRole,
  WaitlistStatus,
} from '@khana/shared-dtos';
import {
  ACCESS_DENIED_MESSAGE,
  ACTIVE_WAITLIST_STATUSES,
  EXPIRE_NOT_ALLOWED_MESSAGE,
  LOG_EVENTS,
  RESOURCE_NOT_FOUND_MESSAGE,
  WaitlistDependencies,
  logAudit,
  logWaitlistInfo,
  requireTenantId,
  requireUserId,
  requireUserRole,
} from './waitlist.internal';

/**
 * Expiry workflows own both scheduled and manual expiration paths.
 * They keep status transitions and audit persistence in the same transaction.
 */
export const expirePastWaitlistEntries = async (
  deps: WaitlistDependencies,
  now: Date = new Date()
): Promise<number> => {
  return deps.waitlistRepository.manager.transaction(async (manager) => {
    const waitlistRepo = manager.getRepository(WaitingListEntry);
    const auditRepo = manager.getRepository(AuditLog);

    // Expire in one transaction so status changes and audit rows describe the
    // same batch.
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
