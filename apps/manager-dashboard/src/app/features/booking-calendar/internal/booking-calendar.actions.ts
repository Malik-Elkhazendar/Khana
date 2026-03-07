import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import {
  ActionDialogType,
  BookingErrorCode,
  DialogCopy,
  ERROR_CATEGORY_BY_CODE,
  ErrorCategory,
  ErrorRecoveryOption,
} from './booking-calendar.models';

export function resolveErrorCategory(
  code: string | null | undefined
): ErrorCategory | null {
  if (!code) return null;
  const normalized = code.toUpperCase() as BookingErrorCode;
  return ERROR_CATEGORY_BY_CODE[normalized] ?? 'unknown';
}

export function buildDialogCopy(
  type: ActionDialogType,
  t: (key: string, fallback: string) => string
): DialogCopy {
  switch (type) {
    case 'confirm':
      return {
        title: t('BOOKING_CALENDAR.DIALOG.CONFIRM_TITLE', 'Confirm booking'),
        message: t(
          'BOOKING_CALENDAR.DIALOG.CONFIRM_MESSAGE',
          'This will confirm the booking and notify the customer.'
        ),
        confirmLabel: t(
          'BOOKING_CALENDAR.DIALOG.CONFIRM_LABEL',
          'Confirm booking'
        ),
        confirmTone: 'primary',
      };
    case 'pay':
      return {
        title: t('BOOKING_CALENDAR.DIALOG.PAY_TITLE', 'Mark as paid'),
        message: t(
          'BOOKING_CALENDAR.DIALOG.PAY_MESSAGE',
          'This will mark the booking as paid.'
        ),
        confirmLabel: t('BOOKING_CALENDAR.DIALOG.PAY_LABEL', 'Mark paid'),
        confirmTone: 'secondary',
      };
    case 'cancel':
    default:
      return {
        title: t('BOOKING_CALENDAR.DIALOG.CANCEL_TITLE', 'Cancel booking'),
        message: t(
          'BOOKING_CALENDAR.DIALOG.CANCEL_MESSAGE',
          'This action is permanent and cannot be undone.'
        ),
        confirmLabel: t(
          'BOOKING_CALENDAR.DIALOG.CANCEL_LABEL',
          'Cancel booking'
        ),
        confirmTone: 'danger',
      };
  }
}

export function getActionSuccessMessage(
  type: ActionDialogType,
  t: (key: string, fallback: string) => string
): string {
  switch (type) {
    case 'confirm':
      return t('BOOKING_CALENDAR.TOAST.BOOKING_CONFIRMED', 'Booking confirmed');
    case 'pay':
      return t(
        'BOOKING_CALENDAR.TOAST.PAYMENT_MARKED_PAID',
        'Payment marked as paid'
      );
    case 'cancel':
    default:
      return t('BOOKING_CALENDAR.TOAST.BOOKING_CANCELLED', 'Booking cancelled');
  }
}

export function getErrorRecoveryOptions(
  category: ErrorCategory,
  t: (key: string, fallback: string) => string
): ErrorRecoveryOption[] {
  switch (category) {
    case 'network':
      return [
        {
          action: 'retry',
          label: t('BOOKING_CALENDAR.ERROR_RECOVERY.RETRY_NOW', 'Retry now'),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.NETWORK_RETRY_DESCRIPTION',
            'Reconnect and try loading bookings again.'
          ),
        },
        {
          action: 'dismiss',
          label: t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.KEEP_LAST_DATA',
            'Keep the last loaded calendar data.'
          ),
        },
      ];
    case 'server':
      return [
        {
          action: 'retry',
          label: t('BOOKING_CALENDAR.ERROR_RECOVERY.RETRY_NOW', 'Retry now'),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.SERVER_RETRY_DESCRIPTION',
            'Attempt to reload when the server responds.'
          ),
        },
        {
          action: 'refresh',
          label: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.REFRESH_DATA',
            'Refresh data'
          ),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.SERVER_REFRESH_DESCRIPTION',
            'Fetch the latest bookings once available.'
          ),
        },
      ];
    case 'validation':
      return [
        {
          action: 'dismiss',
          label: t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.VALIDATION_DISMISS_DESCRIPTION',
            'Review the inputs and try again.'
          ),
        },
      ];
    case 'conflict':
      return [
        {
          action: 'refresh',
          label: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.REFRESH_BOOKINGS',
            'Refresh bookings'
          ),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.CONFLICT_REFRESH_DESCRIPTION',
            'Reload to resolve conflicting updates.'
          ),
        },
        {
          action: 'dismiss',
          label: t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.KEEP_LAST_DATA',
            'Keep the last loaded calendar data.'
          ),
        },
      ];
    case 'auth':
      return [
        {
          action: 'refresh',
          label: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.REFRESH_SESSION',
            'Refresh session'
          ),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.AUTH_REFRESH_DESCRIPTION',
            'Refresh data after signing in again.'
          ),
        },
        {
          action: 'dismiss',
          label: t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.AUTH_DISMISS_DESCRIPTION',
            'Return to the last loaded calendar data.'
          ),
        },
      ];
    case 'not_found':
      return [
        {
          action: 'refresh',
          label: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.REFRESH_BOOKINGS',
            'Refresh bookings'
          ),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.NOT_FOUND_REFRESH_DESCRIPTION',
            'Reload to find an updated booking list.'
          ),
        },
      ];
    case 'unknown':
    default:
      return [
        {
          action: 'retry',
          label: t('BOOKING_CALENDAR.ERROR_RECOVERY.RETRY_NOW', 'Retry now'),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.UNKNOWN_RETRY_DESCRIPTION',
            'Try loading bookings again.'
          ),
        },
        {
          action: 'dismiss',
          label: t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
          description: t(
            'BOOKING_CALENDAR.ERROR_RECOVERY.KEEP_LAST_DATA',
            'Keep the last loaded calendar data.'
          ),
        },
      ];
  }
}

export function getErrorCategoryLabel(
  category: ErrorCategory,
  t: (key: string, fallback: string) => string
): string {
  switch (category) {
    case 'network':
      return t('BOOKING_CALENDAR.ERROR_CATEGORY.NETWORK', 'Network issue');
    case 'server':
      return t('BOOKING_CALENDAR.ERROR_CATEGORY.SERVER', 'Server error');
    case 'validation':
      return t(
        'BOOKING_CALENDAR.ERROR_CATEGORY.VALIDATION',
        'Validation issue'
      );
    case 'conflict':
      return t('BOOKING_CALENDAR.ERROR_CATEGORY.CONFLICT', 'Conflict detected');
    case 'auth':
      return t('BOOKING_CALENDAR.ERROR_CATEGORY.AUTH', 'Authorization issue');
    case 'not_found':
      return t(
        'BOOKING_CALENDAR.ERROR_CATEGORY.NOT_FOUND',
        'Booking not found'
      );
    case 'unknown':
    default:
      return t('BOOKING_CALENDAR.ERROR_CATEGORY.UNKNOWN', 'Unexpected error');
  }
}

export function statusLabel(
  status: BookingStatus,
  t: (key: string, fallback: string) => string
): string {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return t('BOOKING_CALENDAR.STATUS.CONFIRMED', 'Confirmed');
    case BookingStatus.PENDING:
      return t('BOOKING_CALENDAR.STATUS.PENDING', 'Pending');
    case BookingStatus.CANCELLED:
      return t('BOOKING_CALENDAR.STATUS.CANCELLED', 'Cancelled');
    case BookingStatus.COMPLETED:
      return t('BOOKING_CALENDAR.STATUS.COMPLETED', 'Completed');
    case BookingStatus.NO_SHOW:
      return t('BOOKING_CALENDAR.STATUS.NO_SHOW', 'No Show');
    default:
      return status;
  }
}

export function paymentLabel(
  status: PaymentStatus,
  t: (key: string, fallback: string) => string
): string {
  switch (status) {
    case PaymentStatus.PAID:
      return t('BOOKING_CALENDAR.PAYMENT.PAID', 'Paid');
    case PaymentStatus.PARTIALLY_PAID:
      return t('BOOKING_CALENDAR.PAYMENT.PARTIAL', 'Partial');
    case PaymentStatus.REFUNDED:
      return t('BOOKING_CALENDAR.PAYMENT.REFUNDED', 'Refunded');
    case PaymentStatus.PENDING:
      return t('BOOKING_CALENDAR.PAYMENT.UNPAID', 'Unpaid');
    default:
      return status;
  }
}
