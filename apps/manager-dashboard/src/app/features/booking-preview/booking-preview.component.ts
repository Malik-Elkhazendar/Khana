import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, throwError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../shared/services/api.service';
import {
  FacilityListItemDto,
  BookingPreviewResponseDto,
  AlternativeSlotDto,
  BookingStatus,
  ConflictType,
} from '@khana/shared-dtos';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';

type PreviewAction = 'facilities' | 'preview' | 'booking';
type PreviewErrorCategory = 'network' | 'validation' | 'server' | 'unknown';

type PreviewError = {
  action: PreviewAction;
  category: PreviewErrorCategory;
  message: string;
  status?: number;
};

const PREVIEW_CACHE_TTL_MS = 2 * 60 * 1000;
const PREVIEW_ERROR_MESSAGES: Record<PreviewAction, string> = {
  facilities: 'Failed to load facilities. Please try again.',
  preview: 'Failed to preview booking. Please try again.',
  booking: 'Failed to create booking. Please try again.',
};
const CONFIRM_COPY = {
  title: 'Confirm booking',
  message: 'Review the details before creating this booking.',
  confirmLabel: 'Confirm booking',
  cancelLabel: 'Go back',
};
const CANCELLATION_POLICY_NOTE =
  'Cancellations follow the facility policy. Please review before confirming.';

@Component({
  selector: 'app-booking-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  templateUrl: './booking-preview.component.html',
  styleUrl: './booking-preview.component.scss',
})
export class BookingPreviewComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previewCache = new Map<
    string,
    { result: BookingPreviewResponseDto; expiresAt: number }
  >();
  readonly timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;
  readonly confirmCopy = CONFIRM_COPY;
  readonly cancellationPolicyNote = CANCELLATION_POLICY_NOTE;

  // Form state
  facilities = signal<FacilityListItemDto[]>([]);
  selectedFacilityId = signal<string>('');
  selectedDate = signal<string>(this.getDefaultDate());
  startTime = signal<string>('10:00');
  endTime = signal<string>('11:00');
  promoCode = signal<string>('');

  // Result state
  previewResult = signal<BookingPreviewResponseDto | null>(null);
  loading = signal<boolean>(false);
  error = signal<PreviewError | null>(null);
  lastAction = signal<'facilities' | 'preview' | 'booking' | null>(null);
  confirmDialogOpen = signal<boolean>(false);

  // Customer details (shown when booking is available)
  customerName = signal<string>('');
  customerPhone = signal<string>('');
  holdAsPending = signal<boolean>(false);
  bookingInProgress = signal<boolean>(false);
  bookingSuccess = signal<boolean>(false);
  bookingReference = signal<string | null>(null);

  // Computed values
  selectedFacility = computed(() => {
    return this.facilities().find((f) => f.id === this.selectedFacilityId());
  });

  canSubmit = computed(() => {
    return (
      this.selectedFacilityId().trim().length > 0 &&
      this.selectedDate().trim().length > 0 &&
      this.startTime().trim().length > 0 &&
      this.endTime().trim().length > 0 &&
      !this.loading()
    );
  });

  canBook = computed(() => {
    const result = this.previewResult();
    return (
      Boolean(result?.canBook) &&
      this.customerName().trim() !== '' &&
      this.customerPhone().trim() !== '' &&
      !this.bookingInProgress()
    );
  });

  ngOnInit(): void {
    this.loadFacilities();
  }

  private loadFacilities(): void {
    this.lastAction.set('facilities');
    this.error.set(null);
    this.api
      .getFacilities()
      .pipe(
        catchError((err) =>
          throwError(() => this.resolveError('facilities', err))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          if (facilities.length > 0) {
            this.selectedFacilityId.set(facilities[0].id);
          }
          this.lastAction.set(null);
        },
        error: (err: PreviewError) => {
          this.applyError(err);
          console.error('Error loading facilities:', err);
        },
      });
  }

  private getDefaultDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;

    this.lastAction.set('preview');
    this.loading.set(true);
    this.error.set(null);
    this.previewResult.set(null);
    this.bookingSuccess.set(false);
    this.bookingReference.set(null);
    this.confirmDialogOpen.set(false);

    const startDateTime = new Date(
      `${this.selectedDate()}T${this.startTime()}`
    );
    const endDateTime = new Date(`${this.selectedDate()}T${this.endTime()}`);
    const cacheKey = this.buildCacheKey(startDateTime, endDateTime);
    const cached = this.previewCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.previewResult.set(cached.result);
      this.loading.set(false);
      this.lastAction.set(null);
      return;
    }

    this.api
      .previewBooking({
        facilityId: this.selectedFacilityId(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        promoCode: this.promoCode() || undefined,
      })
      .pipe(
        catchError((err) =>
          throwError(() => this.resolveError('preview', err))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.previewResult.set(result);
          this.loading.set(false);
          this.previewCache.set(cacheKey, {
            result,
            expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
          });
          this.lastAction.set(null);
        },
        error: (err: PreviewError) => {
          this.loading.set(false);
          this.applyError(err);
          console.error('Error previewing booking:', err);
        },
      });
  }

  selectAlternative(alt: AlternativeSlotDto): void {
    const startDate = new Date(alt.startTime);
    const endDate = new Date(alt.endTime);

    this.selectedDate.set(startDate.toISOString().split('T')[0]);
    this.startTime.set(startDate.toTimeString().slice(0, 5));
    this.endTime.set(endDate.toTimeString().slice(0, 5));

    this.onSubmit();
  }

  formatTime(isoString: string | null | undefined): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  openConfirmDialog(): void {
    if (!this.canBook() || this.confirmDialogOpen()) return;
    this.confirmDialogOpen.set(true);
  }

  closeConfirmDialog(): void {
    if (this.bookingInProgress()) return;
    this.confirmDialogOpen.set(false);
  }

  onBook(): void {
    if (!this.canBook()) return;

    this.lastAction.set('booking');
    this.bookingInProgress.set(true);
    this.error.set(null);

    const startDateTime = new Date(
      `${this.selectedDate()}T${this.startTime()}`
    );
    const endDateTime = new Date(`${this.selectedDate()}T${this.endTime()}`);

    this.api
      .createBooking({
        facilityId: this.selectedFacilityId(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        customerName: this.customerName().trim(),
        customerPhone: this.customerPhone().trim(),
        status: this.holdAsPending() ? BookingStatus.PENDING : undefined,
      })
      .pipe(
        catchError((err) =>
          throwError(() => this.resolveError('booking', err))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (createdBooking) => {
          this.bookingInProgress.set(false);
          this.bookingSuccess.set(true);
          this.bookingReference.set(createdBooking.bookingReference ?? null);
          this.confirmDialogOpen.set(false);
          // Reset form for next booking
          this.customerName.set('');
          this.customerPhone.set('');
          this.holdAsPending.set(false);
          this.previewResult.set(null);
          this.lastAction.set(null);
        },
        error: (err: PreviewError) => {
          this.bookingInProgress.set(false);
          this.confirmDialogOpen.set(false);
          this.applyError(err);
          console.error('Error creating booking:', err);
        },
      });
  }

  retry(): void {
    const action = this.lastAction() ?? this.error()?.action ?? null;
    this.error.set(null);
    if (action === 'facilities') {
      this.loadFacilities();
      return;
    }
    if (action === 'preview') {
      this.onSubmit();
      return;
    }
    if (action === 'booking') {
      this.openConfirmDialog();
    }
  }

  resetBooking(): void {
    this.bookingSuccess.set(false);
    this.bookingReference.set(null);
    this.customerName.set('');
    this.customerPhone.set('');
    this.holdAsPending.set(false);
  }

  formatConflictType(type: ConflictType | undefined): string {
    switch (type) {
      case ConflictType.EXACT_OVERLAP:
        return 'Exact overlap with an existing booking';
      case ConflictType.CONTAINED_WITHIN:
        return 'Requested time falls within an existing booking';
      case ConflictType.PARTIAL_START_OVERLAP:
        return 'Requested start overlaps an existing booking';
      case ConflictType.PARTIAL_END_OVERLAP:
        return 'Requested end overlaps an existing booking';
      case ConflictType.CONTAINS_EXISTING:
        return 'Requested time contains an existing booking';
      default:
        return 'Conflict detected';
    }
  }

  private buildCacheKey(startDateTime: Date, endDateTime: Date): string {
    const promo = this.promoCode().trim().toUpperCase();
    return [
      this.selectedFacilityId(),
      startDateTime.toISOString(),
      endDateTime.toISOString(),
      promo,
    ].join('|');
  }

  private resolveError(action: PreviewAction, err: unknown): PreviewError {
    const status = this.extractStatus(err);
    const category = this.resolveCategory(status);

    let message = PREVIEW_ERROR_MESSAGES[action];
    if (action === 'preview' && status === 404) {
      message = 'Facility not found.';
    }
    if (action === 'booking') {
      const apiMessage = this.extractApiMessage(err);
      if (apiMessage) {
        message = apiMessage;
      }
    }

    return {
      action,
      category,
      message,
      status,
    };
  }

  private applyError(error: PreviewError): void {
    this.error.set(error);
  }

  private resolveCategory(status?: number): PreviewErrorCategory {
    if (status === 0) return 'network';
    if (typeof status === 'number' && status >= 500) return 'server';
    if (typeof status === 'number' && status >= 400) return 'validation';
    return 'unknown';
  }

  private extractStatus(err: unknown): number | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const status = Number((err as { status?: number }).status);
    return Number.isFinite(status) ? status : undefined;
  }

  private extractApiMessage(err: unknown): string | null {
    if (!err || typeof err !== 'object') return null;
    const error = (err as { error?: { message?: string } }).error;
    if (typeof error?.message === 'string' && error.message.trim() !== '') {
      return error.message;
    }
    return null;
  }
}
