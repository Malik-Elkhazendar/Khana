import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../shared/services/api.service';
import { BookingStore } from '../../state/bookings/booking.store';
import {
  BookingStatus,
  PaymentStatus,
  BookingListItemDto,
  FacilityListItemDto,
} from '@khana/shared-dtos';

type BookingStatusTone = 'success' | 'warning' | 'danger' | 'default';

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  selectedFacility = computed(() =>
    this.facilities().find((f) => f.id === this.selectedFacilityId()) ?? null
  );

  ngOnInit(): void {
    this.loadFacilities();
    this.store.loadBookings(this.selectedFacilityId);
  }

  onFacilityChange(): void {
    // Trigger handled by signal connection in ngOnInit
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

  formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-SA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  formatTime(isoString: string): string {
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

  bookingPrice(booking: BookingListItemDto): { amount: number; currency: string } {
    const pricePerHour = booking.facility?.config?.pricePerHour ?? 0;
    const start = new Date(booking.startTime).getTime();
    const end = new Date(booking.endTime).getTime();
    const hours = Math.max(0, (end - start) / (60 * 60 * 1000));
    const amount = Math.round(pricePerHour * hours);
    return { amount, currency: 'SAR' };
  }

  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-SA', { style: 'currency', currency }).format(amount);
  }

  cancelBooking(booking: BookingListItemDto) {
    if (booking.status === BookingStatus.CANCELLED) return;
    if (confirm('Are you sure you want to cancel this booking?')) {
        this.store.updateStatus({
            id: booking.id,
            status: BookingStatus.CANCELLED,
            previousBooking: booking
        });
    }
  }

  markAsPaid(booking: BookingListItemDto) {
      if (booking.paymentStatus === PaymentStatus.PAID) return;
      this.store.updateStatus({
          id: booking.id,
          status: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          previousBooking: booking
      });
  }

  readonly BookingStatus = BookingStatus;
  readonly PaymentStatus = PaymentStatus;
}

