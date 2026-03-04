import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  BookingStatus,
  PaymentStatus,
  TodaySnapshotDto,
  WaitlistStatus,
} from '@khana/shared-dtos';
import { TranslateModule } from '@ngx-translate/core';
import { LocaleFormatService } from '../../../shared/services/locale-format.service';
import { AuthStore } from '../../../shared/state/auth.store';

@Component({
  selector: 'app-today-snapshot',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './today-snapshot.component.html',
  styleUrl: './today-snapshot.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodaySnapshotComponent {
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly localeFormat = inject(LocaleFormatService);

  readonly snapshot = input<TodaySnapshotDto | null>(null);
  readonly loading = input(false);
  readonly facilityId = input<string | null>(null);

  readonly firstName = computed(() => {
    const name = this.authStore.user()?.name?.trim();
    if (!name) {
      return null;
    }

    const [first] = name.split(/\s+/);
    return first?.trim() || null;
  });

  readonly greetingPeriod = computed<'MORNING' | 'AFTERNOON' | 'EVENING'>(
    () => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour <= 11) {
        return 'MORNING';
      }
      if (hour >= 12 && hour <= 17) {
        return 'AFTERNOON';
      }
      return 'EVENING';
    }
  );

  readonly greetingKey = computed(() => {
    const period = this.greetingPeriod();
    if (this.firstName()) {
      return `DASHBOARD.PAGES.ANALYTICS.SNAPSHOT.GREETING_${period}`;
    }
    return `DASHBOARD.PAGES.ANALYTICS.SNAPSHOT.GREETING_ANONYMOUS_${period}`;
  });

  readonly hasUrgentItems = computed(() => {
    const snapshot = this.snapshot();
    if (!snapshot) {
      return false;
    }

    return (
      snapshot.unpaidCount > 0 ||
      snapshot.expiringHoldsCount > 0 ||
      snapshot.noShowCount > 0 ||
      snapshot.notifiedWaitlistCount > 0
    );
  });

  readonly isAllClear = computed(() => {
    const snapshot = this.snapshot();
    return snapshot !== null && !this.hasUrgentItems();
  });

  readonly todayLabel = computed(() => {
    return this.localeFormat.formatDate(new Date(), {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  });

  formatCurrency(value: number): string {
    return this.localeFormat.formatCurrency(value, 'SAR', {
      maximumFractionDigits: 2,
    });
  }

  goToUnpaidBookings(): void {
    void this.router.navigate(['/dashboard/bookings'], {
      queryParams: { paymentStatus: PaymentStatus.PENDING },
    });
  }

  goToExpiringHolds(): void {
    void this.router.navigate(['/dashboard/bookings'], {
      queryParams: { status: BookingStatus.PENDING },
    });
  }

  goToWaitlistWaiting(): void {
    void this.router.navigate(['/dashboard/waitlist'], {
      queryParams: { date: 'today' },
    });
  }

  goToNotifiedWaitlist(): void {
    void this.router.navigate(['/dashboard/waitlist'], {
      queryParams: { status: WaitlistStatus.NOTIFIED },
    });
  }

  goToNoShows(): void {
    void this.router.navigate(['/dashboard/bookings'], {
      queryParams: { status: BookingStatus.NO_SHOW },
    });
  }
}
