import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import {
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';
import { BookingStore } from '../../state/bookings/booking.store';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { LanguageService } from '../../shared/services/language.service';
import { UiStatusBadgeComponent } from '../../shared/components';

/**
 * Booking detail page that loads one booking record from the shared booking
 * store and formats the view for customer-facing operational follow-up.
 */
@Component({
  selector: 'app-booking-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, UiStatusBadgeComponent],
  templateUrl: './booking-detail.component.html',
  styleUrl: './booking-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingDetailComponent {
  readonly store = inject(BookingStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly languageService = inject(LanguageService, {
    optional: true,
  });
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });

  readonly bookingId = signal<string | null>(null);
  readonly booking = computed(() => {
    const id = this.bookingId();
    if (!id) return null;
    return this.store.getBookingDetail(id);
  });
  readonly loading = computed(() => {
    const id = this.bookingId();
    if (!id) return false;
    return Boolean(this.store.detailLoadingById()[id]);
  });
  readonly loadError = computed(() => {
    const id = this.bookingId();
    if (!id) return null;
    return this.store.detailErrorsById()[id] ?? null;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (params) => {
        const id = params.get('id');
        this.bookingId.set(id);
        if (!id) return;
        this.store.clearBookingDetailError(id);
        void this.store.loadBookingById(id);
      },
    });
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

  formatDate(value: string): string {
    return this.localeFormat.formatDate(value, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }

  formatTime(value: string): string {
    return this.localeFormat.formatDate(value, {
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

  promoDiscountAmount(detail: BookingListItemDto): number {
    return this.toCurrencyAmount(detail.priceBreakdown?.promoDiscount);
  }

  totalAmountValue(detail: BookingListItemDto): number {
    return this.toCurrencyAmount(detail.totalAmount);
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

  private toCurrencyAmount(value: number | string | null | undefined): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }
}
