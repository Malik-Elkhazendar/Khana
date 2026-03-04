import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AuditAction,
  AuditLog,
  Booking,
  Facility,
  User,
  WaitingListEntry,
} from '@khana/data-access';
import {
  BookingStatus,
  ExpireWaitlistEntryResponseDto,
  JoinWaitlistResponseDto,
  NotifyNextWaitlistResponseDto,
  UserRole,
  WaitlistEntryListItemDto,
  WaitlistListResponseDto,
  WaitlistStatus,
  WaitlistStatusResponseDto,
} from '@khana/shared-dtos';
import { EmailService, WhatsAppService } from '@khana/notifications';
import {
  JoinWaitlistDto,
  NotifyNextWaitlistDto,
  WaitlistListQueryDto,
  WaitlistStatusQueryDto,
} from './dto';
import { AppLoggerService, LOG_EVENTS } from '../../logging';

const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
const SLOT_AVAILABLE_MESSAGE =
  'Slot is currently available. Waitlist is only supported for unavailable slots.';
const INVALID_TIME_RANGE_MESSAGE = 'Start time must be before end time.';
const PAST_SLOT_MESSAGE = 'You can only join waitlist for future slots.';
const RANGE_TOO_LARGE_MESSAGE =
  'Date range is too large. Maximum allowed range is 93 days.';
const EXPIRE_NOT_ALLOWED_MESSAGE =
  'Only WAITING or NOTIFIED waitlist entries can be expired manually.';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_LIST_RANGE_DAYS = 93;

const ACTIVE_WAITLIST_STATUSES = [
  WaitlistStatus.WAITING,
  WaitlistStatus.NOTIFIED,
] as const;
const WAITING_STATUS = [WaitlistStatus.WAITING] as const;

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitingListEntry)
    private readonly waitlistRepository: Repository<WaitingListEntry>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly appLogger: AppLoggerService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService
  ) {}

  async listEntries(
    query: WaitlistListQueryDto,
    tenantId: string,
    actor: User
  ): Promise<WaitlistListResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(actor?.role);

    if (actorRole === UserRole.VIEWER) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const range = this.normalizeSlotWindow(query.from, query.to, {
      allowPastStart: true,
    });
    this.assertRangeWithinLimit(range.startTime, range.endTime);

    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;

    if (query.facilityId) {
      await this.validateFacilityOwnership(query.facilityId, resolvedTenantId);
    }

    const listQuery = this.waitlistRepository
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
            ? await this.resolveQueuePosition(this.waitlistRepository, entry)
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

    const summaryQuery = this.waitlistRepository
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
  }

  async joinWaitlist(
    dto: JoinWaitlistDto,
    tenantId: string,
    actor: User
  ): Promise<JoinWaitlistResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorUserId = this.requireUserId(actor?.id);
    const actorRole = this.requireUserRole(actor?.role);

    if (actorRole === UserRole.VIEWER) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const slot = this.normalizeSlotWindow(
      dto.desiredTimeSlot.startTime,
      dto.desiredTimeSlot.endTime
    );
    const facility = await this.validateFacilityOwnership(
      dto.facilityId,
      resolvedTenantId
    );

    await this.assertSlotUnavailable(
      facility.id,
      slot.startTime,
      slot.endTime,
      resolvedTenantId
    );

    return this.waitlistRepository.manager.transaction(async (manager) => {
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
        const queuePosition = await this.resolveQueuePosition(
          waitlistRepo,
          existingEntry
        );
        return this.toJoinResponse(existingEntry, queuePosition);
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

      await this.logAudit(auditRepo, {
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

      const queuePosition = await this.resolveQueuePosition(
        waitlistRepo,
        createdEntry
      );

      this.appLogger.info(
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

      return this.toJoinResponse(createdEntry, queuePosition);
    });
  }

  async getStatus(
    query: WaitlistStatusQueryDto,
    tenantId: string,
    actor: User
  ): Promise<WaitlistStatusResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorUserId = this.requireUserId(actor?.id);
    const actorRole = this.requireUserRole(actor?.role);

    if (actorRole === UserRole.VIEWER) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const slot = this.normalizeSlotWindow(query.startTime, query.endTime, {
      allowPastStart: true,
    });
    await this.validateFacilityOwnership(query.facilityId, resolvedTenantId);

    const activeEntry = await this.waitlistRepository.findOne({
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
      const queuePosition = await this.resolveQueuePosition(
        this.waitlistRepository,
        activeEntry
      );
      return {
        isOnWaitlist: activeEntry.status === WaitlistStatus.WAITING,
        entryId: activeEntry.id,
        status: activeEntry.status,
        queuePosition,
      };
    }

    const latestEntry = await this.waitlistRepository.findOne({
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
  }

  async markFulfilledForUserSlot(params: {
    tenantId: string;
    userId: string;
    facilityId: string;
    desiredStartTime: Date;
    desiredEndTime: Date;
    bookingId: string;
    actorUserId?: string;
  }): Promise<boolean> {
    const resolvedTenantId = this.requireTenantId(params.tenantId);
    const resolvedUserId = this.requireUserId(params.userId);
    await this.validateFacilityOwnership(params.facilityId, resolvedTenantId);

    const transitionedEntry = await this.waitlistRepository.manager.transaction(
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

        await this.logAudit(auditRepo, {
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

    this.appLogger.info(
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
  }

  async expirePastEntries(now: Date = new Date()): Promise<number> {
    const expiredCount = await this.waitlistRepository.manager.transaction(
      async (manager) => {
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
      }
    );

    return expiredCount;
  }

  async notifyFirstForSlot(params: {
    tenantId: string;
    facilityId: string;
    desiredStartTime: Date;
    desiredEndTime: Date;
    cancelledBookingId?: string;
    actorUserId?: string;
  }): Promise<{ notified: boolean; entryId?: string }> {
    const resolvedTenantId = this.requireTenantId(params.tenantId);
    await this.validateFacilityOwnership(params.facilityId, resolvedTenantId);

    const transitionResult = await this.waitlistRepository.manager.transaction(
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

        await this.logAudit(auditRepo, {
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
      this.userRepository.findOne({
        where: {
          id: transitionResult.userId,
          tenantId: resolvedTenantId,
          isActive: true,
        },
        select: ['id', 'email', 'name', 'phone'],
      }),
      this.facilityRepository.findOne({
        where: {
          id: transitionResult.facilityId,
          tenant: { id: resolvedTenantId },
        },
        relations: { tenant: true },
      }),
    ]);

    if (!user || !facility) {
      this.appLogger.warn(
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
      await this.emailService.sendWaitlistSlotAvailableEmail({
        recipientEmail: user.email,
        recipientName: user.name,
        facilityName: facility.name,
        startTime: transitionResult.desiredStartTime,
        endTime: transitionResult.desiredEndTime,
      });

      if (user.phone) {
        await this.whatsAppService.sendWaitlistSlotAvailable({
          recipientPhone: user.phone,
          recipientName: user.name,
          facilityName: facility.name,
          startTime: transitionResult.desiredStartTime,
          endTime: transitionResult.desiredEndTime,
        });
      }

      this.appLogger.info(
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
      this.appLogger.error(
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
  }

  async notifyNextForSlot(
    dto: NotifyNextWaitlistDto,
    tenantId: string,
    actor: User
  ): Promise<NotifyNextWaitlistResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorUserId = this.requireUserId(actor?.id);
    const actorRole = this.requireUserRole(actor?.role);
    if (actorRole !== UserRole.OWNER && actorRole !== UserRole.MANAGER) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const slot = this.normalizeSlotWindow(
      dto.desiredStartTime,
      dto.desiredEndTime,
      {
        allowPastStart: true,
      }
    );
    await this.validateFacilityOwnership(dto.facilityId, resolvedTenantId);

    const result = await this.notifyFirstForSlot({
      tenantId: resolvedTenantId,
      facilityId: dto.facilityId,
      desiredStartTime: slot.startTime,
      desiredEndTime: slot.endTime,
      actorUserId,
    });

    if (result.notified) {
      this.appLogger.info(
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
  }

  async expireEntry(
    entryId: string,
    tenantId: string,
    actor: User
  ): Promise<ExpireWaitlistEntryResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorUserId = this.requireUserId(actor?.id);
    const actorRole = this.requireUserRole(actor?.role);
    if (actorRole !== UserRole.OWNER && actorRole !== UserRole.MANAGER) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const result = await this.waitlistRepository.manager.transaction(
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

        await this.logAudit(auditRepo, {
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
      this.appLogger.info(
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
  }

  private toJoinResponse(
    entry: WaitingListEntry,
    queuePosition: number
  ): JoinWaitlistResponseDto {
    return {
      entryId: entry.id,
      status: entry.status,
      queuePosition,
      desiredTimeSlot: {
        startTime: entry.desiredStartTime.toISOString(),
        endTime: entry.desiredEndTime.toISOString(),
      },
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private async resolveQueuePosition(
    waitlistRepo: Repository<WaitingListEntry>,
    entry: WaitingListEntry
  ): Promise<number> {
    const result = await waitlistRepo
      .createQueryBuilder('entry')
      .select('COUNT(*)', 'count')
      .where('entry.facilityId = :facilityId', { facilityId: entry.facilityId })
      .andWhere('entry.desiredStartTime = :desiredStartTime', {
        desiredStartTime: entry.desiredStartTime,
      })
      .andWhere('entry.desiredEndTime = :desiredEndTime', {
        desiredEndTime: entry.desiredEndTime,
      })
      .andWhere('entry.status IN (:...statuses)', {
        statuses: [...ACTIVE_WAITLIST_STATUSES],
      })
      .andWhere(
        `(entry.createdAt < :createdAt OR (entry.createdAt = :createdAt AND entry.id <= :entryId))`,
        { createdAt: entry.createdAt, entryId: entry.id }
      )
      .getRawOne<{ count?: string }>();

    return Number(result?.count ?? 0);
  }

  private async assertSlotUnavailable(
    facilityId: string,
    startTime: Date,
    endTime: Date,
    tenantId: string
  ): Promise<void> {
    const activeCount = await this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoin('booking.facility', 'facility')
      .where('facility.id = :facilityId', { facilityId })
      .andWhere('facility.tenantId = :tenantId', { tenantId })
      .andWhere('booking.startTime < :requestedEnd', {
        requestedEnd: endTime,
      })
      .andWhere('booking.endTime > :requestedStart', {
        requestedStart: startTime,
      })
      .andWhere(
        `(
          booking.status = :confirmedStatus
          OR (
            booking.status = :pendingStatus
            AND booking.holdUntil > :now
          )
        )`,
        {
          confirmedStatus: BookingStatus.CONFIRMED,
          pendingStatus: BookingStatus.PENDING,
          now: new Date(),
        }
      )
      .getCount();

    if (activeCount === 0) {
      throw new BadRequestException(SLOT_AVAILABLE_MESSAGE);
    }
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

  private normalizeSlotWindow(
    startTimeIso: string,
    endTimeIso: string,
    options?: { allowPastStart?: boolean }
  ): { startTime: Date; endTime: Date } {
    const startTime = new Date(startTimeIso);
    const endTime = new Date(endTimeIso);
    if (
      Number.isNaN(startTime.getTime()) ||
      Number.isNaN(endTime.getTime()) ||
      startTime >= endTime
    ) {
      throw new BadRequestException(INVALID_TIME_RANGE_MESSAGE);
    }

    if (!options?.allowPastStart && startTime <= new Date()) {
      throw new BadRequestException(PAST_SLOT_MESSAGE);
    }

    return { startTime, endTime };
  }

  private assertRangeWithinLimit(from: Date, to: Date): void {
    const diffMs = to.getTime() - from.getTime();
    if (diffMs < 0) {
      throw new BadRequestException(INVALID_TIME_RANGE_MESSAGE);
    }
    const maxMs = MAX_LIST_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (diffMs > maxMs) {
      throw new BadRequestException(RANGE_TOO_LARGE_MESSAGE);
    }
  }

  private requireTenantId(tenantId?: string): string {
    const normalized = tenantId?.trim();
    if (!normalized) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
    return normalized;
  }

  private requireUserId(userId?: string): string {
    const normalized = userId?.trim();
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
    });
    await auditRepo.save(auditLog);
  }
}
