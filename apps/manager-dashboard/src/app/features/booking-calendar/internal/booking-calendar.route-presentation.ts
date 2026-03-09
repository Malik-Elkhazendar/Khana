import {
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';
import { resolveTagColorClass } from '../../../shared/components';
import {
  buildDialogCopy,
  getActionSuccessMessage,
  getErrorCategoryLabel,
  getErrorRecoveryOptions,
  paymentLabel,
  statusLabel,
} from './booking-calendar.actions';
import {
  formatDateForInput,
  getTodayDate,
  isSameCalendarDay,
  nextWeekDate,
  parseDateInput,
  previousWeekDate,
} from './booking-calendar.date';
import { getBookingsForSlot, getBookingStyle } from './booking-calendar.layout';
import {
  ActionDialogType,
  BookingCardPresentation,
  BookingCardStyle,
  BookingLayout,
  BookingPresentationMetrics,
  BookingSegment,
  DialogCopy,
  ErrorCategory,
  ErrorRecoveryOption,
} from './booking-calendar.models';
import {
  buildBookingPresentation,
  getStatusClass,
  isHoldActive as isHoldActiveForBooking,
  paymentTone,
  statusTone,
} from './booking-calendar.presentation';
import { BookingCalendarRouteStateBase } from './booking-calendar.route-state';

export abstract class BookingCalendarRoutePresentationBase extends BookingCalendarRouteStateBase {
  protected abstract lockNavigation(): void;

  protected getDialogCopy(type: ActionDialogType): DialogCopy {
    return buildDialogCopy(type, (key, fallback) => this.t(key, fallback));
  }

  protected getActionSuccessMessage(type: ActionDialogType): string {
    return getActionSuccessMessage(type, (key, fallback) =>
      this.t(key, fallback)
    );
  }

  protected getErrorRecoveryOptions(
    category: ErrorCategory
  ): ErrorRecoveryOption[] {
    return getErrorRecoveryOptions(category, (key, fallback) =>
      this.t(key, fallback)
    );
  }

  protected getErrorCategoryLabel(category: ErrorCategory): string {
    return getErrorCategoryLabel(category, (key, fallback) =>
      this.t(key, fallback)
    );
  }

  text(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    return this.t(key, fallback, params);
  }

  timelineBookingAriaLabel(
    segment: BookingSegment,
    presentation: BookingCardPresentation
  ): string {
    const booking = segment.booking;
    return this.t(
      'BOOKING_CALENDAR.ARIA.TIMELINE_BOOKING_DETAILED',
      'Booking: {{name}}, {{start}} to {{end}}, {{status}}, {{facility}}{{tagsSuffix}}',
      {
        name: booking.customerName,
        start: this.formatTime(booking.startTime),
        end: this.formatTime(booking.endTime),
        status: this.statusLabel(booking.status),
        facility: booking.facility.name,
        tagsSuffix: this.tagsSuffixForAria(booking, presentation),
      }
    );
  }

  gridBookingAriaLabel(
    segment: BookingSegment,
    presentation: BookingCardPresentation
  ): string {
    const booking = segment.booking;
    return this.t(
      'BOOKING_CALENDAR.ARIA.GRID_BOOKING_DETAILED',
      'Booking: {{name}}, {{status}}, {{facility}}{{tagsSuffix}}',
      {
        name: booking.customerName,
        status: this.statusLabel(booking.status),
        facility: booking.facility.name,
        tagsSuffix: this.tagsSuffixForAria(booking, presentation),
      }
    );
  }

  holdUntilTitle(holdUntil: string | null | undefined): string | null {
    if (!holdUntil) {
      return null;
    }

    return this.t(
      'BOOKING_CALENDAR.ACTION_SHEET.HOLD_UNTIL',
      'Reserved until {{time}}',
      {
        time: this.formatTime(holdUntil),
      }
    );
  }

  protected tagsSuffixForAria(
    booking: BookingListItemDto,
    presentation: BookingCardPresentation
  ): string {
    if (presentation.showTagChip) {
      return '';
    }

    const tags = booking.customerTags?.map((tag) => tag.trim()).filter(Boolean);
    if (!tags || tags.length === 0) {
      return '';
    }

    return this.t('BOOKING_CALENDAR.ARIA.TAGS_SUFFIX', ', tags: {{tags}}', {
      tags: tags.join(', '),
    });
  }

  protected t(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    this.languageService?.languageVersion();
    const translated = this.translateService?.instant(key, params);
    if (translated && translated !== key) {
      return translated;
    }

    return this.interpolateFallback(fallback, params);
  }

  protected interpolateFallback(
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    if (!params) {
      return fallback;
    }

    return fallback.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_match, token: string) => {
        const value = params[token];
        return value === undefined || value === null ? '' : String(value);
      }
    );
  }

  getBookingsForSlot(day: Date, hour: string): BookingSegment[] {
    return getBookingsForSlot(this.bookingsMap(), day, hour);
  }

  getBookingLayout(segment: BookingSegment): BookingLayout {
    return this.bookingLayout().get(segment.id) ?? this.defaultLayout;
  }

  getBookingStyle(
    segment: BookingSegment,
    columnIndex: number,
    columnCount: number
  ): BookingCardStyle {
    return getBookingStyle(segment, columnIndex, columnCount);
  }

  getGridBookingPresentation(
    segment: BookingSegment,
    layout: BookingLayout
  ): BookingCardPresentation {
    return (
      this.gridCardPresentations().get(segment.id) ??
      buildBookingPresentation({
        availableBlockPx: 0,
        availableInlinePx: 0,
        hasOverlap: layout.columns > 1,
        hasTags: Boolean(segment.booking.customerTags?.length),
        typography: null,
      })
    );
  }

  getTimelineBookingPresentation(
    segment: BookingSegment,
    layout: BookingLayout
  ): BookingCardPresentation {
    return (
      this.timelineCardPresentations().get(segment.id) ??
      buildBookingPresentation({
        availableBlockPx: 0,
        availableInlinePx: 0,
        hasOverlap: layout.columns > 1,
        hasTags: Boolean(segment.booking.customerTags?.length),
        typography: null,
      })
    );
  }

  compactStatusCode(status: BookingStatus): string {
    const label = this.statusLabel(status).trim();
    return label ? label.charAt(0).toUpperCase() : '';
  }

  tagDotClass(tag: string | null | undefined): string {
    if (!tag) {
      return 'calendar__booking-tag-dot';
    }

    return `calendar__booking-tag-dot ${resolveTagColorClass(tag)}`;
  }

  protected buildBookingPresentation(
    metrics: BookingPresentationMetrics
  ): BookingCardPresentation {
    return buildBookingPresentation(metrics);
  }

  isToday(day: Date): boolean {
    return isSameCalendarDay(day, this.today());
  }

  previousWeek(): void {
    if (!this.canNavigate()) {
      return;
    }

    this.currentDate.set(previousWeekDate(this.currentDate()));
    this.lockNavigation();
  }

  nextWeek(): void {
    if (!this.canNavigate()) {
      return;
    }

    this.currentDate.set(nextWeekDate(this.currentDate()));
    this.lockNavigation();
  }

  goToToday(): void {
    if (!this.canNavigate()) {
      return;
    }

    const today = getTodayDate();
    this.currentDate.set(today);
    this.selectedDay.set(today);
    this.lockNavigation();
  }

  onJumpDateChange(event: Event): void {
    if (!this.canNavigate()) {
      return;
    }

    const input = event.target as HTMLInputElement | null;
    const parsedDate = parseDateInput(input?.value ?? '');
    if (!parsedDate) {
      return;
    }

    this.currentDate.set(parsedDate);
    this.selectedDay.set(parsedDate);
    this.lockNavigation();
  }

  selectDay(day: Date): void {
    this.selectedDay.set(day);
  }

  isSelectedDay(day: Date): boolean {
    return isSameCalendarDay(day, this.selectedDay());
  }

  getStatusClass(status: BookingStatus): string {
    return getStatusClass(status);
  }

  statusTone(
    status: BookingStatus
  ): 'success' | 'warning' | 'danger' | 'neutral' {
    return statusTone(status);
  }

  paymentTone(status: PaymentStatus): 'success' | 'warning' | 'neutral' {
    return paymentTone(status);
  }

  statusLabel(status: BookingStatus): string {
    return statusLabel(status, (key, fallback) => this.t(key, fallback));
  }

  paymentLabel(status: PaymentStatus): string {
    return paymentLabel(status, (key, fallback) => this.t(key, fallback));
  }

  formatDayNumber(day: Date): string {
    return this.localeFormat.formatDate(day, { day: 'numeric' });
  }

  formatHour(hour: string): string {
    const [hours] = hour.split(':').map(Number);
    return this.localeFormat.formatHourLabel(hours);
  }

  dayName(day: Date): string {
    return this.localeFormat.formatDate(day, { weekday: 'short' });
  }

  formatDateForInput(date: Date): string {
    return formatDateForInput(date);
  }

  slotAriaLabel(day: Date, hour: string, bookingCount: number): string {
    const dayLabel = `${this.dayName(day)} ${this.formatDayNumber(day)}`;
    const timeLabel = this.formatHour(hour);
    if (bookingCount === 0) {
      return this.t(
        'BOOKING_CALENDAR.ARIA.SLOT_NO_BOOKINGS',
        `${dayLabel} at ${timeLabel}. No bookings.`,
        { day: dayLabel, time: timeLabel }
      );
    }

    return this.t(
      'BOOKING_CALENDAR.ARIA.SLOT_BOOKING_COUNT',
      `${dayLabel} at ${timeLabel}. ${bookingCount} bookings.`,
      { day: dayLabel, time: timeLabel, count: bookingCount }
    );
  }

  formatDate(isoString: string): string {
    return this.localeFormat.formatDate(isoString, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
    });
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

  formatLastUpdated(timestamp: number | null): string {
    if (!timestamp) {
      return '';
    }

    return this.localeFormat.formatDate(timestamp, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  isHoldActive(booking: BookingListItemDto): boolean {
    return isHoldActiveForBooking(booking.status, booking.holdUntil);
  }

  trackByDay(_: number, day: Date): number {
    return day.getTime();
  }

  trackByHour(_: number, hour: string): string {
    return hour;
  }

  trackByBooking(_: number, segment: BookingSegment): string {
    return segment.id;
  }
}
