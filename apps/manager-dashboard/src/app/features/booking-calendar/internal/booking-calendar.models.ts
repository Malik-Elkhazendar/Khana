import {
  BookingCancellationScope,
  BookingListItemDto,
} from '@khana/shared-dtos';

export type ToastNotice = { message: string; tone: 'success' | 'error' };

export type ActionDialogType = 'confirm' | 'cancel' | 'pay';
export type ActionDialogState = { type: ActionDialogType; bookingId: string };
export type DialogCopy = {
  title: string;
  message: string;
  confirmLabel: string;
  confirmTone: 'primary' | 'secondary' | 'danger';
};

export type BookingErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export type ErrorCategory =
  | 'network'
  | 'server'
  | 'validation'
  | 'conflict'
  | 'auth'
  | 'not_found'
  | 'unknown';

export type ErrorRecoveryAction = 'retry' | 'refresh' | 'dismiss';
export type ErrorRecoveryOption = {
  action: ErrorRecoveryAction;
  label: string;
  description: string;
};

export type BookingLayout = { column: number; columns: number };
export type BookingLayoutMap = Map<string, BookingLayout>;
export type LayoutMetrics = { layout: BookingLayoutMap; durationMs: number };
export type BookingCardDensity = 'compact' | 'standard' | 'expanded';
export type BookingCardPresentation = {
  density: BookingCardDensity;
  showTagChip: boolean;
  showTagDot: boolean;
  showFacility: boolean;
};
export type BookingCardTypographyMetrics = {
  paddingBlockPx: number;
  rowGapPx: number;
  nameLineHeightPx: number;
  metaLineHeightPx: number;
};
export type BookingPresentationMetrics = {
  availableBlockPx: number;
  availableInlinePx: number;
  hasOverlap: boolean;
  hasTags: boolean;
  typography: BookingCardTypographyMetrics | null;
};

export type BookingCardStyle = {
  top: string;
  height: string;
  width: string;
  left: string;
  zIndex: string;
};

export type BookingSegment = {
  id: string;
  booking: BookingListItemDto;
  startMs: number;
  endMs: number;
  startHour: number;
  startMinutes: number;
  durationMs: number;
  dayKey: string;
};

export type SlotFocus = { dayIndex: number; hourIndex: number };

export const AUTO_RETRY_MAX_ATTEMPTS = 3;
export const AUTO_RETRY_BASE_DELAY_MS = 800;
export const AUTO_RETRY_MAX_DELAY_MS = 8000;
export const NAVIGATION_THROTTLE_MS = 200;
export const ERROR_DESCRIPTION_ID = 'calendar-error';
export const DAYS_IN_WEEK = 7;

export const ERROR_CATEGORY_BY_CODE: Record<BookingErrorCode, ErrorCategory> = {
  NETWORK: 'network',
  SERVER_ERROR: 'server',
  VALIDATION: 'validation',
  CONFLICT: 'conflict',
  UNAUTHORIZED: 'auth',
  FORBIDDEN: 'auth',
  NOT_FOUND: 'not_found',
  UNKNOWN: 'unknown',
};

export const DEFAULT_BOOKING_LAYOUT: BookingLayout = { column: 0, columns: 1 };
export const CANCELLATION_SCOPES = BookingCancellationScope;
