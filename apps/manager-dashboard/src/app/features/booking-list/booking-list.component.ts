import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../shared/services/api.service';
import { BookingStore } from '../../state/bookings/booking.store';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';
import { CancellationFormComponent } from '../../shared/components/cancellation-form.component';
import {
  BookingStatus,
  PaymentStatus,
  BookingListItemDto,
  FacilityListItemDto,
} from '@khana/shared-dtos';

type BookingStatusTone = 'success' | 'warning' | 'danger' | 'default';

const CANCEL_DIALOG_COPY = {
  title: 'Cancel booking',
  message: 'This action is permanent and cannot be undone.',
  confirmLabel: 'Cancel booking',
};
const CANCEL_FAILURE_MESSAGE = 'Cancellation failed. Please try again.';

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmationDialogComponent,
    CancellationFormComponent,
  ],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss',
})
export class BookingListComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly store = inject(BookingStore);

  facilities = signal<FacilityListItemDto[]>([]);
  selectedFacilityId = signal<string>('');

  bookings = this.store.bookings;
  loading = this.store.loading;
  error = this.store.error;

  readonly cancelDialogBooking = signal<BookingListItemDto | null>(null);
  readonly cancelReason = signal('');
  readonly cancelReasonMinLength = 5;
  readonly cancelError = signal<string | null>(null);
  readonly cancelReasonValid = computed(
    () => this.cancelReason().trim().length >= this.cancelReasonMinLength
  );
  readonly actionInProgress = signal(false);
  readonly cancelDialogCopy = CANCEL_DIALOG_COPY;

  selectedFacility = computed(() =>
    this.facilities().find((f) => f.id === this.selectedFacilityId()) ?? null
  );

  ngOnInit(): void {
    this.loadFacilities();
    this.store.loadBookings(this.getFacilityFilter());
  }

  onFacilityChange(): void {
    this.store.loadBookings(this.getFacilityFilter());
  }

  private loadFacilities(): void {
    this.api.getFacilities().subscribe({
      next: (facilities) => {
        this.facilities.set(facilities);
      },
      error: (err) => {
        // We can use a local error or store error, but facilities are separate
        console.error('Error loading facilities:', err);
      },
    });
  }

  private getFacilityFilter(): string | null {
    const facilityId = this.selectedFacilityId().trim();
    return facilityId.length > 0 ? facilityId : null;
  }

  formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-SA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  formatTime(isoString: string | null | undefined): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatTimeRange(startIso: string, endIso: string): string {
    return `${this.formatTime(startIso)} – ${this.formatTime(endIso)}`;
  }

  statusTone(status: string): BookingStatusTone {
    switch (status) {
      case 'CONFIRMED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
      case 'NO_SHOW':
        return 'danger';
      default:
        return 'default';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED':
        return 'Confirmed';
      case 'PENDING':
        return 'Pending';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No show';
      default:
        return status;
    }
  }

  isHoldActive(booking: BookingListItemDto): boolean {
    if (booking.status !== BookingStatus.PENDING || !booking.holdUntil) {
      return false;
    }
    return new Date(booking.holdUntil).getTime() > Date.now();
  }

  bookingPrice(booking: BookingListItemDto): { amount: number; currency: string } {
    const currency = booking.currency || 'SAR';
    const totalAmount = booking.totalAmount;
    if (typeof totalAmount === 'number' && !Number.isNaN(totalAmount)) {
      return { amount: totalAmount, currency };
    }
    if (typeof totalAmount === 'string' && totalAmount.trim().length > 0) {
      const parsed = Number(totalAmount);
      if (!Number.isNaN(parsed)) {
        return { amount: parsed, currency };
      }
    }

    const pricePerHour = booking.facility?.config?.pricePerHour ?? 0;
    const start = new Date(booking.startTime).getTime();
    const end = new Date(booking.endTime).getTime();
    const hours = Math.max(0, (end - start) / (60 * 60 * 1000));
    const amount = Math.round(pricePerHour * hours);
    return { amount, currency };
  }

  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-SA', { style: 'currency', currency }).format(amount);
  }

  openCancelDialog(booking: BookingListItemDto): void {
    if (booking.status === BookingStatus.CANCELLED) return;
    this.cancelDialogBooking.set(booking);
    this.cancelReason.set('');
    this.cancelError.set(null);
  }

  closeCancelDialog(): void {
    this.cancelDialogBooking.set(null);
    this.cancelReason.set('');
    this.cancelError.set(null);
    this.actionInProgress.set(false);
  }

  async submitCancelDialog(): Promise<void> {
    if (this.actionInProgress()) return;
    const booking = this.cancelDialogBooking();
    if (!booking) return;
    if (!this.cancelReasonValid()) return;

    this.actionInProgress.set(true);
    const success = await this.store.cancelBooking(
      booking.id,
      this.cancelReason().trim()
    );
    this.actionInProgress.set(false);

    if (success) {
      this.closeCancelDialog();
    } else {
      this.cancelError.set(CANCEL_FAILURE_MESSAGE);
    }
  }

  async markAsPaid(booking: BookingListItemDto): Promise<void> {
    if (booking.paymentStatus === PaymentStatus.PAID) return;
    await this.store.markBookingPaid(booking.id);
  }

  readonly BookingStatus = BookingStatus;
  readonly PaymentStatus = PaymentStatus;
}
