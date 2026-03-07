import {
  AlternativeSlotDto,
  BookingPreviewResponseDto,
  CustomerSummaryDto,
} from '@khana/shared-dtos';

export type PreviewAction = 'facilities' | 'preview' | 'booking';
export type PreviewErrorCategory =
  | 'network'
  | 'validation'
  | 'server'
  | 'unknown';

export type PreviewError = {
  action: PreviewAction;
  category: PreviewErrorCategory;
  message: string;
  status?: number;
};

export type PreviewRequestPayload = {
  facilityId: string;
  startTime: string;
  endTime: string;
  promoCode?: string;
};

export type OfflineAction = {
  action: Extract<PreviewAction, 'facilities' | 'preview'>;
  payload?: PreviewRequestPayload;
  queuedAt: number;
};

export type RecurrenceEndMode = 'COUNT' | 'DATE';
export type BookingSubmissionMode = 'CONFIRMED' | 'HOLD';
export type RecurringPresetKey =
  | 'FOUR_WEEKS'
  | 'EIGHT_WEEKS'
  | 'THREE_MONTHS'
  | 'SIX_MONTHS';
export type RecurringPresetDefinition = {
  key: RecurringPresetKey;
  weeks: number;
  labelKey: `BOOKING_PREVIEW.RECURRING_PRESETS.${RecurringPresetKey}`;
};

export type ErrorRecoveryAction = 'retry' | 'refresh' | 'dismiss';
export type ErrorRecoveryOption = {
  action: ErrorRecoveryAction;
  label: string;
  description: string;
};

export type PreviewStateSnapshot = {
  loading: boolean;
  facilitiesLoading: boolean;
  bookingInProgress: boolean;
  bookingSuccess: boolean;
  hasError: boolean;
  hasPreview: boolean;
  confirmDialogOpen: boolean;
};

export type BookingPrefillQueryParams = {
  facilityId: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
};

export type ConflictSlotDto = NonNullable<
  BookingPreviewResponseDto['conflict']
>['conflictingSlots'][number];
export type TranslationParams = Record<string, string | number>;

export const PREVIEW_CACHE_TTL_MS = 2 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 15_000;
export const AUTO_RETRY_MAX_ATTEMPTS = 3;
export const AUTO_RETRY_BASE_DELAY_MS = 800;
export const AUTO_RETRY_MAX_DELAY_MS = 8000;
export const AUTO_RETRY_JITTER_MS = 200;
export const SUBMIT_DEBOUNCE_MS = 300;
export const STALE_PREVIEW_MS = 5 * 60 * 1000;
export const ALTERNATIVES_EAGER_THRESHOLD = 6;
export const ALTERNATIVES_VIRTUAL_THRESHOLD = 100;
export const ALTERNATIVES_ROW_HEIGHT_PX = 72;
export const ALTERNATIVES_WINDOW_SIZE = 18;
export const CUSTOMER_TAG_MAX_LENGTH = 30;
export const CUSTOMER_TAG_MAX_COUNT = 10;

export const RECURRING_PRESETS: ReadonlyArray<RecurringPresetDefinition> = [
  {
    key: 'FOUR_WEEKS',
    weeks: 4,
    labelKey: 'BOOKING_PREVIEW.RECURRING_PRESETS.FOUR_WEEKS',
  },
  {
    key: 'EIGHT_WEEKS',
    weeks: 8,
    labelKey: 'BOOKING_PREVIEW.RECURRING_PRESETS.EIGHT_WEEKS',
  },
  {
    key: 'THREE_MONTHS',
    weeks: 13,
    labelKey: 'BOOKING_PREVIEW.RECURRING_PRESETS.THREE_MONTHS',
  },
  {
    key: 'SIX_MONTHS',
    weeks: 26,
    labelKey: 'BOOKING_PREVIEW.RECURRING_PRESETS.SIX_MONTHS',
  },
];

export type AlternativesWindow = {
  items: AlternativeSlotDto[];
  paddingTop: number;
  paddingBottom: number;
  totalHeight: number;
};

export type WaitlistStatusQuery = {
  facilityId: string;
  startTime: string;
  endTime: string;
};

export type CustomerTagTarget = Pick<CustomerSummaryDto, 'id' | 'tags'>;
