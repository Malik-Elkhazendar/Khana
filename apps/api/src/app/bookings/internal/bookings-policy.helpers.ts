import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Booking, Facility } from '@khana/data-access';
import { Repository } from 'typeorm';
import { BookingStatus, UserRole } from '@khana/shared-dtos';
import { AppLoggerService, LOG_EVENTS } from '../../logging';

export function requireTenantId(
  tenantId: string | undefined,
  accessDeniedMessage: string
): string {
  if (!tenantId?.trim()) {
    throw new ForbiddenException(accessDeniedMessage);
  }

  return tenantId;
}

export function requireUserId(
  userId: string | undefined,
  accessDeniedMessage: string
): string {
  if (!userId?.trim()) {
    throw new ForbiddenException(accessDeniedMessage);
  }

  return userId;
}

export function requireUserRole(
  role: string | undefined,
  accessDeniedMessage: string
): UserRole {
  if (
    role === UserRole.OWNER ||
    role === UserRole.MANAGER ||
    role === UserRole.STAFF ||
    role === UserRole.VIEWER
  ) {
    return role;
  }

  throw new ForbiddenException(accessDeniedMessage);
}

export function isStaff(role: UserRole): boolean {
  return role === UserRole.STAFF;
}

export function isViewer(role: UserRole): boolean {
  return role === UserRole.VIEWER;
}

export async function validateFacilityOwnership(params: {
  facilityRepository: Repository<Facility>;
  facilityId: string;
  tenantId: string;
  resourceNotFoundMessage: string;
  accessDeniedMessage: string;
  inactiveFacilityMessage: string;
  activeOnly?: boolean;
}): Promise<Facility> {
  const facility = await params.facilityRepository.findOne({
    where: { id: params.facilityId },
    relations: { tenant: true },
  });

  if (!facility) {
    throw new NotFoundException(params.resourceNotFoundMessage);
  }

  if (facility.tenant.id !== params.tenantId) {
    throw new ForbiddenException(params.accessDeniedMessage);
  }

  if (params.activeOnly && !facility.isActive) {
    throw new ConflictException(params.inactiveFacilityMessage);
  }

  return facility;
}

export function resolveCreateStatus(status?: BookingStatus): BookingStatus {
  if (typeof status === 'undefined') {
    return BookingStatus.CONFIRMED;
  }

  if (status !== BookingStatus.PENDING) {
    throw new BadRequestException(
      'Only PENDING status may be provided during booking creation.'
    );
  }

  return status;
}

export async function validateBookingOwnership(params: {
  bookingRepository: Repository<Booking>;
  bookingId: string;
  tenantId: string;
  resourceNotFoundMessage: string;
  accessDeniedMessage: string;
}): Promise<Booking> {
  const booking = await params.bookingRepository.findOne({
    where: { id: params.bookingId },
    relations: { facility: { tenant: true } },
  });

  if (!booking) {
    throw new NotFoundException(params.resourceNotFoundMessage);
  }

  if (booking.facility.tenant.id !== params.tenantId) {
    throw new ForbiddenException(params.accessDeniedMessage);
  }

  return booking;
}

const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.NO_SHOW]: [],
};

export function validateStatusTransition(
  currentStatus: BookingStatus,
  nextStatus: BookingStatus,
  appLogger: AppLoggerService
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowedTransitions.includes(nextStatus)) {
    appLogger.warn(
      LOG_EVENTS.BOOKING_STATUS_INVALID_TRANSITION,
      'Invalid booking status transition',
      { currentStatus, nextStatus }
    );
    throw new BadRequestException('Invalid booking status transition.');
  }
}
