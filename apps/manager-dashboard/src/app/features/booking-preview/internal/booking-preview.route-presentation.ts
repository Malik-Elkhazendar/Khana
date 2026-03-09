import {
  AlternativeSlotDto,
  ConflictType,
  FacilityListItemDto,
  PromoValidationReason,
} from '@khana/shared-dtos';
import { isValidTimeRange } from './booking-preview.recurrence';
import { ConflictSlotDto, TranslationParams } from './booking-preview.models';
import { BookingPreviewRouteStateBase } from './booking-preview.route-state';

export abstract class BookingPreviewRoutePresentationBase extends BookingPreviewRouteStateBase {
  isValidTimeRange(): boolean {
    return isValidTimeRange(this.startTime(), this.endTime());
  }

  formatTime(isoString: string | null | undefined): string {
    if (!isoString) {
      return '';
    }

    return this.localeFormat.formatDate(isoString, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatPrice(amount: number, currency: string): string {
    return this.localeFormat.formatCurrency(amount, currency);
  }

  facilityOptionLabel(facility: FacilityListItemDto): string {
    // Keep native select option labels single-direction to avoid bidi reordering glitches.
    return facility.name;
  }

  selectedFacilityRateLabel(): string {
    const facility = this.selectedFacility();
    if (!facility) {
      return '';
    }

    return `${this.formatPrice(
      facility.basePrice,
      facility.currency
    )}/${this.text('BOOKING_PREVIEW.FORM.HOUR_SUFFIX')}`;
  }

  text(key: string): string;
  text(key: string, fallback: string): string;
  text(key: string, params: TranslationParams): string;
  text(key: string, fallback: string, params: TranslationParams): string;
  text(
    key: string,
    fallbackOrParams?: string | TranslationParams,
    params?: TranslationParams
  ): string {
    const fallback =
      typeof fallbackOrParams === 'string' ? fallbackOrParams : undefined;
    const resolvedParams =
      typeof fallbackOrParams === 'string' ? params : fallbackOrParams;

    const translated = this.t(key, resolvedParams);
    return translated === key && fallback !== undefined ? fallback : translated;
  }

  retryCountdownMessage(seconds: number): string {
    return this.t('BOOKING_PREVIEW.RETRY.COUNTDOWN', {
      seconds,
      attempt: this.retryAttemptMessage(),
    });
  }

  alternativeSlotAriaLabel(alt: AlternativeSlotDto): string {
    const start = this.formatTime(alt.startTime);
    const end = this.formatTime(alt.endTime);
    return this.t('BOOKING_PREVIEW.ALTERNATIVES.SELECT_SLOT_ARIA', {
      start,
      end,
    });
  }

  trackConflictSlot(_: number, slot: ConflictSlotDto): string {
    return `${slot.startTime}|${slot.endTime}|${slot.status}|${
      slot.bookingReference ?? ''
    }`;
  }

  conflictSlotStatusTone(
    status: string
  ): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'BOOKED':
        return 'warning';
      case 'BLOCKED':
        return 'danger';
      case 'MAINTENANCE':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  conflictSlotStatusLabel(status: string): string {
    switch (status) {
      case 'BOOKED':
        return this.t('BOOKING_PREVIEW.SLOT_STATUS.BOOKED');
      case 'BLOCKED':
        return this.t('BOOKING_PREVIEW.SLOT_STATUS.BLOCKED');
      case 'MAINTENANCE':
        return this.t('BOOKING_PREVIEW.SLOT_STATUS.MAINTENANCE');
      default:
        return this.t('BOOKING_PREVIEW.SLOT_STATUS.UNKNOWN');
    }
  }

  conflictSlotAriaLabel(slot: ConflictSlotDto): string {
    const start = this.formatTime(slot.startTime);
    const end = this.formatTime(slot.endTime);
    const status = this.conflictSlotStatusLabel(slot.status);
    return this.t('BOOKING_PREVIEW.CONFLICT.SLOT_ARIA', { status, start, end });
  }

  formatConflictType(type: ConflictType | undefined): string {
    switch (type) {
      case ConflictType.EXACT_OVERLAP:
        return this.t('BOOKING_PREVIEW.CONFLICT.EXACT_OVERLAP');
      case ConflictType.CONTAINED_WITHIN:
        return this.t('BOOKING_PREVIEW.CONFLICT.CONTAINED_WITHIN');
      case ConflictType.PARTIAL_START_OVERLAP:
        return this.t('BOOKING_PREVIEW.CONFLICT.PARTIAL_START_OVERLAP');
      case ConflictType.PARTIAL_END_OVERLAP:
        return this.t('BOOKING_PREVIEW.CONFLICT.PARTIAL_END_OVERLAP');
      case ConflictType.CONTAINS_EXISTING:
        return this.t('BOOKING_PREVIEW.CONFLICT.CONTAINS_EXISTING');
      default:
        return this.t('BOOKING_PREVIEW.CONFLICT.DEFAULT');
    }
  }

  protected promoValidationReasonKey(reason?: PromoValidationReason): string {
    switch (reason) {
      case PromoValidationReason.INVALID_FORMAT:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.INVALID_FORMAT';
      case PromoValidationReason.NOT_FOUND:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.NOT_FOUND';
      case PromoValidationReason.INACTIVE:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.INACTIVE';
      case PromoValidationReason.EXPIRED:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.EXPIRED';
      case PromoValidationReason.FACILITY_MISMATCH:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.FACILITY_MISMATCH';
      case PromoValidationReason.USAGE_EXCEEDED:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.USAGE_EXCEEDED';
      case PromoValidationReason.EMPTY_CODE:
      default:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.INVALID_GENERIC';
    }
  }

  protected t(key: string, params?: TranslationParams): string {
    this.languageService?.languageVersion();
    const translated = this.translateService?.instant(key, params);
    return translated && translated !== key ? translated : key;
  }
}
