import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  JoinWaitlistResponseDto,
  UserRole,
  WaitlistStatus,
} from '@khana/shared-dtos';
import { EmailService, WhatsAppService } from '@khana/notifications';
import { Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../../../logging';

export const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
export const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
export const SLOT_AVAILABLE_MESSAGE =
  'Slot is currently available. Waitlist is only supported for unavailable slots.';
export const INVALID_TIME_RANGE_MESSAGE = 'Start time must be before end time.';
export const PAST_SLOT_MESSAGE = 'You can only join waitlist for future slots.';
export const RANGE_TOO_LARGE_MESSAGE =
  'Date range is too large. Maximum allowed range is 93 days.';
export const EXPIRE_NOT_ALLOWED_MESSAGE =
  'Only WAITING or NOTIFIED waitlist entries can be expired manually.';
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_LIST_RANGE_DAYS = 93;

export const ACTIVE_WAITLIST_STATUSES = [
  WaitlistStatus.WAITING,
  WaitlistStatus.NOTIFIED,
] as const;
export const WAITING_STATUS = [WaitlistStatus.WAITING] as const;

export type WaitlistDependencies = {
  waitlistRepository: Repository<WaitingListEntry>;
  bookingRepository: Repository<Booking>;
  facilityRepository: Repository<Facility>;
  userRepository: Repository<User>;
  appLogger: AppLoggerService;
  emailService: EmailService;
  whatsAppService: WhatsAppService;
};

export type WaitlistAuditParams = {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description?: string;
  changes?: Record<string, unknown>;
};

export const toJoinResponse = (
  entry: WaitingListEntry,
  queuePosition: number
): JoinWaitlistResponseDto => {
  return {
    entryId: entry.id,
    status: entry.status,
    queuePosition: normalizeQueuePosition(queuePosition),
    desiredTimeSlot: {
      startTime: entry.desiredStartTime.toISOString(),
      endTime: entry.desiredEndTime.toISOString(),
    },
    createdAt: entry.createdAt.toISOString(),
  };
};

export const normalizeQueuePosition = (
  queuePosition: number | null | undefined
): number => {
  if (!Number.isFinite(queuePosition) || (queuePosition ?? 0) < 1) {
    return 1;
  }

  return Math.floor(queuePosition);
};

export const resolveQueuePosition = async (
  waitlistRepo: Repository<WaitingListEntry>,
  entry: WaitingListEntry
): Promise<number> => {
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
};

export const assertSlotUnavailable = async (
  deps: WaitlistDependencies,
  facilityId: string,
  startTime: Date,
  endTime: Date,
  tenantId: string
): Promise<void> => {
  const activeCount = await deps.bookingRepository
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
};

export const validateFacilityOwnership = async (
  deps: WaitlistDependencies,
  facilityId: string,
  tenantId: string
): Promise<Facility> => {
  const facility = await deps.facilityRepository.findOne({
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
};

export const normalizeSlotWindow = (
  startTimeIso: string,
  endTimeIso: string,
  options?: { allowPastStart?: boolean }
): { startTime: Date; endTime: Date } => {
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
};

export const assertRangeWithinLimit = (from: Date, to: Date): void => {
  const diffMs = to.getTime() - from.getTime();
  if (diffMs < 0) {
    throw new BadRequestException(INVALID_TIME_RANGE_MESSAGE);
  }
  const maxMs = MAX_LIST_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (diffMs > maxMs) {
    throw new BadRequestException(RANGE_TOO_LARGE_MESSAGE);
  }
};

export const requireTenantId = (tenantId?: string): string => {
  const normalized = tenantId?.trim();
  if (!normalized) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
  return normalized;
};

export const requireUserId = (userId?: string): string => {
  const normalized = userId?.trim();
  if (!normalized) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
  return normalized;
};

export const requireUserRole = (role?: string): UserRole => {
  if (
    role === UserRole.OWNER ||
    role === UserRole.MANAGER ||
    role === UserRole.STAFF ||
    role === UserRole.VIEWER
  ) {
    return role;
  }
  throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
};

export const logAudit = async (
  auditRepo: Repository<AuditLog>,
  params: WaitlistAuditParams
): Promise<void> => {
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
};

export const logWaitlistInfo = (
  deps: WaitlistDependencies,
  event: string,
  message: string,
  context: Record<string, unknown>
): void => {
  deps.appLogger.info(event, message, context);
};

export const logWaitlistWarn = (
  deps: WaitlistDependencies,
  event: string,
  message: string,
  context: Record<string, unknown>
): void => {
  deps.appLogger.warn(event, message, context);
};

export const logWaitlistError = (
  deps: WaitlistDependencies,
  event: string,
  message: string,
  context: Record<string, unknown>,
  error: unknown
): void => {
  deps.appLogger.error(event, message, context, error);
};

export { LOG_EVENTS };
