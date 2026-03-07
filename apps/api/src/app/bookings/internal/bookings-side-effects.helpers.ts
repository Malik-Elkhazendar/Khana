import { EmailService } from '@khana/notifications';
import {
  AuditAction,
  AuditLog,
  Booking,
  Facility,
  User,
} from '@khana/data-access';
import { Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../../logging';

export async function sendBookingCreatedEmails(params: {
  booking: Booking;
  facility: Facility;
  userId: string;
  userRepository: Repository<User>;
  emailService: EmailService;
  appLogger: AppLoggerService;
}): Promise<void> {
  const user = await params.userRepository.findOne({
    where: { id: params.userId },
    select: ['id', 'email', 'name'],
  });

  if (user) {
    try {
      await params.emailService.sendBookingConfirmation({
        recipientEmail: user.email,
        customerName: params.booking.customerName,
        customerPhone: params.booking.customerPhone,
        bookingReference: params.booking.bookingReference ?? params.booking.id,
        facilityName: params.facility.name,
        startTime: params.booking.startTime,
        endTime: params.booking.endTime,
        totalAmount: params.booking.totalAmount,
        currency: params.booking.currency,
      });
    } catch (err) {
      params.appLogger.error(
        LOG_EVENTS.EMAIL_FAILED,
        'Failed to send booking confirmation',
        { bookingId: params.booking.id },
        err
      );
    }
  }

  const managers = await params.userRepository.find({
    where: [
      {
        tenantId: params.facility.tenant.id,
        role: 'OWNER',
        isActive: true,
      },
      {
        tenantId: params.facility.tenant.id,
        role: 'MANAGER',
        isActive: true,
      },
    ],
    select: ['id', 'email', 'name'],
  });

  for (const manager of managers) {
    if (manager.id === params.userId) {
      continue;
    }

    try {
      await params.emailService.sendNewBookingAlert({
        managerEmail: manager.email,
        managerName: manager.name,
        customerName: params.booking.customerName,
        customerPhone: params.booking.customerPhone,
        bookingReference: params.booking.bookingReference ?? params.booking.id,
        facilityName: params.facility.name,
        startTime: params.booking.startTime,
        endTime: params.booking.endTime,
        totalAmount: params.booking.totalAmount,
        currency: params.booking.currency,
      });
    } catch (err) {
      params.appLogger.error(
        LOG_EVENTS.EMAIL_FAILED,
        'Failed to send new booking alert',
        { bookingId: params.booking.id },
        err
      );
    }
  }
}

export async function sendCancellationEmail(params: {
  booking: Booking;
  userRepository: Repository<User>;
  emailService: EmailService;
  appLogger: AppLoggerService;
}): Promise<void> {
  if (!params.booking.createdByUserId) {
    return;
  }

  const user = await params.userRepository.findOne({
    where: { id: params.booking.createdByUserId },
    select: ['id', 'email'],
  });

  if (!user) {
    return;
  }

  const facilityName = params.booking.facility?.name ?? 'Unknown Facility';

  try {
    await params.emailService.sendCancellationNotification({
      recipientEmail: user.email,
      customerName: params.booking.customerName,
      bookingReference: params.booking.bookingReference ?? params.booking.id,
      facilityName,
      startTime: params.booking.startTime,
      endTime: params.booking.endTime,
      reason: params.booking.cancellationReason ?? 'No reason provided',
    });
  } catch (err) {
    params.appLogger.error(
      LOG_EVENTS.EMAIL_FAILED,
      'Failed to send cancellation email',
      { bookingId: params.booking.id },
      err
    );
  }
}

export async function saveBookingAuditLog(params: {
  auditLogRepository: Repository<AuditLog>;
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description?: string;
  changes?: Record<string, unknown>;
}): Promise<void> {
  const auditLog = params.auditLogRepository.create({
    tenantId: params.tenantId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
    changes: params.changes,
  });

  await params.auditLogRepository.save(auditLog);
}
