import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import {
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';
import { LocaleFormatService } from '../../../shared/services/locale-format.service';
import { LanguageService } from '../../../shared/services/language.service';
import { UiStatusBadgeComponent } from '../../../shared/components';

/**
 * Focus-trapped booking detail side panel used by the calendar view for quick
 * inspection and action dispatch without leaving the scheduling surface.
 */
@Component({
  selector: 'app-calendar-booking-detail',
  standalone: true,
  imports: [CommonModule, UiStatusBadgeComponent],
  templateUrl: './calendar-booking-detail.component.html',
  styleUrl: './calendar-booking-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarBookingDetailComponent implements AfterViewInit {
  @Input() booking: BookingListItemDto | null = null;
  @Input() loading = false;
  @Input() loadError: string | null = null;
  @Input() canManageActions = false;
  @Input() actionsDisabled = false;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() cancelRequested = new EventEmitter<void>();
  @Output() markPaidRequested = new EventEmitter<void>();
  @Output() viewFullDetailsRequested = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  readonly PaymentStatus = PaymentStatus;

  private readonly localeFormat = inject(LocaleFormatService);
  private readonly languageService = inject(LanguageService, {
    optional: true,
  });
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      const closeButton = this.closeButton?.nativeElement;
      if (closeButton) {
        closeButton.focus();
        return;
      }
      this.panel?.nativeElement?.focus();
    });
  }

  get bookingReference(): string {
    return this.booking?.bookingReference ?? this.booking?.id ?? '';
  }

  get promoCode(): string | null {
    return this.booking?.priceBreakdown?.promoCode ?? null;
  }

  get promoDiscount(): number {
    return this.toFiniteNumber(this.booking?.priceBreakdown?.promoDiscount);
  }

  get showPromo(): boolean {
    return Boolean(this.promoCode);
  }

  get showPaidBookingNote(): boolean {
    const paymentStatus = this.booking?.paymentStatus;
    return (
      paymentStatus === PaymentStatus.PAID ||
      paymentStatus === PaymentStatus.PARTIALLY_PAID
    );
  }

  get markPaidDisabled(): boolean {
    if (this.actionsDisabled) return true;
    return this.booking?.paymentStatus === PaymentStatus.PAID;
  }

  get cancelDisabled(): boolean {
    if (this.actionsDisabled) return true;
    const paymentStatus = this.booking?.paymentStatus;
    return (
      paymentStatus === PaymentStatus.PAID ||
      paymentStatus === PaymentStatus.PARTIALLY_PAID
    );
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeRequested.emit();
      return;
    }

    if (event.key !== 'Tab') return;
    const panel = this.panel?.nativeElement;
    if (!panel) return;

    const focusable = this.getFocusableElements(panel);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  statusTone(
    status: BookingStatus
  ): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case BookingStatus.CONFIRMED:
      case BookingStatus.COMPLETED:
        return 'success';
      case BookingStatus.PENDING:
        return 'warning';
      case BookingStatus.CANCELLED:
      case BookingStatus.NO_SHOW:
        return 'danger';
      default:
        return 'neutral';
    }
  }

  paymentTone(status: PaymentStatus): 'success' | 'warning' | 'neutral' {
    switch (status) {
      case PaymentStatus.PAID:
        return 'success';
      case PaymentStatus.PARTIALLY_PAID:
        return 'warning';
      default:
        return 'neutral';
    }
  }

  statusLabel(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.CONFIRMED:
        return this.t('BOOKING_CALENDAR.STATUS.CONFIRMED', 'Confirmed');
      case BookingStatus.PENDING:
        return this.t('BOOKING_CALENDAR.STATUS.PENDING', 'Pending');
      case BookingStatus.CANCELLED:
        return this.t('BOOKING_CALENDAR.STATUS.CANCELLED', 'Cancelled');
      case BookingStatus.COMPLETED:
        return this.t('BOOKING_CALENDAR.STATUS.COMPLETED', 'Completed');
      case BookingStatus.NO_SHOW:
        return this.t('BOOKING_CALENDAR.STATUS.NO_SHOW', 'No Show');
      default:
        return status;
    }
  }

  paymentLabel(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PAID:
        return this.t('BOOKING_CALENDAR.PAYMENT.PAID', 'Paid');
      case PaymentStatus.PARTIALLY_PAID:
        return this.t('BOOKING_CALENDAR.PAYMENT.PARTIAL', 'Partial');
      case PaymentStatus.REFUNDED:
        return this.t('BOOKING_CALENDAR.PAYMENT.REFUNDED', 'Refunded');
      case PaymentStatus.PENDING:
        return this.t('BOOKING_CALENDAR.PAYMENT.UNPAID', 'Unpaid');
      default:
        return status;
    }
  }

  formatDate(isoString: string): string {
    return this.localeFormat.formatDate(isoString, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
    });
  }

  formatTime(isoString: string): string {
    return this.localeFormat.formatDate(isoString, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatCurrency(amount: number, currency = 'SAR'): string {
    return this.localeFormat.formatCurrency(amount, currency, {
      maximumFractionDigits: 2,
    });
  }

  text(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    return this.t(key, fallback, params);
  }

  private t(
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

  private interpolateFallback(
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    if (!params) return fallback;
    return fallback.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_match, token: string) => {
        const value = params[token];
        return value === undefined || value === null ? '' : String(value);
      }
    );
  }

  private toFiniteNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];
    return Array.from(
      container.querySelectorAll<HTMLElement>(selectors.join(','))
    );
  }
}
